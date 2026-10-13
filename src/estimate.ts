import { analyzeFile, getFileKind, isOcrSupported } from './lib/extract.ts'
import { getAuth, onAuthChange } from './lib/auth.ts'
import { openAuthDialog } from './auth-ui.ts'
import { isConfigured, supabase } from './lib/supabase.ts'
import { allLanguages, languageLabel } from './lib/languages.ts'
import { formatMoney } from './lib/format.ts'

type Rate = { code: string; name: string; rate: number }
type Analysis = { fileName: string; wordCount: number; detectedLanguage: string | null }

const pendingKey = 'gt-pending-quote'
const pendingTtl = 2 * 60 * 60 * 1000

const form = document.querySelector<HTMLFormElement>('#estimate-form')!
const fileInput = document.querySelector<HTMLInputElement>('#document-file')!
const sourceSelect = document.querySelector<HTMLSelectElement>('#source-language')!
const targetSelect = document.querySelector<HTMLSelectElement>('#target-language')!
const submitButton = document.querySelector<HTMLButtonElement>('#quote-submit')!
const fileStatus = document.querySelector<HTMLParagraphElement>('#file-status')!
const countLabel = document.querySelector<HTMLSpanElement>('#word-count')!
const totalLabel = document.querySelector<HTMLElement>('#estimate-total')!
const estimateNote = document.querySelector<HTMLElement>('#estimate-note')!
const unlockButton = document.querySelector<HTMLButtonElement>('#unlock-price')!
const formMessage = document.querySelector<HTMLParagraphElement>('#form-message')!
const uploadLabel = document.querySelector<HTMLElement>('.upload-label')!

let rates = new Map<string, Rate>()
const languageCodes = new Set<string>(allLanguages.map((language) => language.code))
let analysis: Analysis | null = null
let currentFile: File | null = null
let ocrLanguage: string | null = null
let busy = false
let runId = 0
let awaitingLogin = false

const idleStatus = 'Dosya analiz edildiğinde sözcük sayısı burada görünür.'

function showMessage(message: string, kind: 'error' | 'success' = 'error') {
  formMessage.textContent = message
  formMessage.className = `form-message ${kind}`
}

function setLanguagesEnabled(enabled: boolean) {
  sourceSelect.disabled = !enabled
  targetSelect.disabled = !enabled
}

function fillLanguageOptions(select: HTMLSelectElement, placeholder: string) {
  select.replaceChildren(new Option(placeholder, ''))
  for (const language of allLanguages) select.add(new Option(languageLabel(language.code, language.name), language.code))
}

// Tarifeler yalnızca giriş yapmış kullanıcılara yüklenir; misafire fiyat gösterilmez.
function refreshEstimate() {
  const signedIn = Boolean(getAuth().session)
  const rate = rates.get(sourceSelect.value)
  countLabel.textContent = analysis ? `${analysis.wordCount.toLocaleString('tr-TR')} sözcük` : 'Sözcük sayısı: -'
  unlockButton.hidden = signedIn || !analysis
  if (!signedIn) {
    totalLabel.textContent = analysis ? 'Tahmini tutar: giriş yaptıktan sonra görünür' : 'Tahmini tutar: -'
    estimateNote.textContent = analysis
      ? 'Ücretsiz hesap oluşturun; fiyatı anında görün ve teklif talebi gönderin.'
      : 'Fiyatı görmek için ücretsiz hesap gerekir.'
  } else if (analysis && rate && targetSelect.value) {
    totalLabel.textContent = `Tahmini tutar: ${formatMoney(Math.round(analysis.wordCount * rate.rate * 100) / 100)}`
    estimateNote.textContent = 'Kesin fiyat belge kontrolünden sonra belirlenir.'
  } else {
    totalLabel.textContent = 'Tahmini tutar: -'
    estimateNote.textContent = 'Fiyat dil seçiminize göre hesaplanır.'
  }
  submitButton.disabled = !analysis || !sourceSelect.value || !targetSelect.value || busy || (signedIn && !rate)
  submitButton.textContent = signedIn ? 'Teklif talebi gönder' : 'Giriş yap ve talebi gönder'
}

function savePending() {
  if (!analysis) return
  localStorage.setItem(pendingKey, JSON.stringify({
    ...analysis, source: sourceSelect.value, target: targetSelect.value, savedAt: Date.now(),
  }))
}

