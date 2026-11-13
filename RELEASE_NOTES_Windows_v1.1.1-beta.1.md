# AZiL Arazi Atlası v1.1.1-beta.1 — Windows x64 · Yerel Wi-Fi QR

**Ön sürüm / kullanıcı testi (pre-release).** Kararlı sürüm v1.1.0 erişilebilir kalır. Bu paket, Android v0.1.0-beta.3 ile birlikte kullanılmak üzere hazırlanmıştır.

## Neler değişti?
- **Aynı Wi-Fi / LAN üzerinden internetsiz telefon → bilgisayar QR aktarımı** eklendi. Windows **Telefondan aktar → QR bağlantısı oluştur** ekranında ilk QR kodu önerilir.
- **AES-256-GCM şifreleme:** Yerel aktarım QR'sındaki 256-bit oturum anahtarıyla kayıtlar ve fotoğraflar şifrelenir. Doğrudan bağlantıda internet servisi veya bulut arşivi kullanılmaz.
- **Kontrollü aktarım:** Telefon ana noktaları bağlı ziyaretlerden önce gönderir; Windows her kayıt için alındı yanıtı verir, telefon kayıtları otomatik silinmez.
- **Bağlantı tanılama:** Telefon PC'ye bağlanamıyorsa Wi-Fi, özel ağ ve Windows Güvenlik Duvarı ile ilgili hata gösterir.
- Önceki **internet/WebRTC QR seçeneği** ikinci seçenek olarak korunur. Bu yöntem bazı ağlarda bağlanmayabilir.
- Tam ekran harita, KML/KMZ katman stilleri, yerel arşiv ve Yardım Merkezi v1.1.0'daki gibi korunur.

## Kurulum
1. Windows ZIP'in **tamamını yeni ve yazılabilir bir klasöre** çıkarın. `Arazi Atlasi.exe` ile `resources` klasörünü ayırmayın.
2. Mevcut `Arsiv` ve `Yedekler` klasörlerini **silmeden, önce ayrı konuma yedekleyin**. Uygulama arşivi EXE yanında tutar; yeni klasöre otomatik taşımaz.
3. Android v0.1.0-beta.3 ile aynı güvenilir Wi-Fi/hotspot ağına bağlanın. Windows ekranındaki **ilk / Yerel ağ QR** kodunu Android'in **QR Aktar** ekranından tarayın.
4. Güvenlik duvarı izin sorarsa sadece **Özel ağ** iznini değerlendirin. Kamu kurumu tarafından yönetilen cihazlarda yetkisiz kural/izin değişikliği yapmayın.

## Sınırlar
- **Gerçek Android telefon ile Windows'un ağında uçtan uca bağlantı henüz doğrulanmamıştır.** CI testlerinde yerel şifreli alıcı, sıralama, hash/makbuz ve Windows uygulama açılışı doğrulandı; fiziksel ağ testinin yerini tutmaz.
- Aynı Wi-Fi, telefonun PC'nin yerel IPv4 adresine erişebildiği bir ağ anlamına gelir. Misafir Wi-Fi, istemci izolasyonu, VPN, kurumsal güvenlik duvarı engel olabilir.
- QR oturum anahtarını fotoğraflayıp paylaşmayın. Telefon → PC tek yönlü aktarım. Hesap/bulut eşitleme yoktur.
- Bu paket kod imzasıyla imzalanmamış test ZIP'idir. Resmî bir DSİ uygulaması değildir. Hizmete özel, kısıtlı veya kişisel saha verilerini herkese açık depolara göndermeyin.

## Otomatik test / kaynak
- [Windows derleme ve test #43367325787](https://github.com/scAzil/azil-arazi-atlasi/actions/runs/43367325787)
- [Android eş sürüm #43367279825](https://github.com/scAzil/azil-arazi-atlasi/actions/runs/43367279825)
- [Kaynak kodu / Android geliştirme PR #2](https://github.com/scAzil/azil-arazi-atlasi/pull/2)
