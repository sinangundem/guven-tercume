import './auth.css'
import {
  authErrorMessage, clearRecovery, onAuthChange, sendPasswordReset, signInWithGoogle, signInWithPassword,
  signOut, signUpWithPassword, updatePassword,
} from './lib/auth.ts'
import { isConfigured } from './lib/supabase.ts'
import { escapeHtml } from './lib/format.ts'
import { brandMarkup } from './lib/brand.ts'

type Mode = 'signin' | 'signup' | 'reset' | 'recovery'

const googleIcon = `<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5a5.6 5.6 0 0 1-2.4 3.6v3h3.9c2.3-2.1 3.5-5.2 3.5-8.8z"/><path fill="#34A853" d="M12 24c3.2 0 6-1.1 7.9-2.9l-3.9-3c-1.1.7-2.4 1.1-4 1.1-3.1 0-5.7-2.1-6.6-4.9H1.4v3.1A12 12 0 0 0 12 24z"/><path fill="#FBBC05" d="M5.4 14.3a7.2 7.2 0 0 1 0-4.6V6.6H1.4a12 12 0 0 0 0 10.8l4-3.1z"/><path fill="#EA4335" d="M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4A12 12 0 0 0 1.4 6.6l4 3.1C6.3 6.9 8.9 4.8 12 4.8z"/></svg>`

let dialog: HTMLDialogElement | null = null
let mode: Mode = 'signin'
let notice = ''

function ensureDialog() {
  if (dialog) return dialog
  dialog = document.createElement('dialog')
  dialog.className = 'auth-dialog'
  dialog.setAttribute('aria-labelledby', 'auth-title')
  document.body.append(dialog)
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) dialog!.close()
  })
  return dialog
}

function renderDialog() {
  const element = ensureDialog()
  const titles: Record<Mode, string> = {
    signin: 'Giriş yap', signup: 'Hesap oluştur', reset: 'Şifreni sıfırla', recovery: 'Yeni şifre belirle',
  }
  const showSocial = mode === 'signin' || mode === 'signup'
  element.innerHTML = `
    <div class="auth-panel">
      <button class="auth-close" type="button" data-close aria-label="Kapat">×</button>
      <a class="brand auth-logo" href="/" aria-label="Güven Tercüme">${brandMarkup()}</a>
      <h2 id="auth-title">${titles[mode]}</h2>
      ${notice ? `<p class="auth-notice">${escapeHtml(notice)}</p>` : ''}
      ${isConfigured ? '' : '<p class="auth-error">Hesap sistemi henüz yapılandırılmadı (Supabase anahtarları eksik).</p>'}
      ${showSocial ? `
        <button class="auth-google" type="button" data-google>${googleIcon}<span>Google ile devam et</span></button>
        <div class="auth-divider"><span>veya e-posta ile</span></div>` : ''}
      <form class="auth-form" novalidate>
        ${mode === 'signup' ? '<label>Ad Soyad<input name="fullName" type="text" autocomplete="name" required maxlength="140" /></label>' : ''}
        ${mode !== 'recovery' ? '<label>E-posta<input name="email" type="email" autocomplete="email" required maxlength="180" /></label>' : ''}
        ${mode === 'signin' || mode === 'signup' || mode === 'recovery' ? `<label>${mode === 'recovery' ? 'Yeni şifre' : 'Şifre'}<input name="password" type="password" autocomplete="${mode === 'signin' ? 'current-password' : 'new-password'}" required minlength="8" /></label>` : ''}
        <button class="auth-submit" type="submit">${mode === 'signin' ? 'Giriş yap' : mode === 'signup' ? 'Hesap oluştur' : mode === 'reset' ? 'Sıfırlama bağlantısı gönder' : 'Şifreyi kaydet'}</button>
        <p class="auth-error" role="alert" data-error></p>
      </form>
      <div class="auth-links">
        ${mode === 'signin' ? '<button type="button" data-mode="reset">Şifremi unuttum</button><button type="button" data-mode="signup">Hesap oluştur</button>' : ''}
        ${mode === 'signup' || mode === 'reset' ? '<button type="button" data-mode="signin">Zaten hesabım var</button>' : ''}
      </div>
    </div>`

  element.querySelector('[data-close]')!.addEventListener('click', () => element.close())
  element.querySelector('[data-google]')?.addEventListener('click', async () => {
    const { error } = await signInWithGoogle()
    if (error) showError(authErrorMessage(error.message))
  })
  element.querySelectorAll<HTMLButtonElement>('[data-mode]').forEach((button) => {
    button.addEventListener('click', () => {
      mode = button.dataset.mode as Mode
      notice = ''
      renderDialog()
    })
  })
  element.querySelector('form')!.addEventListener('submit', (event) => {
    event.preventDefault()
    void submitForm(event.currentTarget as HTMLFormElement)
  })
}

