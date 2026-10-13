import './admin.css'
import { initAuth } from './lib/auth.ts'
import { mountAuthMenu } from './auth-ui.ts'

// Yönetim ve hesap sayfaları için ortak üst bar; içerik #page-view içinde çizilir.
export function renderShell(label: string) {
  document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
    <header class="admin-header">
      <a class="admin-brand" href="/" aria-label="Güven Tercüme ana sayfa"><img src="/guven-logo.svg" alt="Güven Tercüme" /></a>
      <div class="admin-header-actions"><span>${label}</span><a class="admin-secondary" href="/">Siteye dön</a><div id="auth-slot"></div></div>
    </header>
    <main class="admin-main" id="page-view"></main>`
  mountAuthMenu(document.querySelector<HTMLElement>('#auth-slot')!)
  void initAuth()
  return document.querySelector<HTMLElement>('#page-view')!
}
