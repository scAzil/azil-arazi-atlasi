# AZiL Arazi Atlası — Windows

Arazi, CBS, proje/ziyaret ve saha fotoğraflarını yerel arşivde birleştiren AZiL masaüstü uygulaması.

## Önceki kararlı sürüm

**[Arazi Atlası v1.0.3 — Windows x64](https://github.com/scAzil/azil-arazi-atlasi/releases/tag/v1.0.3)**

Bu sürüm kullanıcı verilerini `Arsiv` ve `Yedekler` klasörlerinde tutar. ZIP'i tamamen çıkarın; `Arazi Atlasi.exe` dosyasını `resources` klasöründen ayırmayın.

## v1.1.0 — Harita Çalışma Alanı ve Yardım Merkezi

**[v1.1.0 GitHub Release (Windows x64)](https://github.com/scAzil/azil-arazi-atlasi/releases/tag/v1.1.0)** · [Önceki v1.0.3](https://github.com/scAzil/azil-arazi-atlasi/releases/tag/v1.0.3)

Yenilikler:
- **Yardım Merkezi:** F1 ve üst Yardım menüsünden açılan çevrimdışı, aranabilir rehber; Program Hakkında, kullanım kılavuzu, sürüm notları, sorun giderme, yerel veri klasörleri, tanılama ve kısayollar.
- **Veri gizliliği:** Tanılama panoya yalnızca sürüm/sistem/nesne sayılarını kopyalar; koordinatlar, fotoğraflar, kayıt adları ve API anahtarları hariç tutulur. Arşiv sağlığı salt okunur denetlenir.
- **Açılış düzeltmesi (beta.3):** Beta.2'de kullanıcı arayüzünü durduran JavaScript sözdizimi hatası giderildi. Başlangıç hataları artık alt durum çubuğunda gösterilir; ayrıca Chromium ile açılış testi eklendi.
- **KML/KMZ çizim stili:** Nokta, çizgi ve poligonlar için ayrı renk/kalınlık ve dolgu seçenekleri. Alanın içini tamamen boş bırakmak için dolgu saydamlığı = 0.
- **Yerel arşiv standardı AZIL-ATLAS/1:** Güncel kayıtları, katmanları ve bağlı fotoğraf/paftaları SHA-256 doğrulamalı ZIP dosyasında dışa aktar ve güvenli biçimde yeniden içe aktar.
- **Eski yedekten dönme seçenekleri kaldırıldı:** Yedekten Geri Yükle, Harici Yedekten Dön, Eski AppData ve Değişiklik Geçmişi arayüzleri kaldırıldı; mevcut dosyalar silinmedi.
- **Hesap/bulut yok:** Arşiv dosyaları kullanıcının kendi cihazında kalır. Web için ortak dosya okuma/yazma modülleri hazır; canlı site uygulamasına henüz entegre edilmedi.
- **Harita pencerenin tamamını kullanır.** Normal menü, üst başlık ve durum çubuğu harita görünümünde gizlenir.
- Yüzen küçük kontrol çubuğu: **Çalışma alanı, Menü, Araçlar, Katmanlar, Bilgi, Tam ekran**. Paneller kapalı başlar; tek tuşla açılır. Windows F11 tam ekran desteklenir.
- Haritadaki nokta seçimi, katmanlar, pafta indeksi, KML/KMZ, mesafe/alan ölçümü, WGS84–UTM 37N koordinatları korunur.
- **Fotoğraf boyutu** tercihi: Orijinal, 1920 ve 1280 piksel. Yalnızca *yeni eklenen* fotoğraflar etkilenir.
- **Depolama durumu**: `Ayarlar → Depolama durumunu göster` ile yerel varlık dosyaları, JSON boyutu, yedek sayısı.
- **Telefon → PC QR aktarımı** yine tek yönlüdür; projeler, bağlı ziyaretler ve mevcut JSON yedekleri korunur.

### Önemli: arşiv yedeği

Bu geliştirme, yayımlanmış Windows **v1.0.3** paketinden geri çıkarılan Electron kaynak dosyalarını temel alır. Özgün `app.asar` üzerinden yalnızca değiştirilen kod dosyaları güncellenerek test paketi hazırlanır. Eski kaynak ZIP/Release korunur.

**Her sürüm geçişinde saha verilerinin tek kopyası üzerinde işlem yapmayın.** Önce mevcut `Arsiv` ve `Yedekler` klasörlerinizi başka bir konuma kopyalayın. Arşivler uygulama klasöründe olduğundan, yeni paketi başka klasöre açarsanız eski kayıtlar kendiliğinden gelmez. Veri klasörlerini taşımadan önce yedek alın.

Windows beta.4 sürümü kullanıcı tarafından test edildi; kararlı v1.1.0, yalnızca sürüm bilgisinin düzenlenmesiyle aynı işlevleri sunar. Windows derleme ve otomatik testler GitHub Actions üzerinde yürütülür.

## Ortak arşiv standardı

- [AZIL-ATLAS/1 dosya biçimi](docs/AZIL-ATLAS-ARCHIVE-v1.md)
- [Web entegrasyon dosyaları](web-integration/README.md) (henüz canlı siteye uygulanmadı)
- [Windows arşiv motoru](desktop-source/app/electron/portable-archive.cjs)

## Kaynaklar

- [Geri çıkarılan Electron kodu](desktop-source/app) (asıl çalışma dosyaları; paketlenmiş üçüncü taraf varlıkların tamamı bu depoda bulunmaz)
- [Windows v1.1 derleme iş akışı](.github/workflows/build-v1.1.yml)
- [Web Arazi Atlası](https://sbncifci.tr.gg/Arazi-Atlasi.htm)

Kurum içi gizli saha kayıtlarını, hizmete özel katmanları veya kişisel verileri herkese açık GitHub deposuna yüklemeyin. Repo yalnızca uygulama kodu içindir.
