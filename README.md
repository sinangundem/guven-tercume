# Güven Tercüme

Vite + TypeScript arayüzü, Supabase (hesaplar, veritabanı, Google girişi) ve tek bir Vercel Function (`api/notify-quote.js`, e-posta bildirimi) ile çalışır.

## Nasıl çalışır

- Belge (PDF, DOCX, TXT, fotoğraf) **kullanıcının tarayıcısında** okunur; sözcük sayılır, dil tahmin edilir. Fotoğraflar tarayıcıda OCR ile okunur. Belge sunucuya gönderilmez.
- Fiyat, kaynak dilin tarifesiyle hesaplanır. Teklif gönderirken tutar veritabanında yeniden hesaplanır, tarayıcı tutarı belirleyemez.
- Teklif göndermek için hesap gerekir (Google veya e-posta/şifre). Yeni kayıtlar **yetkisizdir**; yönetici rolünü yalnızca bir yönetici verebilir.
- Yönetim paneli `/admin`, kullanıcı teklif geçmişi `/hesabim`. `/admin` yalnızca `admin` rolündeki hesaplara açılır; yetki kontrolü veritabanı satır güvenliği (RLS) ile zorunlu kılınır.

## Kurulum

1. **Supabase projesi** oluşturun (supabase.com). `Project Settings → API` içinden `Project URL`, `anon public` ve `service_role` anahtarlarını alın.
2. `SQL Editor` içinde [supabase/schema.sql](supabase/schema.sql) dosyasının tamamını çalıştırın (tablolar, güvenlik kuralları, 183 dil tarifesi).
3. **Google girişi**: Google Cloud Console → OAuth istemcisi (Web). Yetkili yönlendirme URI'si: `https://PROJE-ID.supabase.co/auth/v1/callback`. İstemci kimliği ve gizli anahtarını Supabase `Authentication → Providers → Google` bölümüne girin.
4. Supabase `Authentication → URL Configuration`: `Site URL` olarak site adresinizi (örn. `https://www.guventercume.com`), `Redirect URLs` olarak ayrıca `https://www.guventercume.com/**`, Vercel önizleme adresinizi ve `http://localhost:5173/**` adreslerini ekleyin.
5. **Vercel** `Settings → Environment Variables` içine [.env.example](.env.example) değişkenlerini ekleyin (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`; e-posta için `SMTP_*`). `service_role` anahtarı gizlidir; `VITE_` önekiyle eklemeyin. Değişkenleri ekledikten sonra yeniden deploy edin.
6. **İlk yönetici**: Sitede kendi hesabınızla bir kez kayıt olun/giriş yapın, sonra SQL Editor'de çalıştırın:

   ```sql
   update public.profiles set role = 'admin' where email = 'SIZIN-EPOSTANIZ';
   ```

   Sonraki yöneticileri `/admin → Kullanıcılar` sekmesinden atayabilirsiniz.
7. Yönetim panelinde dil tarifelerini ve bildirim e-posta adresini ayarlayın. Başlangıç değeri tüm diller için 2,50 TL/sözcüktür.

Vercel'de Framework Preset `Vite`, Build Command `npm run build`, Output Directory `dist` olmalıdır. [vercel.json](vercel.json) `/admin` ve `/hesabim` adreslerinin 404 vermemesini sağlar.

## Yerel çalışma

```powershell
npm install
Copy-Item .env.example .env.local   # değerleri doldurun
npm run dev
```

`npm run dev` hem siteyi hem `/api/notify-quote` işlevini çalıştırır.

## Notlar

- E-posta bildirimi için SMTP bilgisi gerekir; yoksa talepler yine yönetim panelinde görünür.
- Metin katmanı olmayan taranmış PDF okunamaz; sayfanın fotoğrafını yükleyin. Fotoğraf OCR'ı Tesseract'ın desteklediği dillerde çalışır ve kullanıcı belge dilini seçmelidir. İlk okumada dil verisi internetten indirilir.
- Teklif kayıtları müşteri iletişim bilgisi içerir; KVKK aydınlatma metni ve saklama süresini belirleyin.
- Eski sürümdeki yönetici parolası ve Express sunucusu kaldırıldı; geçerli tek yönetim yolu rol tabanlı hesaplardır.

## İletişim bilgileri

- Telefon: `0212 343 80 65` · GSM/WhatsApp: `0533 519 30 17`
- E-posta: `guventercume@hotmail.com`
- Adres: Vatan Caddesi, Şadoğlu İşhanı No:18/2 D:8 Çağlayan - İstanbul