async function runAnalysis(file: File) {
  const id = ++runId
  busy = true
  analysis = null
  refreshEstimate()
  const kind = getFileKind(file)
  const language = sourceSelect.value
  fileStatus.textContent = kind === 'image'
    ? `${file.name} okunuyor… (ilk kullanımda dil verisi indirilir)`
    : `${file.name} analiz ediliyor…`
  try {
    const result = await analyzeFile(file, {
      ocrLanguage: language,
      onProgress: (ratio) => {
        if (id === runId) fileStatus.textContent = `${file.name} okunuyor… %${Math.round(ratio * 100)}`
      },
    })
    if (id !== runId) return
    analysis = { fileName: file.name, wordCount: result.wordCount, detectedLanguage: result.detectedLanguage }
    ocrLanguage = kind === 'image' ? language : null
    const detected = result.detectedLanguage
    if (kind !== 'image' && detected && languageCodes.has(detected)) {
      sourceSelect.value = detected
      fileStatus.textContent = `${file.name} · Algılanan dil: ${languageLabel(detected)}`
    } else if (kind === 'image') {
      fileStatus.textContent = `${file.name} · Fotoğraftan okunan metin sayıldı`
    } else {
      sourceSelect.value = ''
      fileStatus.textContent = `${file.name} · Dil otomatik belirlenemedi; listeden seçin.`
    }
    if (!targetSelect.value) targetSelect.value = sourceSelect.value === 'tr' ? 'en' : 'tr'
    savePending()
    showMessage('Dosya analiz edildi. Dilleri kontrol edip iletişim bilgilerinizi girin.', 'success')
    if (getAuth().ready && !getAuth().session) {
      awaitingLogin = true
      openAuthDialog({
        mode: 'signup',
        message: `Belgenizde ${result.wordCount.toLocaleString('tr-TR')} sözcük bulundu. Fiyatı görmek ve teklif almak için ücretsiz hesap oluşturun; analiz sonucunuz korunur.`,
      })
    }
  } catch (error) {
    if (id !== runId) return
    fileStatus.textContent = file.name
    showMessage(error instanceof Error ? error.message : 'Dosya analiz edilemedi.')
  } finally {
    if (id === runId) {
      busy = false
      refreshEstimate()
    }
  }
}

function handleFile(file: File | undefined) {
  runId++
  analysis = null
  currentFile = null
  ocrLanguage = null
  busy = false
  formMessage.textContent = ''
  localStorage.removeItem(pendingKey)
  if (!file) {
    fileStatus.textContent = idleStatus
    setLanguagesEnabled(false)
    refreshEstimate()
    return
  }
  if (!getFileKind(file)) {
    fileStatus.textContent = file.name
    setLanguagesEnabled(false)
    showMessage(
      /\.hei[cf]$/i.test(file.name)
        ? 'HEIC fotoğraf biçimi desteklenmiyor. Fotoğrafı JPG veya PNG olarak gönderin (iPhone: Ayarlar > Kamera > Biçimler > En Uyumlu).'
        : 'PDF, DOCX, TXT veya fotoğraf (JPG, PNG, WEBP) yükleyin.',
    )
    refreshEstimate()
    return
  }
  currentFile = file
  setLanguagesEnabled(true)
  if (getFileKind(file) === 'image' && !isOcrSupported(sourceSelect.value)) {
    sourceSelect.value = ''
    fileStatus.textContent = `${file.name} · Fotoğraftaki metnin dilini “Kaynak dil” alanından seçin; metin otomatik okunacak.`
    refreshEstimate()
    return
  }
  void runAnalysis(file)
}

function onSourceChange() {
  if (currentFile && getFileKind(currentFile) === 'image' && sourceSelect.value && sourceSelect.value !== ocrLanguage) {
    if (isOcrSupported(sourceSelect.value)) {
      void runAnalysis(currentFile)
      return
    }
    showMessage('Fotoğraf okuma bu dil için desteklenmiyor. PDF, DOCX veya TXT yükleyin.')
  }
  savePending()
  refreshEstimate()
}

