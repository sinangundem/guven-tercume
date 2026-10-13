import './style.css'
import { initAuth } from './lib/auth.ts'
import { mountAuthMenu } from './auth-ui.ts'

function renderHome() {
document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
  <header class="site-header">
    <a class="brand" href="#top" aria-label="Güven Tercüme ana sayfa">
      <img class="brand-logo" src="/guven-logo.svg" alt="Güven Tercüme" />
      <span>
        <strong>Güven Tercüme</strong>
        <small>40 yıllık tecrübe</small>
      </span>
    </a>
    <nav class="nav" aria-label="Ana menü">
      <a href="#hizmetler">Hizmetler</a>
      <a href="#surec">Süreç</a>
      <a href="#fiyat">Fiyat</a>
      <a href="#sss">SSS</a>
      <a href="#iletisim">İletişim</a>
    </nav>
    <div class="header-actions">
      <a class="header-cta" href="tel:+902123438065">Hemen ara</a>
      <div id="auth-slot"></div>
    </div>
  </header>

  <main id="top">
    <section class="hero-section">
      <div class="hero-copy">
        <p class="eyebrow">Yeminli ve noter onaylı tercüme bürosu</p>
        <h1>Resmi belgeleriniz için hızlı, güvenilir ve takip edilen tercüme.</h1>
        <p class="lead">
          Güven Tercüme, uzman yeminli tercüman kadrosuyla noter, apostil, konsolosluk,
          eğitim ve şirket evraklarınız için baştan sona kontrollü çeviri hizmeti sunar.
        </p>
        <div class="hero-actions">
          <a class="primary-button" href="#teklif">Teklif al</a>
          <a class="secondary-button" href="https://wa.me/905335193017" target="_blank" rel="noreferrer">WhatsApp</a>
        </div>
        <div class="trust-row" aria-label="Güven göstergeleri">
          <span>40 yıl deneyim</span>
          <span>Noter ve apostil takibi</span>
          <span>Türkiye geneli teslimat</span>
        </div>
      </div>

      <aside class="quote-card" id="teklif" aria-label="Belge yükleme ve fiyat hesaplama">
        <div class="quote-card-heading">
          <div>
            <p class="eyebrow">Anında fiyat hesabı</p>
            <h2>Belgeni yükle</h2>
          </div>
          <span class="secure-mark" aria-label="Gizlilik">GİZLİ</span>
        </div>
        <p>Dosyadaki sözcükleri sayalım, dili tahmin edelim ve yaklaşık fiyatı gösterelim.</p>
        <form id="estimate-form">
          <label class="upload-label" for="document-file">
            <span class="upload-icon" aria-hidden="true">↑</span>
            <strong>Belge seç veya buraya bırak</strong>
            <small>PDF, DOCX, TXT veya fotoğraf (JPG, PNG, WEBP)</small>
            <input id="document-file" type="file" name="document" accept=".pdf,.docx,.txt,.jpg,.jpeg,.png,.webp,.bmp,image/*,application/pdf,text/plain,application/vnd.openxmlformats-officedocument.wordprocessingml.document" />
          </label>
          <p class="file-status" id="file-status" role="status">Dosya analiz edildiğinde sözcük sayısı burada görünür.</p>
          <div class="language-fields">
            <label>
              Kaynak dil
              <select id="source-language" name="sourceLanguage" required disabled>
                <option value="">Önce belge yükleyin</option>
              </select>
            </label>
            <label>
              Hedef dil
              <select id="target-language" name="targetLanguage" required disabled>
                <option value="">Hedef dil seçin</option>
              </select>
            </label>
          </div>
          <div class="estimate-result" aria-live="polite">
            <span id="word-count">Sözcük sayısı: -</span>
            <strong id="estimate-total">Tahmini tutar: -</strong>
            <small id="estimate-note">Fiyatı görmek için ücretsiz hesap gerekir.</small>
            <button type="button" id="unlock-price" class="unlock-price" hidden>Fiyatı görmek için ücretsiz kayıt ol</button>
          </div>
          <div class="contact-fields">
            <label>
              Ad Soyad
              <input type="text" name="customerName" autocomplete="name" placeholder="Adınız Soyadınız" required maxlength="140" />
            </label>
            <label>
              E-posta
              <input type="email" name="email" autocomplete="email" placeholder="ornek@eposta.com" required maxlength="180" />
            </label>
            <label>
              Telefon
              <input type="tel" name="phone" autocomplete="tel" placeholder="05xx xxx xx xx" required minlength="10" maxlength="24" />
            </label>
            <label>
              Not <span class="optional-label">İsteğe bağlı</span>
              <textarea name="note" rows="2" placeholder="Teslim tarihi veya onay ihtiyacı"></textarea>
            </label>
          </div>
          <label class="consent-label">
            <input type="checkbox" name="privacyConsent" required />
            <span>Teklif talebim için iletişim bilgilerimin kullanılmasını kabul ediyorum.</span>
          </label>
          <button type="submit" id="quote-submit" disabled>Teklif talebi gönder</button>
          <small class="form-note">Belgeniz tarayıcınızda okunur, sunucuya yüklenmez. Teklif talebi için ücretsiz hesap gerekir; talep ve iletişim bilgileriniz teklif takibi için kaydedilir.</small>
          <p class="form-message" id="form-message" role="status"></p>
        </form>
      </aside>
    </section>

    <section class="stats-band" aria-label="Öne çıkanlar">
      <div><strong>70+</strong><span>Dil çifti</span></div>
      <div><strong>24 saat</strong><span>Acil teslim seçeneği</span></div>
      <div><strong>40 yıl</strong><span>Büro deneyimi</span></div>
      <div><strong>Gizli</strong><span>Belge işleme süreci</span></div>
    </section>

    <section class="section intro-section">
      <div>
        <p class="eyebrow">Güven Tercüme Bürosu</p>
        <h2>Başvurularınızın reddedilmemesi için doğru format, doğru onay, doğru teslim.</h2>
      </div>
      <p>
        Doğum belgesi, diploma, transkript, mahkeme kararı, vekaletname, sözleşme,
        pasaport ve şirket evrakları gibi resmi belgeleriniz; kullanım amacına göre
        yeminli tercüme, noter onayı, apostil veya kargo teslimiyle hazırlanır.
      </p>
    </section>

    <section class="section" id="hizmetler">
      <div class="section-heading">
        <p class="eyebrow">Hizmetler</p>
        <h2>Tek seferlik belge çevirisinden sürekli kurumsal işlere kadar.</h2>
      </div>
      <div class="service-grid">
        <article>
          <span>01</span>
          <h3>Yeminli tercüme</h3>
          <p>Resmi kurumlara sunulacak belgeler, yeminli tercüman imzası ve kaşesiyle hazırlanır.</p>
        </article>
        <article>
          <span>02</span>
          <h3>Noter onaylı tercüme</h3>
          <p>Noter tasdiki gereken başvurularda tercüme, onay ve teslim süreci birlikte takip edilir.</p>
        </article>
        <article>
          <span>03</span>
          <h3>Apostil ve resmi takip</h3>
          <p>Kaymakamlık, valilik ve ilgili resmi süreçlerde belge takibi için yönlendirme sağlanır.</p>
        </article>
        <article>
          <span>04</span>
          <h3>Kurumsal tercüme</h3>
          <p>Sözleşme, teknik doküman, finansal rapor ve şirket evraklarında terminoloji tutarlılığı korunur.</p>
        </article>
      </div>
    </section>

    <section class="split-section" id="surec">
      <div class="visual-panel" role="img" aria-label="Belgeler üzerinde çalışan tercüme ekibi"></div>
      <div class="process-panel">
        <p class="eyebrow">Nasıl çalışır?</p>
        <h2>Belgenizi gönderin, gereksinimi netleştirelim, teslimi takip edelim.</h2>
        <ol class="steps">
          <li><strong>Belge analizi</strong><span>Kurum, ülke, dil çifti ve onay ihtiyacı belirlenir.</span></li>
          <li><strong>Net fiyat ve süre</strong><span>Sayfa yoğunluğu, terminoloji ve aciliyete göre teklif verilir.</span></li>
          <li><strong>Çeviri ve kontrol</strong><span>Yeminli tercüman çevirir; biçim, isimler ve kritik alanlar kontrol edilir.</span></li>
          <li><strong>Onay ve teslim</strong><span>Dijital kopya, noter onayı veya kargo teslimi ihtiyaca göre hazırlanır.</span></li>
        </ol>
      </div>
    </section>

    <section class="section price-section" id="fiyat">
      <div class="section-heading">
        <p class="eyebrow">Fiyatlandırma</p>
        <h2>Fiyat; belge türü, dil çifti, onay seviyesi ve teslim süresine göre belirlenir.</h2>
      </div>
      <div class="price-grid">
        <article>
          <h3>Standart belge</h3>
          <p>Kimlik, nüfus kayıt örneği, diploma, transkript ve benzeri kısa belgeler.</p>
          <a href="#teklif">Fiyat iste</a>
        </article>
        <article class="featured">
          <h3>Noter onaylı dosya</h3>
          <p>Noter tasdiki, apostil ihtimali ve kurum formatı birlikte değerlendirilir.</p>
          <a href="#teklif">Öncelikli teklif al</a>
        </article>
        <article>
          <h3>Kurumsal iş</h3>
          <p>Sözleşme, teknik belge ve çok sayfalı dosyalarda proje bazlı fiyatlandırma yapılır.</p>
          <a href="#iletisim">Görüşme planla</a>
        </article>
      </div>
    </section>

    <section class="section testimonials">
      <div class="section-heading">
        <p class="eyebrow">Müşteri deneyimi</p>
        <h2>Zamanı kritik evraklarda net iletişim ve temiz teslim.</h2>
      </div>
      <div class="testimonial-grid">
        <blockquote>“Konsolosluk dosyam için hem yeminli çeviri hem noter süreci hızlı tamamlandı.”<cite>Vize başvurusu</cite></blockquote>
        <blockquote>“Şirket sözleşmelerinde terminoloji tutarlıydı, revizyon süreci çok rahattı.”<cite>Kurumsal müşteri</cite></blockquote>
        <blockquote>“Diploma ve transkript çevirimi kargo ile zamanında teslim aldım.”<cite>Akademik başvuru</cite></blockquote>
      </div>
    </section>

    <section class="section faq-section" id="sss">
      <div class="section-heading">
        <p class="eyebrow">Sıkça sorulan sorular</p>
        <h2>Başlamadan önce bilmeniz gerekenler.</h2>
      </div>
      <div class="faq-list">
        <details open>
          <summary>Yeminli tercüme ile noter onaylı tercüme aynı şey mi?</summary>
          <p>Hayır. Yeminli tercüme, yeminli tercümanın imza ve kaşesini içerir. Noter onayı gerekiyorsa ayrıca noter tasdiki yapılır.</p>
        </details>
        <details>
          <summary>Belgemi online gönderebilir miyim?</summary>
          <p>Evet. Belgenizin taramasını veya fotoğrafını göndererek fiyat ve süre bilgisi alabilirsiniz.</p>
        </details>
        <details>
          <summary>Acil çeviri mümkün mü?</summary>
          <p>Belge uzunluğu ve dil çiftine bağlı olarak aynı gün veya 24 saat içinde teslim seçenekleri değerlendirilebilir.</p>
        </details>
        <details>
          <summary>Hangi dillerde hizmet veriyorsunuz?</summary>
          <p>İngilizce, Almanca, Fransızca, Arapça, Rusça başta olmak üzere çok sayıda dil çiftinde destek verilir.</p>
        </details>
      </div>
    </section>

    <section class="contact-section" id="iletisim">
      <div>
        <p class="eyebrow">İletişim</p>
        <h2>Belgenizi gönderin, hangi onayın gerektiğini birlikte netleştirelim.</h2>
      </div>
      <div class="contact-actions">
        <a class="primary-button" href="tel:+902123438065">Telefonla ara</a>
        <a class="secondary-button" href="mailto:guventercume@hotmail.com">E-posta gönder</a>
      </div>
    </section>
  </main>

  <footer class="site-footer">
    <strong>Güven Tercüme Bürosu</strong>
    <span>Vatan Caddesi, Şadoğlu İşhanı No:18/2 D:8 Çağlayan - İstanbul | 0212 343 80 65</span>
  </footer>
`
}

const path = window.location.pathname.replace(/\/+$/, '') || '/'
if (path === '/admin') {
  void import('./admin.ts')
} else if (path === '/hesabim') {
  void import('./account.ts')
} else {
  renderHome()
  mountAuthMenu(document.querySelector<HTMLElement>('#auth-slot')!)
  void import('./estimate.ts')
  void initAuth()
}
