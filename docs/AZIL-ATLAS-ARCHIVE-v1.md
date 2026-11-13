# AZIL-ATLAS/1 — Yerel Taşınabilir Arşiv Standardı

**Durum:** v1.1 beta taslağı; hesap/bulut gerektirmeyen, web ve Windows Arazi Atlası arasında aktarılabilir **güncel durum anlık görüntüsü**. Bu bir eski sürüme dönme sistemi değildir.

## Temel kararlar

1. Kullanıcı hesabı, kayıt/oturum açma veya sunucuya otomatik veri göndermesi yoktur. Cihazlar arası aktarım **kullanıcının kendi seçtiği ZIP dosyası** ile yapılır.
2. ZIP'in dosya adı `AZiL-Atlas-YYYY-MM-DD.atlas.zip`; veri UTF-8 JSON ve yerel varlık dosyalarıdır.
3. **Aktif** projeler, noktalar/ziyaretler, KML/KMZ/GeoJSON katmanlarının tanımları, mevcut fotoğraf ve pafta dosyaları dışa aktarılır. Çöp Kutusu, silinmiş projeler, eski sürüm geçmişi, aktarma fişleri ve geçmiş yedekler **aktarılmaz**.
4. **Özel ayarlar** (Esri API anahtarı, erişim anahtarları, oturum bilgileri) arşive konmaz. `settings` yalnızca `theme,font,dense,basemap,photoMax` alanlarını taşır.
5. İçeri aktarma mevcut aktif kayıtları **silmez**. Yeni kayıt ve katmanları kimliklerine göre ekler; aynı kimliğin farklı içerikle gelmesi durumunda güvenli biçimde durur. `parentId` ile ana nokta/ziyaret ilişkileri kontrol edilir.
6. Fotoğraf/pafta içerikleri `SHA-256` içeriğe bağlı dosya adlarıyla taşınır. Kayıt JSON ve her varlık arşiv içindeki doğrulama değeriyle denetlenir.
7. Koordinatlar WGS84 (`EPSG:4326`) ve ondalık derece enlem/boylamdır. UTM 37N gösterimi türetilir, ana kayıt koordinat sistemi değiştirilmez.
8. KML/GeoJSON katman çizim stilleri standardın parçasıdır; nokta, çizgi, poligon ayrı biçimlendirilir. Polygon `fillOpacity:0` tamamen boş iç dolgu demektir.
9. ZIP ve varlık boyutu sınırları uygulamaya göre açıkça belirtilir, sessizce veri kırpılmaz. Desktop beta içe aktarımı bellek sınırlı; dışa aktarma dosya akışıyla yapılır.
10. **Var olan dosyalar otomatik silinmez.** Eski yedekten dönme arayüzleri kaldırılmış olsa bile disk üzerindeki `Arsiv`, `Yedekler` ve `Cop_Kutusu` içeriği kendiliğinden temizlenmez.

## ZIP yapısı

```text
AZiL-Atlas-2026-11-13.atlas.zip
├── manifest.json
├── data/
│   └── state.json
└── assets/
    ├── <sha256>.jpg
    ├── <sha256>.png
    ├── <sha256>.webp
    ├── <sha256>.kmz
    └── <sha256>.json
```

`manifest.json`:

```json
{
  "format": "azil-atlas",
  "schemaVersion": 1,
  "kind": "snapshot",
  "createdAt": "2026-11-13T00:00:00.000Z",
  "sourcePlatform": "desktop",
  "appVersion": "1.1.0-beta.2",
  "crs": "EPSG:4326",
  "paths": { "state": "data/state.json" },
  "counts": { "projects": 1, "records": 1, "layers": 1, "assets": 0 },
  "assets": [],
  "checksums": {
    "data/state.json": "<SHA256-of-UTF-8-JSON>"
  }
}
```

`data/state.json`:

```json
{
  "version": 1,
  "projects": ["Örnek Proje"],
  "records": [{
    "id":"example-point-0001",
    "title":"Örnek Nokta",
    "project":"Örnek Proje",
    "date":"2026-11-13T00:00:00.000Z",
    "lat":36.30,
    "lon":36.35,
    "parentId":null,
    "type":"Akarsu",
    "note":"Örnek veri",
    "photos":[]
  }],
  "layers":[],
  "settings":{"theme":"light","font":15,"dense":false,"basemap":"osm","photoMax":"1920"}
}
```

Gerçek `assets` girdisi: `{"path":"assets/<hash>.jpg","sha256":"<hash>","size":12345,"mediaType":"image/jpeg"}`. `records[].photos[].ref` ve `layers[].ref`, aynı `<hash>.ext` adını kullanır.

## Katman stili (KML, KMZ ve GeoJSON)

Katmanın `style` alanı, farklı geometri türleri için ortak biçimi içerir:

```json
{
  "point": {"color":"#0055aa","fillColor":"#00aacc","radius":6,"weight":2,"opacity":1,"fillOpacity":0.8},
  "line": {"color":"#e45a25","weight":3,"opacity":1},
  "polygon": {"color":"#e45a25","weight":2,"opacity":1,"fillColor":"#a2d6b2","fillOpacity":0}
}
```

**İçi boş poligon:** `polygon.fillOpacity=0`. `polygon.opacity` yalnızca sınır çizgisinin saydamlığıdır. Tüm alanın tek renk olması gerekmez: dolgu ve dış çizgi birbirinden bağımsızdır.

## Windows ve web entegrasyonu

- Windows uygulaması: `electron/portable-archive.cjs` ve `app/atlas-standard.js`.
- Web uygulaması için bağımsız uygulama katmanı: `web-integration/atlas-archive-adapter.js`. Web, kendi IndexedDB / uygulama veri modelini `{projects,records,layers,settings}` biçimine dönüştürmeli; fotoğraf/pafta Blob'larını `getAsset(ref)` üzerinden vermeli ve doğrulanmış `readArchive(...)` sonucunu **kullanıcı onayı sonrası** mevcut deposuna birleştirmeli.
- **tr.gg** sayfası, farklı bir origin üzerindeki ChatGPT Sites web uygulamasını yalnızca gömüyor. Üst sayfaya eklenen JS, tarayıcının aynı-köken kuralı gereği gömülü uygulamanın yerel veri tabanına erişemez. Bu yüzden web entegrasyonu doğrudan gömülen uygulamanın kaynak projesinde yapılmalıdır; yalnızca tr.gg'de düğme eklemek veri aktarma işlevini gerçekleştirmez.

## Veri koruma

Bu dosyalar hassas saha koordinatları, fotoğraflar, kişisel notlar içerebilir. Kurumsal/hizmete özel verileri genel GitHub deposuna, herkese açık dosya paylaşımına veya üçüncü taraf servislere yüklemeyin. Arşiv şifreli **değildir**; dosyanın korunduğu depolama ortamından kullanıcı sorumludur.
