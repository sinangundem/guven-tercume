import { getAuth, onAuthChange } from './lib/auth.ts'
import { openAuthDialog } from './auth-ui.ts'
import { isConfigured, supabase } from './lib/supabase.ts'
import { escapeHtml, formatMoney, formatRate } from './lib/format.ts'
import { languageLabel } from './lib/languages.ts'
import { renderShell } from './page-shell.ts'

type Rate = { code: string; name: string; rate: number }
type QuoteStatus = 'new' | 'contacted' | 'completed'
type Quote = {
  id: string
  customer_name: string
  email: string
  phone: string
  file_name: string
  note: string
  word_count: number
  source_language: string
  target_language: string
  rate_per_word: number
  estimated_total: number
  status: QuoteStatus
  notification_status: 'pending' | 'sent' | 'smtp_not_configured' | 'failed'
  created_at: string
}
type UserRow = { id: string; email: string | null; full_name: string | null; role: 'user' | 'admin'; created_at: string }
type Panel = 'rates' | 'quotes' | 'users'

const view = renderShell('Yönetim paneli')
let panel: Panel = 'rates'
let rates: Rate[] = []
let quotes: Quote[] = []
let users: UserRow[] = []
let notificationEmail = ''
let smtpConfigured = false
let rateSearch = ''
let loadedFor: string | null = null

const rateLabel = (rate: Rate) => languageLabel(rate.code, rate.name)
const rateRow = (rate: Rate) => `
  <tr>
    <td>${escapeHtml(rateLabel(rate))}</td>
    <td><code>${escapeHtml(rate.code.toUpperCase())}</code></td>
    <td><label class="rate-input"><span>₺</span><input type="number" min="0" max="100000" step="0.01" inputmode="decimal" aria-label="${escapeHtml(rateLabel(rate))} için TL sözcük ücreti" data-rate-code="${escapeHtml(rate.code)}" value="${Number.isFinite(rate.rate) ? rate.rate.toFixed(2) : ''}" /></label></td>
  </tr>`

const matchingRates = () => {
  const term = rateSearch.toLocaleLowerCase('tr')
  return rates.filter((rate) => `${rateLabel(rate)} ${rate.name} ${rate.code}`.toLocaleLowerCase('tr').includes(term))
}

function renderGate(message: string, action?: { label: string; run: () => void }) {
  view.innerHTML = `
    <div class="gate">
      <p class="eyebrow">Yönetim alanı</p>
      <h1>${escapeHtml(message)}</h1>
      ${action ? `<button class="admin-primary" type="button">${escapeHtml(action.label)}</button>` : ''}
    </div>`
  if (action) view.querySelector('button')!.addEventListener('click', action.run)
}

function renderRatesPanel() {
  return `
    <section class="admin-panel ${panel === 'rates' ? 'active' : ''}">
      <div class="panel-heading">
        <div><p class="eyebrow">Birim fiyatlar</p><h2>Dil tarifeleri</h2><p>Her dilin kaynak metin sözcüğü için TL tutarını belirleyin.</p></div>
        <button class="admin-primary" id="save-rates" type="button">Değişiklikleri kaydet</button>
      </div>
      <div class="settings-strip">
        <label>Yeni teklif bildirim e-postası<input id="notification-email" type="email" value="${escapeHtml(notificationEmail)}" required /></label>
        <div class="smtp-state ${smtpConfigured ? 'ready' : 'missing'}"><span class="status-dot"></span>${smtpConfigured ? 'SMTP e-posta gönderimi hazır' : 'SMTP ayarlı değil · talepler panele kaydedilir'}</div>
      </div>
      <div class="table-toolbar"><label class="search-field">Dil ara<input id="rate-search" type="search" placeholder="Örn. Türkçe, English, tr" value="${escapeHtml(rateSearch)}" /></label><span>${rates.length} dil tarifesi</span></div>
      <div class="rate-table-wrap"><table class="rate-table"><thead><tr><th>Dil</th><th>Kod</th><th>TL / sözcük</th></tr></thead><tbody id="rate-rows">${matchingRates().map(rateRow).join('')}</tbody></table></div>
      <p class="admin-notice" id="settings-message" role="status"></p>
    </section>`
}

