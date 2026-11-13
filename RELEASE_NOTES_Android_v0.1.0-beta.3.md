# AZiL Arazi Atlası Android v0.1.0-beta.3 · Yerel QR

**Ön sürüm / kullanıcı testi (pre-release)**. Android 8.0 (API 26) ve üzeri telefon ve tabletler için APK. Google Play yayını değildir.

## Neler var?
- Çevrimdışı **proje, nokta, bağlı ziyaret, not ve fotoğraf** kaydı; konum izinli GPS.
- Yerel Leaflet haritasında kayıt/ziyaret, temel KML ve GeoJSON; nokta/çizgi/poligon renk ve dolgu saydamlık ayarları.
- **Windows v1.1.1-beta.1'in ilk / Yerel Wi-Fi QR koduyla doğrudan bağlantı.** İnternet gerektirmez; Windows ile aynı Wi-Fi/hotspot ağında olması gerekir.
- Telefon → Windows aktarımı **AES-256-GCM ile şifreli**, fotoğraflar dâhil; ana nokta ziyaretinden önce gönderilir ve her kayıt için Windows'tan makbuz beklenir.
- Windows v1.1.0'ın eski **internet/WebRTC QR** yöntemi alternatif olarak korunur, ancak bazı ağlarda bağlanamayabilir.
- **AZIL-ATLAS/1 ZIP** ile Android ↔ Windows dosya düzeyinde arşiv taşıma; hesap ve bulut eşitleme yok.

## Kurulum ve ilk test
1. **Önce mevcut Android arşivini `AZIL-ATLAS/1` ZIP olarak dışa aktarın.** GitHub Actions test APK'sı geçici debug imzasıyla üretilir; önceki beta üzerine kurulmayabilir. Uygulamayı kaldırırsanız yerel kayıtlar silinebilir.
2. APK'yi Android'e kurun. Yalnızca resmî GitHub Release ve SHA256SUMS.txt kaynağını kullanın.
3. Windows v1.1.1-beta.1'i yeni klasörde açın. Bilgisayar ve telefon aynı güvenilir Wi-Fi'de olmalı.
4. Windows: **Telefondan aktar → QR bağlantısı oluştur** (ilk / Yerel ağ QR). Android: **QR Aktar → Windows QR kodunu oku**.
5. **“Bilgisayara yerel ağdan bağlandı”** mesajını görürsen önce tek bir örnek kayıt gönderin. Sonucu Windows kayıtlarında doğrulayın.

## Bilinen sınırlamalar
- **Gerçek fiziksel telefon/PC eşleşmesi henüz doğrulanmadı.** Android derleme, mobil arayüz, yerel QR yönlendirme, kayıt/fotoğraf protokolü ve şifreli yerel Windows alıcısının otomatik testleri başarılıdır.
- Windows Güvenlik Duvarı, misafir Wi-Fi cihaz izolasyonu, VPN veya farklı ağ segmentleri bağlantıyı engelleyebilir. Yönetilen kurumsal ağlarda güvenlik ayarlarını izinsiz değiştirmeyin.
- Büyük KMZ raster, ECW/COG/GeoTIFF, çevrimdışı harita karo paketi bu Android betada yok. Temel KML/GeoJSON dosyası azami 3 MB; ZIP aktarımı açılmış veride 180 MB sınırına tabidir.
- Telefon → PC QR aktarımı tek yönlüdür. Yerel cihaz verilerinin tek kopyasını üzerinde test etmeyin; düzenli ZIP yedeği alın.
- Resmî bir DSİ uygulaması değildir; kuruma özel saha verileri, kişisel fotoğraflar ve koordinatları açık GitHub'a eklemeyin.

## Otomatik test / kaynak
- [Android APK derleme ve test #43367279825](https://github.com/scAzil/azil-arazi-atlasi/actions/runs/43367279825)
- [Windows eş sürüm #43367325787](https://github.com/scAzil/azil-arazi-atlasi/actions/runs/43367325787)
- [Kaynak kodu / geliştirme PR #2](https://github.com/scAzil/azil-arazi-atlasi/pull/2)
