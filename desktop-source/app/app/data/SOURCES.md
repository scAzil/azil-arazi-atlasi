# Arazi Atlası — hazır havza verileri

Kaynak alımı: **7 Ekim 2026**. Bu dosyalar tarihli gösterim kopyalarıdır; canlı su seviyesi, debi veya doluluk verisi değildir. Kaynak kurumların uygulamayı onayladığı anlamına gelmez.

## Havza sınırları — Tarım ve Orman Bakanlığı / SYGM

Kaynak: [Nehir Havza Yönetim Planları Durumu, katman 0](https://cbs1.tarimorman.gov.tr/server/rest/services/SYGM/nehir_havza_yonetim_planlari_durumu/MapServer/0).

Servisin `query` işlemi ile `where=1=1`, `outFields=HAVZA_ADI`, `outSR=4326`, `returnGeometry=true`, `maxAllowableOffset=0.001`, `geometryPrecision=5`, `f=geojson` parametreleri kullanılmıştır. 25 havza alınmıştır. Asi katmanı, `HAVZA_ADI=Asi` özelliğinin seçilmesidir. Planın ilerleme durumu ve alan istatistiği güncelliği ayrıca doğrulanmadığı için gösterilmez.

- `asi-turkiye.geojson`: 1 havza geometrisi; **Türkiye bölümü**, tüm sınır ötesi Asi havzası değil.
- `turkiye-havzalari.geojson`: 25 havza; genel bağlam için.
- Sınırlar kaynak servisten 0,001° genelleştirmeyle alınmıştır; detaylı mühendislik, mülkiyet, parsel veya aplikasyon sınırı olarak kullanılmaz.
- Serviste özel bir yeniden kullanım lisansı belirtilmemiştir. Resmî çalışma ve farklı kullanım amaçları için özgün kurum verisi ve koşulları esas alınmalıdır.

## Akarsular ve su yapıları — OpenStreetMap

**© OpenStreetMap contributors.** Kaynak: [OpenStreetMap](https://www.openstreetmap.org/copyright). Bu üç türetilmiş veri dosyası [Open Database License (ODbL) 1.0](https://opendatacommons.org/licenses/odbl/1-0/) kapsamındadır. Aynı lisans ve atıf korunarak indirilebilir ve yeniden kullanılabilir. Bu lisans uygulama koduna veya bağımsız kullanıcı saha kayıtlarına uygulanmaz.

Kamuya açık Overpass API üzerinden şu etiketler alınmıştır:

- `way[waterway=river]`: akarsu çizgileri.
- `way[waterway=dam]`: baraj gövdeleri.
- `way[water=reservoir]` ve `relation[water=reservoir]`: rezervuar/gölet su yüzeyleri.

Sorgu alanları (güney, batı, kuzey, doğu): `(35.75,35.75,37.35,37.05)` ve doğu uzantısını tamamlayan `(35.75,37.04,37.35,37.25)`. Yinelenen OSM tür/kimlik çiftleri birleştirilmiştir. Ham veri özetleri ve zaman bilgisi `reference-provenance.json` dosyasındadır. Sorgu alanı Asi Türkiye geometrisinin sınırlayıcı kutusunu tamamen kapsar.

İşleme: çok parçalı rezervuar dış/iç halkaları oluşturulmuş; aynı ilişkideki üye yolların yinelenmesi önlenmiş; geometriler SYGM Asi Türkiye bölümüyle kesiştirilmiş; topolojiyi koruyan 0,00005° sadeleştirme uygulanmıştır. Sınır dışındaki parçalar çıkarılmıştır. Bu nedenle çizgi uçları ve su yüzeyleri sınırda kesilmiş olabilir. Geometri onarımında Shapely 2.1.2 kullanılmıştır.

- `asi-akarsular.geojson`: **61 akarsu parçası** (61 ayrı akarsu anlamına gelmez).
- `asi-su-yuzeyleri.geojson`: **31 su yüzeyi nesnesi**.
- `asi-baraj-govdeleri.geojson`: **27 gövde nesnesi**.

OSM eksiksiz veya resmî tesis envanteri değildir. Adı olmayan nesneler için ad uydurulmamıştır. İşletme, yapılma tarihi, güvenlik veya doluluk durumu çıkarımı yapılmaz. Küçük/mevsimsel dereler, `river` dışında etiketlenen akışlar ve `reservoir` dışında etiketlenen su yüzeyleri bu seçime dahil değildir. Kaynak nesne kimliği ve bağlantısı her özelliğin içinde korunmuştur.

## Uygulamadaki davranış

Hazır katmanlar ayrı bir referans kataloğudur. Her katmanın tiki bağımsızdır; görünürlük tercihleri bu tarayıcıda saklanır. Kişisel kayıtlar veya yüklenen katmanlar değiştirilmez. Hazır veriler uygulamayla birlikte gelir; saha JSON yedeğine ve cihaz eşitlemesine kopyalanmaz. Uygulama önbelleği hazırlanmışsa dosyalar çevrimdışı gösterilebilir; OpenStreetMap zemin karoları internet gerektirir.

Kaynak işleme kodu: depo içindeki `scripts/build_reference_data.py`. Üretilen geometriler, koordinat aralığı, havza üyeliği ve kayıt sayıları test edilmiştir; sahada ölçümle doğrulanmış değildir.