function renderQuotesPanel() {
  const statusLabels: Record<QuoteStatus, string> = { new: 'Yeni', contacted: 'İletişime geçildi', completed: 'Tamamlandı' }
  const mailLabels = { pending: 'Bekliyor', sent: 'E-posta gönderildi', smtp_not_configured: 'E-posta ayarlı değil', failed: 'E-posta gönderilemedi' }
  const rows = quotes.map((quote) => `
    <tr>
      <td><strong>${escapeHtml(quote.id.slice(0, 8).toUpperCase())}</strong><small>${escapeHtml(new Date(quote.created_at).toLocaleString('tr-TR'))}</small></td>
      <td><strong>${escapeHtml(quote.customer_name)}</strong><a href="mailto:${escapeHtml(quote.email)}">${escapeHtml(quote.email)}</a><a href="tel:${escapeHtml(quote.phone.replace(/[^+\d]/g, ''))}">${escapeHtml(quote.phone)}</a></td>
      <td><strong>${escapeHtml(quote.file_name)}</strong><small>${escapeHtml(languageLabel(quote.source_language))} → ${escapeHtml(languageLabel(quote.target_language))}</small><small>${quote.word_count.toLocaleString('tr-TR')} sözcük</small>${quote.note ? `<small class="quote-note">${escapeHtml(quote.note)}</small>` : ''}</td>
      <td><strong>${formatMoney(Number(quote.estimated_total))}</strong><small>${formatRate(Number(quote.rate_per_word))} TL / sözcük</small></td>
      <td><span class="mail-state ${quote.notification_status}">${mailLabels[quote.notification_status]}</span></td>
      <td><select class="quote-status" data-quote-id="${escapeHtml(quote.id)}" aria-label="Talep durumu">${Object.entries(statusLabels).map(([value, label]) => `<option value="${value}" ${quote.status === value ? 'selected' : ''}>${label}</option>`).join('')}</select></td>
      <td><button class="icon-button delete-quote" type="button" data-quote-id="${escapeHtml(quote.id)}" aria-label="Talebi sil" title="Talebi sil">×</button></td>
    </tr>`).join('')
  return `
    <section class="admin-panel ${panel === 'quotes' ? 'active' : ''}">
      <div class="panel-heading">
        <div><p class="eyebrow">Müşteri talepleri</p><h2>Gelen teklifler</h2><p>Belge içeriği sunucuya gönderilmez; yalnızca teklif ve iletişim bilgileri saklanır.</p></div>
        <button class="admin-secondary" id="refresh-quotes" type="button">Listeyi yenile</button>
      </div>
      ${quotes.length
        ? `<div class="quote-table-wrap"><table class="quote-table"><thead><tr><th>Talep / tarih</th><th>Müşteri</th><th>Dosya ve diller</th><th>Hesap</th><th>Bildirim</th><th>Durum</th><th></th></tr></thead><tbody id="quote-rows">${rows}</tbody></table></div>`
        : '<div class="empty-state"><span>0</span><h3>Henüz teklif yok</h3><p>Siteden gönderilen talepler bu listede görünür.</p></div>'}
      <p class="admin-notice" id="quotes-message" role="status"></p>
    </section>`
}

