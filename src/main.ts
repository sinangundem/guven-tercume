import './style.css'
document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
  <header class="site-header">
    <a class="brand" href="#top" aria-label="Güven Tercüme ana sayfa">
      <span class="brand-mark">GT</span>
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
    <a class="header-cta" href="tel:+902123438065">Hemen ara</a>
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

      <aside class="quote-card" id="teklif" aria-label="Hızlı teklif formu">
        <h2>Hızlı teklif isteyin</h2>
        <p>Belge türünü ve dil çiftini gönderin, en kısa sürede dönüş yapalım.</p>
        <form action="mailto:guventercume@hotmail.com" method="post" enctype="text/plain">
          <label>
            Ad Soyad
            <input type="text" name="name" autocomplete="name" placeholder="Adınız Soyadınız" />
          </label>
          <label>
            Telefon veya e-posta
            <input type="text" name="contact" autocomplete="email" placeholder="Size ulaşabileceğimiz bilgi" />
          </label>
          <label>
            Hizmet türü
            <select name="service">
              <option>Yeminli tercüme</option>
              <option>Noter onaylı tercüme</option>
              <option>Apostil takibi</option>
              <option>Kurumsal tercüme</option>
            </select>
          </label>
          <label>
            Kısa açıklama
            <textarea name="message" rows="4" placeholder="Belge türü, kaynak/hedef dil ve teslim tarihi"></textarea>
          </label>
          <button type="submit">Talep oluştur</button>
          <small>Talebiniz e-posta programınız üzerinden Güven Tercüme'ye iletilir. Belgeleriniz gizlilikle değerlendirilir.</small>
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
