# AZiL Arazi Atlası v1.1.0 — Windows 10/11 x64

**Kararlı Windows sürümü.** v1.1.0-beta.4 sürümünün kullanıcı tarafından doğrulanan işlevleri temel alınmıştır. Kararlı sürümde yalnızca sürüm tanımları ve dağıtım bilgileri düzenlenmiş, harita/veri işleyişi değiştirilmemiştir.

## Başlıca yenilikler

- **Tam ekran harita çalışma alanı:** Harita uygulama penceresini doldurur. Menü, Araçlar, Katmanlar ve Bilgi panelleri ayrı açılıp gizlenebilir. F11 tam ekran desteklenir.
- **KML/KMZ çizim stilleri:** Noktalarda kenar/dolgu rengi ve büyüklük, çizgilerde renk/kalınlık/saydamlık, poligonlarda bağımsız sınır ve iç dolgu ayarları. Dolgu görünürlüğü `0` ile alanın içi boş bırakılabilir.
- **AZIL-ATLAS/1 taşınabilir arşiv:** Güncel proje, nokta, bağlı ziyaret, katman, fotoğraf ve paftaları SHA-256 doğrulamalı `.atlas.zip` dosyasına dışa aktarma; kimlik çakışmalarını kontrol ederek yerel içe aktarma.
- **Profesyonel Yardım Merkezi:** F1 ile çevrimdışı aranabilir Kullanım Kılavuzu, Program Hakkında, Sürüm Notları, Sorun Giderme, Verilerim Nerede, Tanılama Bilgileri ve Klavye Kısayolları.
- **Güvenli tanılama ve arşiv sağlık denetimi:** Özel verileri kopyalamadan teknik bilgiler; eksik ana nokta/ziyaret bağları ve bulunamayan varlıklar için salt okunur kontrol.
- **Fotoğraf boyutu:** Yeni eklenen fotoğraflarda Orijinal / 1920 / 1280 piksel seçenekleri. Depolama kullanımını özetleme.
- **Başlangıç düzeltmesi:** Beta.2’de “Arşiv açılıyor…” durumunda kalmaya neden olan arayüz hatası giderildi; açılış hataları görünür, gerçek Chromium başlangıç testi var.

## Kurulum

`Arazi-Atlasi-1.1.0-Windows-x64.zip` dosyasını **tamamını** yeni, yazılabilir bir klasöre çıkarın. `Arazi Atlasi.exe` dosyasını yanındaki `resources` klasörü ve DLL'lerden ayırmadan açın. Windows 10/11 64-bit içindir; kurulum veya kullanıcı hesabı gerektirmez.

**Veri güvenliği:** `Arsiv` ve `Yedekler` klasörleri uygulamanın yanında tutulur. Önceki kurulumdaki klasörleri silmeyin. Yeni klasöre çıkardığınızda eski arşiv kendiliğinden görünmez. Taşıma öncesinde her ikisini ayrı bir yere kopyalayın ve aktarımı doğrulayın.

## Kapsam ve sınırlamalar

- **Hesap ve bulut eşitleme yoktur**; veriler cihazda saklanır. Yalnızca güncel verileri taşıyan `AZIL-ATLAS/1` ZIP kullanılabilir.
- Geçmiş yedekten dönme/Eski AppData ile kurtarma arayüzleri kaldırıldı; fiziksel dosyalar otomatik silinmez.
- Telefon → PC QR aktarımı **tek yönlüdür**.
- Canlı web uygulaması, ortak arşiv formatına henüz bağlanmadı; GitHub'da web entegrasyon kodu hazır olmakla birlikte sitedeki işlevlerin değiştiği iddia edilmez.
- Çok büyük KMZ/paftalarda cihaz bellek sınırları uygulanabilir. `Arsiv` verileri gerçek test esnasında ayrı yedeklenmelidir.
- Program resmî bir DSİ yazılımı değildir. Kamu kurumlarına ait kısıtlı verileri, hassas koordinatları ve kişisel kayıtları açık depolara göndermeyin.
- Uygulama kod imzasıyla imzalanmamıştır; Windows güvenlik uyarılarını dikkatle değerlendirin. Yalnızca lisansına ve erişim hakkınıza uygun harita altlıkları kullanın.

## Doğrulama

Kararlı Windows paketi GitHub Actions üzerinde Node sözdizimi, gerçek Chromium ile başlangıç + Yardım Merkezi menüleri, KML/katman kontrolleri, taşınabilir ZIP oluşturma/aktarma (masaüstü ↔ web biçimi), SHA-256, gizlilik tanılaması ve ZIP bütünlüğü kontrollerinden geçirilmiştir.

Önceki resmî kararlı sürüm [v1.0.3](https://github.com/scAzil/azil-arazi-atlasi/releases/tag/v1.0.3) olarak erişilebilir kalır. Üçüncü taraf Electron/Chromium lisans metinleri paket içinde bulunur.