function renderUsersPanel() {
  const me = getAuth().session?.user.id
  const rows = users.map((user) => `
    <tr>
      <td><strong>${escapeHtml(user.full_name || '—')}</strong><small>${escapeHtml(user.email ?? '')}</small></td>
      <td>${escapeHtml(new Date(user.created_at).toLocaleDateString('tr-TR'))}</td>
      <td><select class="quote-status" data-user-id="${escapeHtml(user.id)}" aria-label="Kullanıcı rolü" ${user.id === me ? 'disabled' : ''}>
        <option value="user" ${user.role === 'user' ? 'selected' : ''}>Kullanıcı</option>
        <option value="admin" ${user.role === 'admin' ? 'selected' : ''}>Yönetici</option>
      </select></td>
    </tr>`).join('')
  return `
    <section class="admin-panel ${panel === 'users' ? 'active' : ''}">
      <div class="panel-heading">
        <div><p class="eyebrow">Hesaplar</p><h2>Kullanıcılar</h2><p>Siteye Google veya e-posta ile kayıt olanlar varsayılan olarak yetkisizdir. Yönetici rolünü buradan verin.</p></div>
      </div>
      <div class="quote-table-wrap"><table class="quote-table users-table"><thead><tr><th>Kullanıcı</th><th>Kayıt tarihi</th><th>Rol</th></tr></thead><tbody id="user-rows">${rows}</tbody></table></div>
      <p class="admin-notice" id="users-message" role="status"></p>
    </section>`
}

function renderDashboard() {
  view.innerHTML = `
    <div class="admin-intro"><p class="eyebrow">Güven Tercüme</p><h1>Teklif yönetimi</h1></div>
    <nav class="admin-tabs" aria-label="Yönetim bölümleri">
      <button type="button" data-panel="rates" class="${panel === 'rates' ? 'selected' : ''}">Dil tarifeleri <span>${rates.length}</span></button>
      <button type="button" data-panel="quotes" class="${panel === 'quotes' ? 'selected' : ''}">Gelen teklifler <span>${quotes.length}</span></button>
      <button type="button" data-panel="users" class="${panel === 'users' ? 'selected' : ''}">Kullanıcılar <span>${users.length}</span></button>
    </nav>
    ${renderRatesPanel()}${renderQuotesPanel()}${renderUsersPanel()}`

  view.querySelectorAll<HTMLButtonElement>('[data-panel]').forEach((button) => {
    button.addEventListener('click', () => {
      panel = button.dataset.panel as Panel
      renderDashboard()
    })
  })

  view.querySelector('#rate-rows')!.addEventListener('input', (event) => {
    const input = (event.target as HTMLElement).closest<HTMLInputElement>('[data-rate-code]')
    const rate = rates.find((entry) => entry.code === input?.dataset.rateCode)
    if (input && rate) rate.rate = input.value.trim() ? Number(input.value) : Number.NaN
  })
  view.querySelector<HTMLInputElement>('#rate-search')!.addEventListener('input', (event) => {
    rateSearch = (event.currentTarget as HTMLInputElement).value
    view.querySelector('#rate-rows')!.innerHTML = matchingRates().map(rateRow).join('')
  })
  view.querySelector('#save-rates')!.addEventListener('click', () => void saveSettings())
  view.querySelector('#refresh-quotes')!.addEventListener('click', () => void refreshQuotes())

  view.querySelector('#quote-rows')?.addEventListener('change', (event) => {
    const select = (event.target as HTMLElement).closest<HTMLSelectElement>('.quote-status')
    if (select) void updateQuoteStatus(select.dataset.quoteId!, select.value as QuoteStatus)
  })
  view.querySelector('#quote-rows')?.addEventListener('click', (event) => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>('.delete-quote')
    if (button) void deleteQuote(button.dataset.quoteId!)
  })
  view.querySelector('#user-rows')!.addEventListener('change', (event) => {
    const select = (event.target as HTMLElement).closest<HTMLSelectElement>('[data-user-id]')
    if (select) void updateRole(select, select.dataset.userId!, select.value as 'user' | 'admin')
  })
}

function notice(selector: string, message: string, kind: 'success' | 'error' | '' = '') {
  const element = view.querySelector<HTMLElement>(selector)
  if (element) {
    element.textContent = message
    element.className = `admin-notice ${kind}`
  }
}

