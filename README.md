# Güven Tercüme Web Sitesi

Güven Tercüme için hazırlanmış tek sayfalık, hızlı açılan Vite + TypeScript web sitesi.

## Geliştirme

```bash
npm install
npm run dev
```

Yerel önizleme varsayılan olarak `http://localhost:5173/` adresinde açılır.

## Üretim build

```bash
npm run build
```

Yayınlanacak statik dosyalar `dist/` klasöründe oluşur.

## Yayına alma seçenekleri

### 1. Netlify

1. Projeyi GitHub'a yükleyin.
2. Netlify'da `Add new site > Import an existing project` seçin.
3. Build command: `npm run build`
4. Publish directory: `dist`
5. Domain settings bölümünden `guventercume.com` ve `www.guventercume.com` ekleyin.
6. Domain sağlayıcısında Netlify'ın verdiği DNS kayıtlarını tanımlayın.

### 2. Vercel

1. Projeyi GitHub'a yükleyin.
2. Vercel'de yeni proje olarak import edin.
3. Framework preset: `Vite`
4. Build command: `npm run build`
5. Output directory: `dist`
6. Domains bölümünden `guventercume.com` ve `www.guventercume.com` ekleyin.
7. Vercel'in verdiği A/CNAME kayıtlarını domain DNS paneline girin.

### 3. Klasik hosting / cPanel

1. `npm run build` çalıştırın.
2. `dist/` içindeki tüm dosyaları hosting hesabındaki `public_html` klasörüne yükleyin.
3. Domain zaten bu hostinge yönlüyse site açılır. Değilse nameserver veya DNS kayıtlarını hosting firmasının verdiği değerlere çevirin.

## Domain DNS notu

WHOIS kaydına göre domain şu anda `W1.HOSTHANE.COM` ve `W2.HOSTHANE.COM` nameserver'larını kullanıyor. Aynı hosting ile devam edecekseniz genellikle sadece `dist/` dosyalarını `public_html` içine yüklemek yeterlidir. Netlify veya Vercel'e geçecekseniz DNS panelinde ilgili A/CNAME kayıtlarını yeni platformun verdiği değerlerle güncellemeniz gerekir.

## İletişim bilgileri

Mevcut sitedeki iletişim sayfasından alınan bilgiler sayfaya işlendi:

- Merkez telefon: `0212 343 80 65`
- Merkez GSM / WhatsApp: `0533 519 30 17`
- E-posta: `guventercume@hotmail.com`
- Adres: `Vatan Caddesi, Şadoğlu İşhanı No:18/2 D:8 Çağlayan - İstanbul`

Form şu anda `mailto:guventercume@hotmail.com` ile çalışır. Daha profesyonel kullanım için Netlify Forms, Formspree, özel backend API veya CRM entegrasyonu bağlanabilir.
