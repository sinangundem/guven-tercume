import './admin.css'

type Language = { code: string; name: string }
type Rate = Language & { rate: number }
type Quote = {
  id: string
  customerName: string
  email: string
  phone: string
  fileName: string
  note: string
  wordCount: number
  sourceLanguage: string
  targetLanguage: string
  ratePerWord: number
  estimatedTotal: number
  status: 'new' | 'contacted' | 'completed'
  notificationStatus: 'sent' | 'smtp_not_configured' | 'failed'
  createdAt: string
}
type Settings = {
  settings: { notificationEmail: string }
  rates: Rate[]
  languages: Language[]
  smtpConfigured: boolean
}

const app = document.querySelector<HTMLDivElement>('#app')!
const languageNames = new Intl.DisplayNames(['tr'], { type: 'language' })
let token = sessionStorage.getItem('guven-admin-token') || ''
let settings: Settings | null = null
let quotes: Quote[] = []
let activePanel: 'rates' | 'quotes' = 'rates'
let rateSearch = ''

function escapeHtml(value: unknown) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[character]!)
}

function displayLanguage(code: string, fallback?: string) {
  const localized = languageNames.of(code)
  if (localized && localized.toLocaleLowerCase('tr') !== code) return localized
  return fallback ?? settings?.languages.find((language) => language.code === code)?.name ?? code
}

async function api<T>(url: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers)
  if (token) headers.set('Authorization', `Bearer ${token}`)
  if (options.body && !(options.body instanceof FormData)) headers.set('Content-Type', 'application/json')
  const response = await fetch(url, { ...options, headers })
  const result = await response.json().catch(() => ({}))
  if (response.status === 401 && token) {
    token = ''
    sessionStorage.removeItem('guven-admin-token')
    showLogin('Oturumunuz sona erdi. Yeniden giriş yapın.')
  }
  if (!response.ok) throw new Error(result.error || 'İstek tamamlanamadı.')
  return result as T
}

function showLogin(message = '') {
  app.innerHTML = `
    <main class="admin-login-wrap">
      <form class="admin-login" id="admin-login-form">
        <a class="admin-brand" href="/" aria-label="Güven Tercüme ana sayfa"><img src="/guven-logo.svg" alt="Güven Tercüme" /></a>
        <p class="eyebrow">Yönetim alanı</p>
        <h1>Yönetici girişi</h1>
        <label>Yönetici parolası<input type="password" name="password" autocomplete="current-password" required autofocus /></label>
        <button class="admin-primary" type="submit">Giriş yap</button>
        <p class="admin-notice" id="login-message" role="status">${escapeHtml(message)}</p>
        <a class="back-link" href="/">← Siteye dön</a>
      </form>
    </main>
  `
  document.querySelector<HTMLFormElement>('#admin-login-form')!.addEventListener('submit', async (event) => {
    event.preventDefault()
    const form = event.currentTarget as HTMLFormElement
    const password = new FormData(form).get('password')
    const message = document.querySelector<HTMLParagraphElement>('#login-message')!
    message.textContent = 'Kontrol ediliyor...'
    try {
      const result = await api<{ token: string }>('/api/admin/login', {
        method: 'POST',
        body: JSON.stringify({ password }),
      })
      token = result.token
      sessionStorage.setItem('guven-admin-token', token)
      await loadDashboard()
    } catch (error) {
      message.textContent = error instanceof Error ? error.message : 'Giriş başarısız.'
      message.classList.add('error')
    }
  })
}

