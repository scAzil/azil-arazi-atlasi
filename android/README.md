# AZiL Arazi Atlası Android — v0.1.0-beta.1

Bu klasör, [Windows Arazi Atlası v1.1.0](https://github.com/scAzil/azil-arazi-atlasi/releases/tag/v1.1.0) ile aynı depoda, ayrı bir **Android APK** projesidir. Electron uygulamasını telefona zorla taşımak yerine Android WebView + yerel dosya sistemi kullanır.

## İlk sürüm özellikleri

- Android 8.0 ve sonrası (API 26+) telefon ve tablet
- **İnternet olmadan** proje, nokta/ziyaret, not ve fotoğraf kaydetme
- Kullanıcı istediğinde **GPS konumu** alma (yalnızca ön plan izni)
- Tam ekran mobil Leaflet haritasında kayıt/ziyaret noktaları ve KML/GeoJSON vektör katmanları
- Çizgi rengi ve kalınlığı, poligon kenar/dolgu rengi ve **tam şeffaf iç dolgu**
- OpenStreetMap **isteğe bağlı**: kullanıcı açmadıkça tile isteği gönderilmez; harita indirme/prefetch yok
- **AZIL-ATLAS/1 ZIP dışa/içe aktarımı** ile Windows ↔ Android dosya transferi
- SHA-256 bütünlük kontrolü; aynı kimlikle farklı kayıt gelirse içe aktarma durur
- Android'in sistem dosya seçicisi (SAF): depolama izni istemez
- Hesap ve bulut eşitleme **yok**

## Önemli sınırlar

Bu ilk sürüm, Windows programının tam kopyası değildir. KML yalnızca temel nokta, çizgi ve poligon türleri için desteklenir. KMZ raster pafta, indekse göre görüntü kırpma, birleşik GeoTIFF, çevrimdışı harita paketi, ölçme/çizme araç seti ve QR üzerinden telefon→PC doğrudan aktarım sonraki aşamalar için planlanır. Dosya yoluyla taşınabilir arşiv mevcut aktarım yöntemidir.

- Android ZIP içe/dışa aktarımında en fazla **180 MB açılmış içerik** sınırı uygulanır.
- Windows v1.1.0, `sourcePlatform=desktop` ve `sourcePlatform=web` biçimlerini tanır. Android, **Windows uyumluluk profili** olarak `sourcePlatform=web` + `producer=azil-android` yazar. Bu kullanıcı verisi kaybı yaratmaz; gelecekte şemada doğrudan Android değeri desteklenebilir.
- Telefon fotoğrafları JPEG olarak yeniden kodlanır; orijinal EXIF konum bilgisi ZIP'e konmaz.
- **Android test APK'sı** GitHub Actions debug anahtarıyla imzalanır. Farklı derlemelerin imzası değişebileceği için sonraki kuruluma geçmeden ZIP dışa aktarın.
- İnternetten harita açıldığında tile sunucusunun görüntülenen alanın IP/harita isteklerini görmesi normaldir. Hassas koordinatlarda çevrimiçi altlığı açmayın.
- Uygulamayı silerken "verileri temizle" seçeneği yerel kayıtları kaldırabilir. Taşınabilir ZIP dosyası ile düzenli yedek alın.

## Derleme

GitHub `Actions` → `Build AZiL Arazi Atlası Android APK (beta)` → başarılı çalıştırma → `Artifacts` → Android APK paketini indirin.

Geliştirici için:
```bash
cd android
gradle :app:assembleDebug :app:testDebugUnitTest
```

AGP 8.9.2, Gradle 8.11.1, JDK 17 ve Android SDK 35 kullanılır. Android Studio'da `android/` klasörünü proje olarak açabilirsiniz.

Kod dalı: `feat/android-v0.1-offline-atlas`. Kullanıcı cihazında test edilmeden resmî Android Release yayımlanmayacaktır.

**Kamu ve veri güvenliği:** İş için yetkisiz, gizli/hizmete özel haritaları, fotoğrafları veya kişisel verileri herkese açık GitHub'a eklemeyin. Uygulama devlet kurumunun resmî yazılımı değildir.
