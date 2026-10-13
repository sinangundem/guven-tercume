import nodemailer from 'nodemailer'
import { createClient } from '@supabase/supabase-js'

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const smtpConfigured = () => Boolean(process.env.SMTP_HOST && process.env.SMTP_PORT && process.env.SMTP_USER && process.env.SMTP_PASS)

function createTransport() {
  const port = Number(process.env.SMTP_PORT)
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: port === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  })
}

// GET: SMTP durumu. POST: oturum açmış kullanıcının kendi teklifi için yönetici adresine e-posta gönderir.
export default async function handler(request, response) {
  if (request.method === 'GET') return response.status(200).json({ smtpConfigured: smtpConfigured() })
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'GET, POST')
    return response.status(405).json({ error: 'Yöntem desteklenmiyor.' })
  }

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceKey) return response.status(500).json({ error: 'Sunucu yapılandırılmadı.' })

  const token = request.headers.authorization?.replace(/^Bearer\s+/i, '')
  const quoteId = request.body?.quoteId
  if (!token || typeof quoteId !== 'string' || !uuidPattern.test(quoteId)) {
    return response.status(400).json({ error: 'Geçersiz istek.' })
  }

  const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } })
  const { data: userData, error: userError } = await supabase.auth.getUser(token)
  if (userError || !userData.user) return response.status(401).json({ error: 'Oturum geçersiz.' })

  const { data: quote } = await supabase.from('quotes').select('*').eq('id', quoteId).eq('user_id', userData.user.id).maybeSingle()
  if (!quote) return response.status(404).json({ error: 'Teklif bulunamadı.' })
  if (quote.notification_status !== 'pending') return response.status(200).json({ notificationStatus: quote.notification_status })

  const setStatus = async (notificationStatus) => {
    await supabase.from('quotes').update({ notification_status: notificationStatus }).eq('id', quote.id)
    return response.status(200).json({ notificationStatus })
  }
  if (!smtpConfigured()) return setStatus('smtp_not_configured')

  try {
    const [{ data: settings }, { data: languages }] = await Promise.all([
      supabase.from('settings').select('notification_email').eq('id', true).maybeSingle(),
      supabase.from('rates').select('code,name').in('code', [quote.source_language, quote.target_language]),
    ])
    if (!settings?.notification_email) return setStatus('failed')
    const nameOf = (code) => languages?.find((language) => language.code === code)?.name ?? code

    await createTransport().sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to: settings.notification_email,
      replyTo: quote.email,
      subject: `Yeni tercüme teklifi: ${quote.customer_name}`,
      text: [
        `Talep: ${quote.id.slice(0, 8).toUpperCase()}`,
        `Ad Soyad: ${quote.customer_name}`,
        `E-posta: ${quote.email}`,
        `Telefon: ${quote.phone}`,
        `Dosya: ${quote.file_name}`,
        `Sözcük sayısı: ${quote.word_count}`,
        `Dil çifti: ${nameOf(quote.source_language)} > ${nameOf(quote.target_language)}`,
        `Birim fiyat: ${Number(quote.rate_per_word).toFixed(2)} TL`,
        `Tahmini toplam: ${Number(quote.estimated_total).toFixed(2)} TL`,
        `Not: ${quote.note || '-'}`,
      ].join('\n'),
    })
    return setStatus('sent')
  } catch (error) {
    console.error('E-posta gönderilemedi', error)
    return setStatus('failed')
  }
}
