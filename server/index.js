import 'dotenv/config'
import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import express from 'express'
import helmet from 'helmet'
import { DOMParser } from '@xmldom/xmldom'
import JSZip from 'jszip'
import multer from 'multer'
import nodemailer from 'nodemailer'
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs'
import { rateLimit } from 'express-rate-limit'
import { countWords, detectLanguage, languages } from './languages.js'

const app = express()
const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const dataDirectory = path.join(projectRoot, 'server-data')
const dataFile = path.join(dataDirectory, 'store.json')
const port = Number(process.env.PORT || 3000)
const adminPassword = process.env.ADMIN_PASSWORD || crypto.randomBytes(24).toString('base64url')
const sessions = new Map()
const previews = new Map()
const languageByCode = new Map(languages.map((language) => [language.code, language]))
const wordNamespace = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'
const allowedExtensions = new Set(['.pdf', '.docx', '.txt'])
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 1 },
  fileFilter(_request, file, callback) {
    const extension = path.extname(file.originalname).toLowerCase()
    const allowed = allowedExtensions.has(extension)
    callback(allowed ? null : Object.assign(new Error('PDF, DOCX veya TXT dosyası yükleyin.'), { status: 400 }), allowed)
  },
})

const defaultStore = () => ({
  settings: { notificationEmail: 'guventercume@hotmail.com' },
  rates: languages.map(({ code, name }) => ({ code, name, rate: 2.5 })),
  quotes: [],
})
let storeUpdateQueue = Promise.resolve()

async function readStore() {
  await fs.mkdir(dataDirectory, { recursive: true })
  try {
    return JSON.parse(await fs.readFile(dataFile, 'utf8'))
  } catch (error) {
    if (error.code !== 'ENOENT') throw error
    const store = defaultStore()
    await writeStore(store)
    return store
  }
}

async function writeStore(store) {
  await fs.mkdir(dataDirectory, { recursive: true })
  const temporaryFile = `${dataFile}.tmp`
  await fs.writeFile(temporaryFile, JSON.stringify(store, null, 2), 'utf8')
  await fs.rename(temporaryFile, dataFile)
}

function updateStore(update) {
  const operation = storeUpdateQueue.then(async () => {
    const store = await readStore()
    const result = await update(store)
    await writeStore(store)
    return result
  })
  storeUpdateQueue = operation.catch(() => {})
  return operation
}

function safeText(value, maxLength = 500) {
  return String(value ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, maxLength)
}

function makeRateMap(store) {
  return new Map(store.rates.map(({ code, rate }) => [code, Number(rate)]))
}

async function extractPdfText(buffer) {
  const loadingTask = getDocument({
    data: new Uint8Array(buffer),
    isEvalSupported: false,
    useSystemFonts: true,
  })
  const document = await loadingTask.promise
  try {
    if (document.numPages > 500) {
      throw Object.assign(new Error('PDF 500 sayfadan uzun olamaz.'), { status: 413 })
    }
    const pages = []
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber++) {
      const page = await document.getPage(pageNumber)
      const content = await page.getTextContent()
      pages.push(content.items.map((item) => ('str' in item ? item.str : '')).join(' '))
      page.cleanup()
    }
    return pages.join('\n')
  } finally {
    await loadingTask.destroy()
  }
}

function calculateEstimate(preview, sourceLanguage, targetLanguage, store) {
  if (!languageByCode.has(sourceLanguage) || !languageByCode.has(targetLanguage)) {
    throw Object.assign(new Error('Kaynak ve hedef dili seçin.'), { status: 400 })
  }
  const rate = makeRateMap(store).get(sourceLanguage)
  const amount = Math.round(preview.wordCount * rate * 100) / 100
  return {
    wordCount: preview.wordCount,
    detectedLanguage: preview.detectedLanguage,
    sourceLanguage,
    targetLanguage,
    ratePerWord: rate,
    estimatedTotal: amount,
    currency: 'TRY',
  }
}

