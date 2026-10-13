import './admin.css'
import { onAuthChange } from './lib/auth.ts'
import { openAuthDialog } from './auth-ui.ts'
import { isConfigured, supabase } from './lib/supabase.ts'
import { escapeHtml, formatMoney, formatRate } from './lib/format.ts'
import { languageLabel } from './lib/languages.ts'
import { renderShell } from './page-shell.ts'

type MyQuote = {
  id: string
  file_name: string
  word_count: number
  source_language: string
  target_language: string
  rate_per_word: number
  estimated_total: number
  status: 'new' | 'contacted' | 'completed'
  created_at: string
}

const view = renderShell('Hesabım')
let loadedFor: string | null = null
const statusLabels = { new: 'Alındı', contacted: 'İletişime geçildi', completed: 'Tamamlandı' }

function renderGate(message: string, withLogin = false) {
  view.innerHTML = `<div class="gate"><p class="eyebrow">Hesabım</p><h1>${escapeHtml(message)}</h1>${withLogin ? '<button class="admin-primary" type="button">Giriş yap</button>' : ''}</div>`
  view.querySelector('button')?.addEventListener('click', () => openAuthDialog())
}

async function load(userId: string, name: string) {
  const { data, error } = await supabase.from('quotes').select('*').eq('user_id', userId).order('created_at', { ascending: false })
  if (error) return renderGate(`Teklifler yüklenemedi: ${error.message}`)
  loadedFor = userId
  const quotes = data as MyQuote[]
  view.innerHTML = `
    <div class="admin-intro"><p class="eyebrow">Hoş geldiniz</p><h1>${escapeHtml(name)}</h1></div>
    <section class="admin-panel active">
      <div class="panel-heading"><div><p class="eyebrow">Geçmiş</p><h2>Tekliflerim</h2><p>Gönderdiğiniz teklif taleplerinin durumunu buradan izleyebilirsiniz.</p></div><a class="admin-primary" href="/#teklif">Yeni teklif al</a></div>
      ${quotes.length ? `<div class="quote-table-wrap"><table class="quote-table"><thead><tr><th>Talep / tarih</th><th>Dosya ve diller</th><th>Tahmini tutar</th><th>Durum</th></tr></thead><tbody>
        ${quotes.map((quote) => `<tr>
          <td><strong>${escapeHtml(quote.id.slice(0, 8).toUpperCase())}</strong><small>${escapeHtml(new Date(quote.created_at).toLocaleString('tr-TR'))}</small></td>
          <td><strong>${escapeHtml(quote.file_name)}</strong><small>${escapeHtml(languageLabel(quote.source_language))} → ${escapeHtml(languageLabel(quote.target_language))}</small><small>${quote.word_count.toLocaleString('tr-TR')} sözcük</small></td>
          <td><strong>${formatMoney(Number(quote.estimated_total))}</strong><small>${formatRate(Number(quote.rate_per_word))} TL / sözcük</small></td>
          <td><span class="status-pill ${quote.status}">${statusLabels[quote.status]}</span></td>
        </tr>`).join('')}</tbody></table></div>`
        : '<div class="empty-state"><span>0</span><h3>Henüz teklif talebiniz yok</h3><p>Belgenizi yükleyerek ilk teklifinizi alın.</p></div>'}
    </section>`
}

onAuthChange((state) => {
  if (!state.ready) return renderGate('Yükleniyor…')
  if (!isConfigured) return renderGate('Hesap sistemi henüz yapılandırılmadı.')
  if (!state.session) {
    loadedFor = null
    return renderGate('Tekliflerinizi görmek için giriş yapın', true)
  }
  if (loadedFor !== state.session.user.id) {
    void load(state.session.user.id, state.profile?.full_name || state.session.user.email || 'Hesabım')
  }
})