function renderRates() {
  if (!settings) return ''
  const filteredRates = settings.rates.filter((rate) => {
    const localizedName = displayLanguage(rate.code, rate.name)
    return `${localizedName} ${rate.name} ${rate.code}`.toLocaleLowerCase('tr').includes(rateSearch.toLocaleLowerCase('tr'))
  })
  return `
    <section class="admin-panel ${activePanel === 'rates' ? 'active' : ''}" id="rates-panel">
      <div class="panel-heading">
        <div><p class="eyebrow">Birim fiyatlar</p><h2>Dil tarifeleri</h2><p>Her dilin kaynak metin sözcüğü için TL tutarını belirleyin.</p></div>
        <button class="admin-primary" id="save-rates" type="button">Değişiklikleri kaydet</button>
      </div>
      <div class="settings-strip">
        <label>Yeni teklif bildirim e-postası<input id="notification-email" type="email" value="${escapeHtml(settings.settings.notificationEmail)}" required /></label>
        <div class="smtp-state ${settings.smtpConfigured ? 'ready' : 'missing'}"><span class="status-dot"></span>${settings.smtpConfigured ? 'SMTP e-posta gönderimi hazır' : 'SMTP ayarlı değil · talepler panele kaydedilir'}</div>
      </div>
      <div class="table-toolbar"><label class="search-field">Dil ara<input id="rate-search" type="search" placeholder="Örn. Türkçe, English, tr" value="${escapeHtml(rateSearch)}" /></label><span>${settings.rates.length} dil tarifesi</span></div>
      <div class="rate-table-wrap"><table class="rate-table"><thead><tr><th>Dil</th><th>Kod</th><th>TL / sözcük</th></tr></thead><tbody id="rate-rows">
        ${filteredRates.map((rate) => `
          <tr><td>${escapeHtml(displayLanguage(rate.code, rate.name))}</td><td><code>${escapeHtml(rate.code.toUpperCase())}</code></td><td><label class="rate-input"><span>₺</span><input type="number" min="0" max="100000" step="0.01" inputmode="decimal" aria-label="${escapeHtml(rate.name)} için TL sözcük ücreti" data-rate-code="${escapeHtml(rate.code)}" value="${rate.rate.toFixed(2)}" /></label></td></tr>
        `).join('')}
      </tbody></table></div>
      <p class="admin-notice" id="settings-message" role="status"></p>
    </section>
  `
}

function renderQuotes() {
  const statusLabels = { new: 'Yeni', contacted: 'İletişime geçildi', completed: 'Tamamlandı' }
  const mailLabels = { sent: 'E-posta gönderildi', smtp_not_configured: 'E-posta ayarlı değil', failed: 'E-posta gönderilemedi' }
  return `
    <section class="admin-panel ${activePanel === 'quotes' ? 'active' : ''}" id="quotes-panel">
      <div class="panel-heading">
        <div><p class="eyebrow">Müşteri talepleri</p><h2>Gelen teklifler</h2><p>Yüklenen belgeler saklanmaz; teklif ve iletişim bilgileri burada tutulur.</p></div>
        <button class="admin-secondary" id="refresh-quotes" type="button">Listeyi yenile</button>
      </div>
      ${quotes.length ? `<div class="quote-table-wrap"><table class="quote-table"><thead><tr><th>Talep / tarih</th><th>Müşteri</th><th>Dosya ve diller</th><th>Hesap</th><th>Bildirim</th><th>Durum</th><th></th></tr></thead><tbody>
        ${quotes.map((quote) => `
          <tr>
            <td><strong>${escapeHtml(quote.id.slice(0, 8).toUpperCase())}</strong><small>${escapeHtml(new Date(quote.createdAt).toLocaleString('tr-TR'))}</small></td>
            <td><strong>${escapeHtml(quote.customerName)}</strong><a href="mailto:${escapeHtml(quote.email)}">${escapeHtml(quote.email)}</a><a href="tel:${escapeHtml(quote.phone.replace(/[^+\d]/g, ''))}">${escapeHtml(quote.phone)}</a></td>
            <td><strong>${escapeHtml(quote.fileName)}</strong><small>${escapeHtml(displayLanguage(quote.sourceLanguage))} → ${escapeHtml(displayLanguage(quote.targetLanguage))}</small><small>${quote.wordCount.toLocaleString('tr-TR')} sözcük</small>${quote.note ? `<small class="quote-note">${escapeHtml(quote.note)}</small>` : ''}</td>
            <td><strong>${new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(quote.estimatedTotal)}</strong><small>${quote.ratePerWord.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} TL / sözcük</small></td>
            <td><span class="mail-state ${quote.notificationStatus}">${escapeHtml(mailLabels[quote.notificationStatus])}</span></td>
            <td><select class="quote-status" data-quote-id="${escapeHtml(quote.id)}" aria-label="Talep durumu">${Object.entries(statusLabels).map(([value, label]) => `<option value="${value}" ${quote.status === value ? 'selected' : ''}>${label}</option>`).join('')}</select></td>
            <td><button class="icon-button delete-quote" type="button" data-quote-id="${escapeHtml(quote.id)}" aria-label="Talebi sil" title="Talebi sil">×</button></td>
          </tr>
        `).join('')}
      </tbody></table></div>` : '<div class="empty-state"><span>0</span><h3>Henüz teklif yok</h3><p>Site üzerinden gönderilen talepler bu listede görünür.</p></div>'}
      <p class="admin-notice" id="quotes-message" role="status"></p>
    </section>
  `
}