function showError(message: string) {
  const target = dialog?.querySelector<HTMLElement>('[data-error]')
  if (target) target.textContent = message
}

async function submitForm(form: HTMLFormElement) {
  const data = new FormData(form)
  const email = String(data.get('email') ?? '').trim()
  const password = String(data.get('password') ?? '')
  const submit = form.querySelector<HTMLButtonElement>('.auth-submit')!
  if (!form.checkValidity()) {
    form.reportValidity()
    return
  }
  submit.disabled = true
  showError('')
  try {
    if (mode === 'signin') {
      const { error } = await signInWithPassword(email, password)
      if (error) throw error
      dialog!.close()
    } else if (mode === 'signup') {
      const { data: result, error } = await signUpWithPassword(email, password, String(data.get('fullName') ?? '').trim())
      if (error) throw error
      if (result.session) dialog!.close()
      else {
        mode = 'signin'
        notice = 'Hesabınız oluşturuldu. E-postanıza gelen doğrulama bağlantısına tıklayıp giriş yapın.'
        renderDialog()
      }
    } else if (mode === 'reset') {
      const { error } = await sendPasswordReset(email)
      if (error) throw error
      mode = 'signin'
      notice = 'Şifre sıfırlama bağlantısı e-postanıza gönderildi.'
      renderDialog()
    } else {
      const { error } = await updatePassword(password)
      if (error) throw error
      clearRecovery()
      dialog!.close()
    }
  } catch (error) {
    showError(authErrorMessage(error instanceof Error ? error.message : 'İşlem tamamlanamadı.'))
  } finally {
    submit.disabled = false
  }
}

export function openAuthDialog(options: { mode?: Mode; message?: string } = {}) {
  mode = options.mode ?? 'signin'
  notice = options.message ?? ''
  renderDialog()
  if (!dialog!.open) dialog!.showModal()
}

export function mountAuthMenu(slot: HTMLElement) {
  onAuthChange((state) => {
    if (state.recovery) openAuthDialog({ mode: 'recovery' })
    if (!state.ready) {
      slot.innerHTML = ''
      return
    }
    if (!state.session) {
      slot.innerHTML = '<button class="auth-trigger" type="button">Giriş yap</button>'
      slot.querySelector('button')!.addEventListener('click', () => openAuthDialog())
      return
    }
    const name = state.profile?.full_name || state.session.user.email || 'Hesabım'
    const initial = name.trim().charAt(0).toLocaleUpperCase('tr')
    const avatar = state.profile?.avatar_url
    slot.innerHTML = `
      <details class="user-menu">
        <summary aria-label="Hesap menüsü">
          ${avatar ? `<img src="${escapeHtml(avatar)}" alt="" referrerpolicy="no-referrer" />` : `<span class="user-initial">${escapeHtml(initial)}</span>`}
          <span class="user-name">${escapeHtml(name)}</span>
        </summary>
        <div class="user-menu-list">
          <small>${escapeHtml(state.session.user.email ?? '')}</small>
          <a href="/hesabim">Tekliflerim</a>
          ${state.profile?.role === 'admin' ? '<a href="/admin">Yönetim paneli</a>' : ''}
          <button type="button" data-signout>Çıkış yap</button>
        </div>
      </details>`
    slot.querySelector('[data-signout]')!.addEventListener('click', async () => {
      await signOut()
      if (window.location.pathname !== '/') window.location.assign('/')
    })
  })
}