function getSmtpTransport() {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env
  if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASS) return null
  return nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT),
    secure: Number(SMTP_PORT) === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  })
}

async function sendQuoteNotification(quote, recipient) {
  const transport = getSmtpTransport()
  if (!transport) return 'smtp_not_configured'
  await transport.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to: recipient,
    replyTo: quote.email,
    subject: `Yeni tercüme teklifi: ${quote.customerName}`,
    text: [
      `Ad Soyad: ${quote.customerName}`,
      `E-posta: ${quote.email}`,
      `Telefon: ${quote.phone}`,
      `Dosya: ${quote.fileName}`,
      `Sözcük sayısı: ${quote.wordCount}`,
      `Dil çifti: ${languageByCode.get(quote.sourceLanguage).name} > ${languageByCode.get(quote.targetLanguage).name}`,
      `Birim fiyat: ${quote.ratePerWord.toFixed(2)} TL`,
      `Tahmini toplam: ${quote.estimatedTotal.toFixed(2)} TL`,
      `Not: ${quote.note || '-'}`,
    ].join('\n'),
  })
  return 'sent'
}

function requireAdmin(request, response, next) {
  const token = request.get('authorization')?.replace(/^Bearer\s+/i, '')
  const expiresAt = sessions.get(token)
  if (!token || !expiresAt || expiresAt < Date.now()) {
    if (token) sessions.delete(token)
    return response.status(401).json({ error: 'Yönetici oturumu geçersiz veya sona ermiş.' })
  }
  next()
}

app.disable('x-powered-by')
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com', 'data:'],
      imgSrc: ["'self'", 'data:', 'https://images.unsplash.com'],
      connectSrc: ["'self'"],
      objectSrc: ["'none'"],
      frameAncestors: ["'none'"],
    },
  },
}))
app.use(express.json({ limit: '32kb' }))
app.use('/api/admin/login', rateLimit({ windowMs: 15 * 60 * 1000, limit: 8, standardHeaders: 'draft-8', legacyHeaders: false }))
const uploadLimit = rateLimit({ windowMs: 15 * 60 * 1000, limit: 20, standardHeaders: 'draft-8', legacyHeaders: false })
const quoteLimit = rateLimit({ windowMs: 60 * 60 * 1000, limit: 10, standardHeaders: 'draft-8', legacyHeaders: false })

app.get('/api/config', async (_request, response, next) => {
  try {
    const store = await readStore()
    response.json({ languages, rates: store.rates })
  } catch (error) {
    next(error)
  }
})

app.post('/api/estimate/preview', uploadLimit, upload.single('document'), async (request, response, next) => {
  try {
    if (!request.file) return response.status(400).json({ error: 'Bir PDF, DOCX veya TXT belgesi seçin.' })
    for (const [id, preview] of previews) {
      if (Date.now() - preview.createdAt > 30 * 60 * 1000) previews.delete(id)
    }
    const extension = path.extname(request.file.originalname).toLowerCase()
    let extractedText = ''
    if (extension === '.pdf') {
      extractedText = await extractPdfText(request.file.buffer)
    } else if (extension === '.docx') {
      const archive = await JSZip.loadAsync(request.file.buffer)
      const documentFile = archive.file('word/document.xml')
      if (!documentFile) throw Object.assign(new Error('DOCX belgesinde metin içeriği bulunamadı.'), { status: 422 })
      const documentXml = await documentFile.async('string')
      if (documentXml.length > 20 * 1024 * 1024) {
        throw Object.assign(new Error('Belge metni analiz sınırını aşıyor.'), { status: 413 })
      }
      const parsedDocument = new DOMParser().parseFromString(documentXml, 'application/xml')
      const textNodes = parsedDocument.getElementsByTagNameNS(wordNamespace, 't')
      extractedText = Array.from({ length: textNodes.length }, (_value, index) => textNodes.item(index)?.textContent ?? '').join(' ')
    } else {
      extractedText = request.file.buffer.toString('utf8')
    }

    const wordCount = countWords(extractedText)
    if (wordCount < 1) {
      return response.status(422).json({ error: 'Belgede okunabilir metin bulunamadı. Taranmış PDF yerine metin seçilebilir PDF, DOCX veya TXT yükleyin.' })
    }

    const previewId = crypto.randomUUID()
    const preview = {
      wordCount,
      detectedLanguage: detectLanguage(extractedText),
      fileName: safeText(path.basename(request.file.originalname), 180),
      createdAt: Date.now(),
    }
    previews.set(previewId, preview)
    response.json({ previewId, ...preview })
  } catch (error) {
    next(error)
  }
})