function renderDashboard() {
  app.innerHTML = `
    <header class="admin-header">
      <a class="admin-brand" href="/" aria-label="Güven Tercüme ana sayfa"><img src="/guven-logo.svg" alt="Güven Tercüme" /></a>
      <div class="admin-header-actions"><span>Yönetim paneli</span><button class="admin-secondary" id="logout" type="button">Oturumu kapat</button></div>
    </header>
    <main class="admin-main">
      <div class="admin-intro"><p class="eyebrow">Güven Tercüme</p><h1>Teklif yönetimi</h1></div>
      <nav class="admin-tabs" aria-label="Yönetim bölümleri">
        <button type="button" data-panel="rates" class="${activePanel === 'rates' ? 'selected' : ''}">Dil tarifeleri <span>${settings?.rates.length ?? 0}</span></button>
        <button type="button" data-panel="quotes" class="${activePanel === 'quotes' ? 'selected' : ''}">Gelen teklifler <span>${quotes.length}</span></button>
      </nav>
      ${renderRates()}
      ${renderQuotes()}
    </main>
  `

  document.querySelector<HTMLButtonElement>('#logout')!.addEventListener('click', () => {
    token = ''
    sessionStorage.removeItem('guven-admin-token')
    showLogin()
  })
  document.querySelectorAll<HTMLButtonElement>('[data-panel]').forEach((button) => {
    button.addEventListener('click', () => {
      activePanel = button.dataset.panel as 'rates' | 'quotes'
      renderDashboard()
    })
  })
  document.querySelector<HTMLTableSectionElement>('#rate-rows')?.addEventListener('input', (event) => {
    const input = (event.target as HTMLElement).closest<HTMLInputElement>('[data-rate-code]')
    const rate = settings!.rates.find((entry) => entry.code === input?.dataset.rateCode)
    if (input && rate) rate.rate = input.value.trim() ? Number(input.value) : Number.NaN
  })
  document.querySelector<HTMLInputElement>('#rate-search')?.addEventListener('input', (event) => {
    document.querySelectorAll<HTMLInputElement>('[data-rate-code]').forEach((input) => {
      const rate = settings!.rates.find((entry) => entry.code === input.dataset.rateCode)
      if (rate) rate.rate = input.value.trim() ? Number(input.value) : Number.NaN
    })
    rateSearch = (event.currentTarget as HTMLInputElement).value
    const tableBody = document.querySelector<HTMLTableSectionElement>('#rate-rows')
    if (tableBody) {
      const filtered = settings!.rates.filter((rate) => {
        const name = displayLanguage(rate.code, rate.name)
        return `${name} ${rate.name} ${rate.code}`.toLocaleLowerCase('tr').includes(rateSearch.toLocaleLowerCase('tr'))
      })
      tableBody.innerHTML = filtered.map((rate) => `<tr><td>${escapeHtml(displayLanguage(rate.code, rate.name))}</td><td><code>${escapeHtml(rate.code.toUpperCase())}</code></td><td><label class="rate-input"><span>₺</span><input type="number" min="0" max="100000" step="0.01" inputmode="decimal" aria-label="${escapeHtml(rate.name)} için TL sözcük ücreti" data-rate-code="${escapeHtml(rate.code)}" value="${rate.rate.toFixed(2)}" /></label></td></tr>`).join('')
    }
  })
  document.querySelector<HTMLButtonElement>('#save-rates')?.addEventListener('click', () => void saveSettings())
  document.querySelector<HTMLButtonElement>('#refresh-quotes')?.addEventListener('click', () => void refreshQuotes())
  document.querySelector<HTMLTableSectionElement>('#quotes-panel tbody')?.addEventListener('change', (event) => {
    const select = (event.target as HTMLElement).closest<HTMLSelectElement>('.quote-status')
    if (select) void updateQuoteStatus(select.dataset.quoteId!, select.value as Quote['status'])
  })
  document.querySelector<HTMLTableSectionElement>('#quotes-panel tbody')?.addEventListener('click', (event) => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>('.delete-quote')
    if (button) void deleteQuote(button.dataset.quoteId!)
  })
}