async function submitQuote(event: Event) {
  event.preventDefault()
  if (!analysis) {
    showMessage('Önce belgenizi yükleyin.')
    return
  }
  if (!form.checkValidity()) {
    form.reportValidity()
    return
  }
  const { session } = getAuth()
  if (!session) {
    savePending()
    awaitingLogin = true
    openAuthDialog({
      mode: 'signin',
      message: 'Teklif talebini göndermek için giriş yapın veya ücretsiz hesap oluşturun. Analiz sonucunuz korunur.',
    })
    return
  }

  const fields = new FormData(form)
  submitButton.disabled = true
  submitButton.textContent = 'Talep gönderiliyor...'
  try {
    const { data, error } = await supabase.rpc('create_quote', {
      p_customer_name: String(fields.get('customerName') ?? ''),
      p_email: String(fields.get('email') ?? ''),
      p_phone: String(fields.get('phone') ?? ''),
      p_file_name: analysis.fileName,
      p_note: String(fields.get('note') ?? ''),
      p_word_count: analysis.wordCount,
      p_source_language: sourceSelect.value,
      p_target_language: targetSelect.value,
    })
    if (error) throw new Error(error.message)

    let notification = 'failed'
    try {
      const response = await fetch('/api/notify-quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ quoteId: data.id }),
      })
      notification = (await response.json()).notificationStatus ?? 'failed'
    } catch {
      notification = 'failed'
    }
    const emailMessage = notification === 'sent'
      ? 'Talebiniz kaydedildi ve Güven Tercüme’ye e-posta ile iletildi.'
      : notification === 'smtp_not_configured'
        ? 'Talebiniz kaydedildi ve yönetim paneline düştü.'
        : 'Talebiniz kaydedildi ancak e-posta bildirimi gönderilemedi; yönetim panelinden takip edilecek.'
    form.reset()
    handleFile(undefined)
    showMessage(`${emailMessage} Talep numarası: ${String(data.id).slice(0, 8).toUpperCase()}`, 'success')
  } catch (error) {
    showMessage(error instanceof Error ? error.message : 'Talep kaydedilemedi.')
  } finally {
    refreshEstimate()
  }
}

function prefillContact() {
  const { session, profile } = getAuth()
  if (!session) return
  const name = form.elements.namedItem('customerName') as HTMLInputElement
  const email = form.elements.namedItem('email') as HTMLInputElement
  if (!name.value) name.value = profile?.full_name ?? ''
  if (!email.value) email.value = session.user.email ?? ''
}

async function loadRates() {
  const { data, error } = await supabase.from('rates').select('code,name,rate').order('name')
  if (error || !data?.length) {
    showMessage('Dil tarifeleri yüklenemedi. Lütfen sayfayı yenileyin.')
    return
  }
  rates = new Map(data.map((row) => [row.code, { code: row.code, name: row.name, rate: Number(row.rate) }]))
  refreshEstimate()
}

async function initialize() {
  if (!isConfigured) {
    showMessage('Teklif sistemi henüz yapılandırılmadı.')
    return
  }
  fillLanguageOptions(sourceSelect, 'Kaynak dili seçin')
  fillLanguageOptions(targetSelect, 'Hedef dili seçin')

  const saved = localStorage.getItem(pendingKey)
  if (saved) {
    try {
      const pending = JSON.parse(saved)
      if (Date.now() - pending.savedAt < pendingTtl && pending.wordCount > 0) {
        analysis = { fileName: pending.fileName, wordCount: pending.wordCount, detectedLanguage: pending.detectedLanguage }
        sourceSelect.value = languageCodes.has(pending.source) ? pending.source : ''
        targetSelect.value = languageCodes.has(pending.target) ? pending.target : ''
        setLanguagesEnabled(true)
        fileStatus.textContent = `${pending.fileName} · önceki analiz geri yüklendi`
      }
    } catch {
      localStorage.removeItem(pendingKey)
    }
  }
  refreshEstimate()
}

fileInput.addEventListener('change', () => handleFile(fileInput.files?.[0]))
sourceSelect.addEventListener('change', onSourceChange)
targetSelect.addEventListener('change', () => {
  savePending()
  refreshEstimate()
})
form.addEventListener('submit', (event) => void submitQuote(event))

for (const eventName of ['dragenter', 'dragover']) {
  uploadLabel.addEventListener(eventName, (event) => {
    event.preventDefault()
    uploadLabel.classList.add('dragging')
  })
}
for (const eventName of ['dragleave', 'drop']) {
  uploadLabel.addEventListener(eventName, (event) => {
    event.preventDefault()
    uploadLabel.classList.remove('dragging')
  })
}
uploadLabel.addEventListener('drop', (event) => {
  const file = (event as DragEvent).dataTransfer?.files[0]
  if (!file) return
  const transfer = new DataTransfer()
  transfer.items.add(file)
  fileInput.files = transfer.files
  handleFile(file)
})

unlockButton.addEventListener('click', () => {
  savePending()
  awaitingLogin = true
  openAuthDialog({
    mode: 'signup',
    message: 'Fiyatı görmek ve teklif almak için ücretsiz hesap oluşturun. Analiz sonucunuz korunur.',
  })
})

onAuthChange((state) => {
  if (!state.ready) return
  if (state.session) {
    if (rates.size === 0) void loadRates()
  } else {
    rates = new Map()
  }
  prefillContact()
  refreshEstimate()
  if (state.session && awaitingLogin) {
    awaitingLogin = false
    showMessage('Giriş yaptınız. Fiyat aşağıda görünüyor; bilgileri kontrol edip talebi gönderebilirsiniz.', 'success')
  }
})

void initialize()