app.post('/api/estimate', async (request, response, next) => {
  try {
    const preview = previews.get(safeText(request.body.previewId, 80))
    if (!preview || Date.now() - preview.createdAt > 30 * 60 * 1000) {
      return response.status(410).json({ error: 'Dosya analizi sona erdi. Lütfen belgeyi yeniden yükleyin.' })
    }
    const store = await readStore()
    response.json(calculateEstimate(preview, request.body.sourceLanguage, request.body.targetLanguage, store))
  } catch (error) {
    next(error)
  }
})

app.post('/api/quotes', quoteLimit, async (request, response, next) => {
  try {
    const preview = previews.get(safeText(request.body.previewId, 80))
    if (!preview || Date.now() - preview.createdAt > 30 * 60 * 1000) {
      return response.status(410).json({ error: 'Dosya analizi sona erdi. Lütfen belgeyi yeniden yükleyin.' })
    }

    const customerName = safeText(request.body.customerName, 140)
    const email = safeText(request.body.email, 180)
    const phone = safeText(request.body.phone, 40)
    if (!customerName || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || phone.replace(/\D/g, '').length < 10) {
      return response.status(400).json({ error: 'Ad soyad, geçerli e-posta ve telefon numarası zorunludur.' })
    }
    if (request.body.privacyConsent !== true) {
      return response.status(400).json({ error: 'Teklif talebi için kişisel veriler bilgilendirmesini onaylayın.' })
    }

    const quote = await updateStore((store) => {
      const estimate = calculateEstimate(preview, request.body.sourceLanguage, request.body.targetLanguage, store)
      const newQuote = {
        id: crypto.randomUUID(),
        customerName,
        email,
        phone,
        fileName: preview.fileName,
        note: safeText(request.body.note, 1000),
        ...estimate,
        status: 'new',
        notificationStatus: 'pending',
        createdAt: new Date().toISOString(),
      }
      store.quotes.unshift(newQuote)
      return newQuote
    })
    previews.delete(request.body.previewId)

    try {
      const store = await readStore()
      quote.notificationStatus = await sendQuoteNotification(quote, store.settings.notificationEmail)
    } catch (error) {
      quote.notificationStatus = 'failed'
      quote.notificationError = safeText(error.message, 300)
    }
    await updateStore((store) => {
      const storedQuote = store.quotes.find((entry) => entry.id === quote.id)
      if (storedQuote) {
        storedQuote.notificationStatus = quote.notificationStatus
        if (quote.notificationError) storedQuote.notificationError = quote.notificationError
      }
    })
    response.status(201).json({ id: quote.id, estimatedTotal: quote.estimatedTotal, notificationStatus: quote.notificationStatus })
  } catch (error) {
    next(error)
  }
})

app.post('/api/admin/login', (request, response) => {
  const submittedPassword = Buffer.from(String(request.body.password ?? ''))
  const configuredPassword = Buffer.from(adminPassword)
  const matches = submittedPassword.length === configuredPassword.length && crypto.timingSafeEqual(submittedPassword, configuredPassword)
  if (!matches) return response.status(401).json({ error: 'Yönetici parolası hatalı.' })
  const token = crypto.randomBytes(32).toString('base64url')
  sessions.set(token, Date.now() + 8 * 60 * 60 * 1000)
  response.json({ token })
})