async function saveSettings() {
  if (!settings) return
  const message = document.querySelector<HTMLParagraphElement>('#settings-message')!
  const inputs = document.querySelectorAll<HTMLInputElement>('[data-rate-code]')
  const rates = new Map(settings.rates.map((rate) => [rate.code, rate.rate]))
  inputs.forEach((input) => rates.set(input.dataset.rateCode!, input.value.trim() ? Number(input.value) : Number.NaN))
  const rateList = settings.rates.map((rate) => ({ ...rate, rate: rates.get(rate.code)! }))
  const invalidRate = rateList.find((rate) => !Number.isFinite(rate.rate) || rate.rate < 0)
  if (invalidRate) {
    message.textContent = `${displayLanguage(invalidRate.code, invalidRate.name)} için geçerli bir TL/sözcük tutarı girin.`
    message.className = 'admin-notice error'
    return
  }
  const notificationEmail = document.querySelector<HTMLInputElement>('#notification-email')!.value
  message.textContent = 'Kaydediliyor...'
  try {
    await api('/api/admin/settings', {
      method: 'PUT',
      body: JSON.stringify({ notificationEmail, rates: rateList }),
    })
    settings.rates = rateList
    settings.settings.notificationEmail = notificationEmail
    message.textContent = `${rateList.length} dil tarifesi ve bildirim adresi kaydedildi.`
    message.className = 'admin-notice success'
  } catch (error) {
    message.textContent = error instanceof Error ? error.message : 'Ayarlar kaydedilemedi.'
    message.className = 'admin-notice error'
  }
}

async function refreshQuotes() {
  try {
    quotes = await api<Quote[]>('/api/admin/quotes')
    renderDashboard()
  } catch (error) {
    const message = document.querySelector<HTMLParagraphElement>('#quotes-message')
    if (message) message.textContent = error instanceof Error ? error.message : 'Talepler yüklenemedi.'
  }
}

async function updateQuoteStatus(id: string, status: Quote['status']) {
  try {
    await api(`/api/admin/quotes/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    })
    const quote = quotes.find((entry) => entry.id === id)
    if (quote) quote.status = status
  } catch (error) {
    window.alert(error instanceof Error ? error.message : 'Durum güncellenemedi.')
  }
}

async function deleteQuote(id: string) {
  if (!window.confirm('Bu teklif kaydını kalıcı olarak silmek istiyor musunuz?')) return
  try {
    await api(`/api/admin/quotes/${encodeURIComponent(id)}`, { method: 'DELETE' })
    quotes = quotes.filter((quote) => quote.id !== id)
    renderDashboard()
  } catch (error) {
    window.alert(error instanceof Error ? error.message : 'Talep silinemedi.')
  }
}

async function loadDashboard() {
  try {
    ;[settings, quotes] = await Promise.all([
      api<Settings>('/api/admin/settings'),
      api<Quote[]>('/api/admin/quotes'),
    ])
    renderDashboard()
  } catch (error) {
    if (!token) return
    showLogin(error instanceof Error ? error.message : 'Yönetim paneli yüklenemedi.')
  }
}

if (token) void loadDashboard()
else showLogin()