async function saveSettings() {
  const email = view.querySelector<HTMLInputElement>('#notification-email')!.value.trim()
  const invalid = rates.find((rate) => !Number.isFinite(rate.rate) || rate.rate < 0)
  if (invalid) return notice('#settings-message', `${rateLabel(invalid)} için geçerli bir TL/sözcük tutarı girin.`, 'error')
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return notice('#settings-message', 'Bildirim e-posta adresi geçerli olmalı.', 'error')
  notice('#settings-message', 'Kaydediliyor...')
  const [ratesResult, settingsResult] = await Promise.all([
    supabase.rpc('admin_save_rates', { items: rates.map(({ code, rate }) => ({ code, rate })) }),
    supabase.from('settings').update({ notification_email: email }).eq('id', true),
  ])
  const error = ratesResult.error ?? settingsResult.error
  if (error) return notice('#settings-message', error.message, 'error')
  notificationEmail = email
  notice('#settings-message', `${rates.length} dil tarifesi ve bildirim adresi kaydedildi.`, 'success')
}

async function refreshQuotes() {
  const { data, error } = await supabase.from('quotes').select('*').order('created_at', { ascending: false }).limit(500)
  if (error) return notice('#quotes-message', error.message, 'error')
  quotes = data as Quote[]
  renderDashboard()
}

async function updateQuoteStatus(id: string, status: QuoteStatus) {
  const { error } = await supabase.from('quotes').update({ status }).eq('id', id)
  if (error) return notice('#quotes-message', error.message, 'error')
  const quote = quotes.find((entry) => entry.id === id)
  if (quote) quote.status = status
}

async function deleteQuote(id: string) {
  if (!window.confirm('Bu teklif kaydını kalıcı olarak silmek istiyor musunuz?')) return
  const { error } = await supabase.from('quotes').delete().eq('id', id)
  if (error) return notice('#quotes-message', error.message, 'error')
  quotes = quotes.filter((quote) => quote.id !== id)
  renderDashboard()
}

async function updateRole(select: HTMLSelectElement, id: string, role: 'user' | 'admin') {
  const user = users.find((entry) => entry.id === id)
  const { error } = await supabase.rpc('admin_set_role', { target: id, new_role: role })
  if (error) {
    if (user) select.value = user.role
    return notice('#users-message', error.message, 'error')
  }
  if (user) user.role = role
  notice('#users-message', 'Rol güncellendi.', 'success')
}

async function loadDashboard(userId: string) {
  view.innerHTML = '<div class="gate"><p class="eyebrow">Yükleniyor…</p></div>'
  const [ratesResult, settingsResult, quotesResult, usersResult, smtp] = await Promise.all([
    supabase.from('rates').select('code,name,rate').order('name'),
    supabase.from('settings').select('notification_email').eq('id', true).maybeSingle(),
    supabase.from('quotes').select('*').order('created_at', { ascending: false }).limit(500),
    supabase.from('profiles').select('id,email,full_name,role,created_at').order('created_at', { ascending: false }),
    fetch('/api/notify-quote').then((response) => response.json()).catch(() => ({ smtpConfigured: false })),
  ])
  const error = ratesResult.error ?? settingsResult.error ?? quotesResult.error ?? usersResult.error
  if (error) return renderGate(`Veriler yüklenemedi: ${error.message}`)
  rates = (ratesResult.data ?? []).map((row) => ({ code: row.code, name: row.name, rate: Number(row.rate) }))
  notificationEmail = settingsResult.data?.notification_email ?? ''
  quotes = (quotesResult.data ?? []) as Quote[]
  users = (usersResult.data ?? []) as UserRow[]
  smtpConfigured = Boolean(smtp.smtpConfigured)
  loadedFor = userId
  renderDashboard()
}

onAuthChange((state) => {
  if (!state.ready) return renderGate('Yükleniyor…')
  if (!isConfigured) return renderGate('Hesap sistemi henüz yapılandırılmadı (Supabase anahtarları eksik).')
  if (!state.session) {
    loadedFor = null
    return renderGate('Yönetim paneli için giriş yapın', { label: 'Giriş yap', run: () => openAuthDialog() })
  }
  if (state.profile?.role !== 'admin') {
    loadedFor = null
    return renderGate('Bu alana erişim yetkiniz yok. Yönetici rolü gerekir.')
  }
  if (loadedFor !== state.session.user.id) void loadDashboard(state.session.user.id)
})
