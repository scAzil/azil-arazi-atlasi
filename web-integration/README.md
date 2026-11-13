# AZIL-ATLAS/1 — Web sitesi entegrasyonu

**Durum:** Kaynak entegrasyon paketi hazır; `https://arazi-atlasi.chic-cabin-0509.chatgpt.site` üzerindeki canlı uygulamanın kendi kaynak projesine henüz uygulanmadı. `sbncifci.tr.gg/Arazi-Atlasi.htm` sayfası bir gömme kabuğu olduğu için buradan gömülü uygulamanın IndexedDB kayıtları okunamaz.

## Hazır dosyalar

- `atlas-standard.js`: Windows ile aynı taşınabilir arşiv başlığı ve çizim stili kuralları.
- `atlas-archive-adapter.js`: Yerel web verisini AZIL-ATLAS/1 ZIP'e yazma; Windows ZIP'ini okuyup **değişiklik yapmadan** sonucu döndürme.
- `../docs/AZIL-ATLAS-ARCHIVE-v1.md`: Ortak dosya ve veri şeması.

Bu dosyaları **web uygulamasının kendisine** ekleyin. Yalnızca tr.gg sayfasında ayrı bir `iframe` düğmesi oluşturmak güvenli depoya erişim sağlamaz.

## Web uygulamasının kaynak kodunda beklenen bağlantılar

Uygulama, kendi gerçek deposundan `getState()` ve `getAsset(ref)` benzeri çağrılar sağlayacak. Bu işlevler genel birer **entegrasyon sınırıdır**: mevcut web uygulamasında isimleri/şemaları farklı olabilir, bu dosya kendiliğinden onun kayıtlarına bağlanmaz.

```js
import {exportArchive,readArchive,downloadArchive} from './atlas-archive-adapter.js';

// Web uygulamasının gerçek veri modeli AZIL-ATLAS/1'e dönüştürüldükten sonra:
const state = await getCurrentAtlasSnapshotFromWebStore();
const blob = await exportArchive({
  state,
  appVersion: 'web',
  getAsset: ref => readIndexedDBAssetBlob(ref),
  fflate: window.fflate
});
downloadArchive(blob);

// Dosya seçildikten sonra (henüz hiçbir kaydı değiştirmez):
const candidate = await readArchive(selectedZipFile,{fflate:window.fflate});
showPreviewAndConfirm(candidate.manifest,candidate.state);
// Kullanıcı onay verirse, uygulamanın kendi transaction/import API'sinde
// kimlik çakışması ve ana nokta–ziyaret ilişkilerini doğrulayarak birleştir.
```

## Uygulama ilkeleri

1. Başlıklar/katmanlar/fotoğraflar yalnızca kullanıcının cihazında kalır. Hesap, bulut ve otomatik eşitleme eklemeyin.
2. Silinmiş kayıtları, eski yedekleri ve API anahtarlarını dışa aktarmayın.
3. İçe aktarmayı işlemsel yapın. Çakışmalar varsa önce kullanıcıya gösterin; üzerine yazma veya silme yok.
4. Her KML/GeoJSON katmanında `normalizeLayerStyle` ve `geometryStyle` ile nokta, çizgi, poligon ayarlarını ayrı gösterin. `fillOpacity=0` saydam alandır.
5. Büyük ZIP'ler için tarayıcı belleği sınırlıdır; adaptör beta sürümde 180 MB sınırı uygular. 200 MB üstü pafta arşivlerini Windows'ta oluşturmak daha güvenlidir.
6. Mevcut web site kayıtlarını tarayıcı depolamasından taşırken önce yerel dışa aktarma / manuel güvenli kopya oluşturun.
