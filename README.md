# Güven Tercüme

Vite + TypeScript arayüzü ve Express API'si olan tam yığın tercüme teklif uygulaması.

## Gereksinimler

- Node.js 22.12 veya üzeri
- SMTP bilgileri yalnızca otomatik e-posta gönderimi için gereklidir; SMTP kurulmasa da teklifler yönetim panelinde saklanır.

## Yerel kurulum

```powershell
npm install
Copy-Item .env.example .env
```

`.env` içinde uzun ve benzersiz bir `ADMIN_PASSWORD` belirleyin. E-posta bildirimi için `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` ve gerekirse `SMTP_FROM` alanlarını doldurun.

```powershell
npm run dev
```

Site `http://localhost:5173/`, yönetim paneli `http://localhost:5173/admin` adresindedir. Geliştirme sunucusu API'yi `localhost:3000` üzerinde çalıştırır ve arayüz isteklerini proxy eder.

`.env` oluşturmazsanız API yalnızca o çalıştırma için geçici yönetici parolası üretip terminale yazar. Node süreci yeniden başlayınca bu parola değişir; normal kullanımda `.env` tanımlayın.

## Teklif ve tarife özellikleri

- PDF (metin katmanı bulunan), DOCX ve TXT kabul edilir; tek dosya en fazla 10 MB ve PDF en fazla 500 sayfa olabilir.
- DOCX ve PDF içeriği bellekte analiz edilir. Belge içeriği diske kaydedilmez; tarife, dosya adı, sözcük sayısı, dil çifti ve müşterinin iletişim bilgileri saklanır.
- Taranmış/görüntü tabanlı PDF için OCR bu sürümde yoktur. Metin seçilebilir PDF kullanın; okunabilir metin yoksa uygulama yüklemeyi açıkça reddeder.
- Dil otomatik tahmin edilir; tahmin desteklenmiyorsa veya yanlışsa kullanıcı 183 dilden kaynak dili kendisi seçebilir.
- Fiyat kaynak dilin yönetici panelindeki TL/sözcük tarifesi × sözcük sayısıdır. Başlangıçtaki 2,50 TL değerleri örnek tarifedir; gerçek fiyatları yayına çıkmadan önce `/admin` içinden ayarlayın.
- Ad soyad, geçerli e-posta, telefon ve bilgilendirme onayı teklif göndermek için zorunludur.
- SMTP tanımlıysa bildirim yönetici panelinde girilen e-posta adresine gönderilir. SMTP yoksa veya gönderim başarısızsa teklif yine kaydedilir ve panelde durumu gösterilir.

## Üretim build ve çalıştırma

```powershell
npm ci
npm run build
npm start
```

Express, `dist/` sitesini ve API'yi aynı porttan sunar. Üretim sunucusunda `.env` tanımlayın ve Node uygulamasını PM2, systemd ya da hosting firmasının Node.js uygulama yöneticisi ile sürekli çalışır tutun. `server-data/store.json` uygulama tarafından oluşturulur; sunucunun bu klasöre yazma izni olmalı ve düzenli yedeği alınmalıdır.

Bu artık yalnızca statik site değildir. `dist/` içeriğini tek başına `public_html` içine yüklemek teklif API'sini, yönetici girişini ve depolamayı çalıştırmaz. Node.js uygulaması çalıştırabilen VPS veya hosting gerekir; cPanel kullanacaksanız hosting paketinde Node.js uygulaması desteğini doğrulayın. Netlify/Vercel'e statik yayın yapacaksanız ayrıca API'yi serverless işleve ve kalıcı depolamayı uygun veritabanına taşımanız gerekir.

Domaini, Node uygulaması ve HTTPS çalışır hale geldikten sonra hostingin verdiği A/CNAME veya nameserver değerleriyle yönlendirin. WHOIS ekinde mevcut nameserver'lar `W1.HOSTHANE.COM` ve `W2.HOSTHANE.COM` görünüyordu; mevcut Hosthane paketinin Node.js destekleyip desteklemediğini teyit edin.

## İletişim bilgileri

- Merkez telefon: `0212 343 80 65`
- GSM / WhatsApp: `0533 519 30 17`
- E-posta: `guventercume@hotmail.com`
- Adres: `Vatan Caddesi, Şadoğlu İşhanı No:18/2 D:8 Çağlayan - İstanbul`

Talep kayıtları müşteri iletişim bilgileri içerir. Yayına almadan önce KVKK bilgilendirme/metnini şirketinizin hukuk ve operasyon sürecine göre tamamlayın, erişimi sınırlayın ve saklama-silme süresi belirleyin. Yönetici parolası ve SMTP parolalarını Git'e eklemeyin.
