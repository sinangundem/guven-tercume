import './admin.css'
import './modern-admin.css'
import { initAuth } from './lib/auth.ts'
import { mountAuthMenu } from './auth-ui.ts'
import { brandMarkup } from './lib/brand.ts'

// Yönetim ve hesap sayfaları için ortak üst bar; içerik #page-view içinde çizilir.
export function renderShell(label: string) {
  document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
    <header class="admin-header">
      <a class="brand" href="/" aria-label="Güven Tercüme ana sayfa">${brandMarkup()}</a>
      <div class="admin-header-actions"><span>${label}</span><a class="admin-secondary" href="/">Siteye dön</a><div id="auth-slot"></div></div>
    </header>
    <main class="admin-main" id="page-view"></main>`
  mountAuthMenu(document.querySelector<HTMLElement>('#auth-slot')!)
  void initAuth()
  return document.querySelector<HTMLElement>('#page-view')!
}
