# Kısa bağlantı ve QR paylaşım kurulumu

GitHub Pages statik dosyaları yayımlar; kısa kodları kendi başına saklayamaz. Bu projedeki `worker.js`, Cloudflare Workers ve Workers KV ile kısa kodları saklar. Takvim, tarayıcıda AES-GCM ile şifrelenir. Worker yalnızca şifreli veriyi görür. Bağlantıyı alan herkes takvimi görüntüleyebilir; bağlantı bir erişim anahtarı gibi korunmalıdır. Kayıtlar bir yıl sonra otomatik silinir.

## Kurulum

1. Cloudflare hesabında **Workers & Pages** bölümünü aç.
2. **KV** bölümünde bir namespace oluştur. Örneğin adı `advent-calendar-shares` olsun.
3. Bir Worker oluştur, bu depodaki `worker.js` içeriğini yapıştır ve yayımla.
4. Worker ayarlarında **Bindings → KV namespace** ekle:
   - Variable name: `CALENDAR_SHARES`
   - Namespace: oluşturduğun namespace
5. Worker ayarlarında **Variables and Secrets** bölümüne `ALLOWED_ORIGINS` adlı değişken ekle:
   `https://melekkrkoc-coder.github.io,http://127.0.0.1:5500,http://localhost:5500`
6. Worker'ı yeniden yayımla. Cloudflare'ın verdiği `https://…workers.dev` adresini kopyala.
7. `share-config.js` içindeki boş değeri Worker adresiyle değiştir. Örnek:
   `window.ADVENT_SHARE_API = "https://advent-calendar-share.example.workers.dev";`
   Adresin sonuna `/api/shares` ekleme.
8. Değişikliği GitHub'a gönder. Pages yayımlandıktan sonra düzenle → paylaş akışında kısa bağlantı ve QR görünür.

## Gizlilik notu

Fotoğraflar ve yazılar linkin içine konmaz. Tarayıcı bunları önce şifreler; sunucu yalnızca şifreli veriyi ve rastgele kimliği saklar. Şifre çözme anahtarı URL'nin `#` bölümündedir; tarayıcı bu bölümü Worker'a göndermez. Ancak kısa bağlantının tamamına sahip olan herkes takvimi açabilir. Hassas bilgiler için kullanma. Worker kayıtları bir yıl sonunda siler; silme düğmesi henüz yoktur.

## Yerel çalışma

Yerel geliştirme adresin farklıysa `ALLOWED_ORIGINS` listesine o adresin origin'ini de ekle. Origin, yol içermez; ör. `http://127.0.0.1:5500`.