app.get('/api/admin/settings', requireAdmin, async (_request, response, next) => {
  try {
    const store = await readStore()
    response.json({
      settings: store.settings,
      rates: store.rates,
      languages,
      smtpConfigured: Boolean(getSmtpTransport()),
    })
  } catch (error) {
    next(error)
  }
})

app.put('/api/admin/settings', requireAdmin, async (request, response, next) => {
  try {
    const notificationEmail = safeText(request.body.notificationEmail, 180)
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(notificationEmail)) {
      return response.status(400).json({ error: 'Bildirim e-posta adresi geçerli olmalı.' })
    }
    if (!Array.isArray(request.body.rates)) return response.status(400).json({ error: 'Dil tarifeleri geçersiz.' })
    const submittedRates = new Map(request.body.rates.map((entry) => [entry.code, entry.rate]))
    const rates = languages.map(({ code, name }) => {
      const rate = submittedRates.get(code)
      if (typeof rate !== 'number' || !Number.isFinite(rate) || rate < 0 || rate > 100000) {
        throw Object.assign(new Error(`${name} için geçerli bir TL/sözcük tutarı girin.`), { status: 400 })
      }
      return { code, name, rate: Math.round(rate * 100) / 100 }
    })
    await updateStore((store) => {
      store.settings.notificationEmail = notificationEmail
      store.rates = rates
    })
    response.json({ saved: true, count: rates.length })
  } catch (error) {
    next(error)
  }
})

app.get('/api/admin/quotes', requireAdmin, async (_request, response, next) => {
  try {
    const store = await readStore()
    response.json(store.quotes)
  } catch (error) {
    next(error)
  }
})

app.patch('/api/admin/quotes/:id', requireAdmin, async (request, response, next) => {
  try {
    const allowedStatuses = new Set(['new', 'contacted', 'completed'])
    if (!allowedStatuses.has(request.body.status)) return response.status(400).json({ error: 'Talep durumu geçersiz.' })
    const updated = await updateStore((store) => {
      const quote = store.quotes.find((entry) => entry.id === request.params.id)
      if (!quote) return false
      quote.status = request.body.status
      return true
    })
    if (!updated) return response.status(404).json({ error: 'Teklif bulunamadı.' })
    response.json({ saved: true })
  } catch (error) {
    next(error)
  }
})

app.delete('/api/admin/quotes/:id', requireAdmin, async (request, response, next) => {
  try {
    const deleted = await updateStore((store) => {
      const originalLength = store.quotes.length
      store.quotes = store.quotes.filter((entry) => entry.id !== request.params.id)
      return store.quotes.length !== originalLength
    })
    if (!deleted) return response.status(404).json({ error: 'Teklif bulunamadı.' })
    response.status(204).end()
  } catch (error) {
    next(error)
  }
})

const staticDirectory = path.join(projectRoot, 'dist')
app.use(express.static(staticDirectory))
app.use((_request, response, next) => {
  response.sendFile(path.join(staticDirectory, 'index.html'), (error) => error && next(error))
})

app.use((error, _request, response, _next) => {
  const status = error.status || (error instanceof multer.MulterError ? 400 : 500)
  if (status >= 500) console.error(error)
  response.status(status).json({ error: status >= 500 ? 'İşlem tamamlanamadı. Lütfen tekrar deneyin.' : safeText(error.message, 300) })
})

if (!process.env.ADMIN_PASSWORD && process.env.NODE_ENV === 'production') {
  throw new Error('Üretimde ADMIN_PASSWORD ortam değişkeni zorunludur.')
}
if (!process.env.ADMIN_PASSWORD) {
  console.warn(`ADMIN_PASSWORD tanımlı değil. Geçici yönetici parolası: ${adminPassword}`)
}

await readStore()
app.listen(port, () => console.log(`Güven Tercüme API listening on http://localhost:${port}`))
