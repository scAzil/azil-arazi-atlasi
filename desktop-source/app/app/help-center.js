/*
 * AZiL Arazi Atlası offline help content.
 * No requests, analytics, accounts or third-party resources.
 */
export const HELP_TOPICS=[
 {id:'about',name:'Program Hakkında',summary:'Amaç, sürüm ve uygulama kimliği'},
 {id:'guide',name:'Kullanım Kılavuzu',summary:'Adım adım çevrimdışı kullanım'},
 {id:'notes',name:'Sürüm Notları',summary:'Eklenenler ve bilinen sınırlamalar'},
 {id:'troubleshoot',name:'Sorun Giderme',summary:'Harita, arşiv, pafta ve QR'},
 {id:'data',name:'Verilerim Nerede?',summary:'Yerel klasörler ve arşiv standardı'},
 {id:'diagnostics',name:'Tanılama Bilgileri',summary:'Özel veri içermeyen teknik özet'},
 {id:'shortcuts',name:'Klavye Kısayolları',summary:'Desteklenen gerçek kısayollar'}
];

export const HELP_GUIDE=[
 {heading:'1 · İlk kullanım ve proje oluşturma',paragraphs:[
  'Uygulamayı yazılabilir bir klasöre tüm resources dosyalarıyla birlikte çıkarın. Programın yanında Arsiv ve Yedekler klasörleri oluşturulur.',
  'Dosya > Yeni proje veya Projeler > Yeni proje ile bir çalışma başlatın. + Nokta düğmesi ile proje, gözlem türü, tarih, açıklama ve koordinat girin.',
  'Her nokta için yeni ziyaret ekleyebilirsiniz. Ziyaretler ana noktayla ilişkili kalır. Fotoğraflar ortak varlık deposunda tutulur.'
 ]},
 {heading:'2 · Harita ve koordinatlar',paragraphs:[
  'Harita alanı pencereyi doldurur. Üst şeritte Menü, Araçlar, Katmanlar, Bilgi panelleri ayrı açılıp kapanır. F11 tam ekran geçişini yönetir.',
  'WGS84 enlem-boylam saklama biçimidir; UTM 37N ölçüm veya gösterim için kullanılır. Nokta kayıtlarında Haritadan konum seç seçeneğini kullanabilirsiniz.',
  'Araçlar panelinde çizgi ve alan ölçümü yapılabilir. Sonuçlar yaklaşık değerlerdir; resmî ölçüm veya kadastro sınırı yerine geçmez.'
 ]},
 {heading:'3 · KML/KMZ paftalar ve stil ayarları',paragraphs:[
  'Harita > Araçlar panelinden KML/KMZ dosyalarını açın; pafta indeksi ekleyin. Gerekirse raster katmanda indeks sınırına göre göster seçeneğini kullanın.',
  'Katmanlar panelindeki Renk / çizim stili ile nokta rengi ve boyutu, çizgi kalınlığı ve rengi, poligon kenarı/dolgu rengi ayrı ayarlanır.',
  'Poligonun içinin tamamen boş görünmesi için İç dolgu görünürlüğü değerini 0 seçin. KML/KMZ gerçek dünya koordinatları korunur.',
  'Yüksek boyutlu paftaların açılışı cihazın belleğine bağlıdır. Yeniden örnekleme görüntü kalitesini etkileyebilir.'
 ]},
 {heading:'4 · Fotoğraf ve ziyaret yönetimi',paragraphs:[
  'Kayıt düzenleme ekranında fotoğraf ekleyin. Ayarlardaki Orijinal / 1920 / 1280 piksel seçimi yalnızca yeni eklenen fotoğraflara uygulanır.',
  'Bir ana nokta için + Ziyaret seçerek farklı tarihlerdeki gözlemleri saklayın. Ziyaretleri karşılaştır ile iki veya daha fazla ziyaretin fotoğraf ve notlarını görüntüleyin.'
 ]},
 {heading:'5 · Telefonda kayıt ve QR aktarımı',paragraphs:[
  'Telefondan Aktar ekranında QR bağlantısı oluşturun. Telefonda bağlantıyı açıp aktarılacak kayıtları seçin.',
  'QR aktarımı tek yönlüdür: telefon → bilgisayar. İşlem sonunda ana nokta–ziyaret ilişkilerini ve fotoğrafları kontrol edin.',
  'QR kodu aktarım odasına erişim sağlar; başkalarıyla paylaşmayın. Uygulama veri aktarımını tamamlayınca telefondaki kayıtları otomatik silmez.'
 ]},
 {heading:'6 · AZIL-ATLAS/1 taşınabilir arşiv',paragraphs:[
  'Ayarlar > Arşiv dosyası oluştur seçeneği güncel projeler, kayıtlar, katmanlar ve bağlı dosyaları .atlas.zip içine alır.',
  'İçe aktarımda mevcut kayıtlar silinmez veya sessizce değiştirilmez. Aynı kimlik farklı veri taşıyorsa işlem durdurulur.',
  'Eski yedekler, Çöp Kutusu, sürüm geçmişi ve gizli harita anahtarları taşınabilir ZIP içeriğine alınmaz. Bulut ve kullanıcı hesabı yoktur.',
  'Bu biçim web uygulamasıyla dosya düzeyinde ortak çalışacak şekilde tanımlanmıştır; canlı web uygulamasının entegrasyonu ayrı aşamadır.'
 ]},
 {heading:'7 · Rapor ve veri dışa aktarma',paragraphs:[
  'Raporlar bölümünde filtreleri kullanıp seçili kayıtları PDF, JSON, CSV, KML veya GeoJSON biçimlerinde kaydedebilirsiniz.',
  'Harita katmanlarının ve fotoğrafların telif/lisans koşullarını gözetin. Hizmete özel saha verilerini kamuya açık depolara yüklemeyin.'
 ]}
];
export const HELP_TROUBLESHOOT=[
 {heading:'Uygulama Arşiv açılıyor… ekranında kalıyor',paragraphs:[
  'v1.1.0-beta.2 sürümündeki bilinen arayüz hatası beta.3 sürümünde düzeltildi. Beta.3 veya daha yeni bir paketi, resources klasörüyle birlikte ayrı klasöre çıkarın.',
  'Sorun tekrar ederse alt durum çubuğundaki hata mesajını kaydedin ve Yardım > Tanılama Bilgileri bölümünden kişisel veri içermeyen teknik özeti kopyalayın.',
  'Sorunu çözmek için Arsiv veya Yedekler klasörlerini silmeyin.'
 ]},
 {heading:'Harita boş veya altlık görünmüyor',paragraphs:[
  'İnternet bağlantısını ve seçilen harita altlığını kontrol edin. Çevrimdışı modda internetten alınan temel harita karoları görünmeyebilir.',
  'KML/KMZ katmanını Katmanlar panelinde görünür yapın. Katmanın kapsadığı koordinat alanına Yaklaş düğmesiyle gidin.'
 ]},
 {heading:'KML/KMZ dosyası açılmıyor ya da yanlış yerde',paragraphs:[
  'Dosyayı standart bir KML/KMZ görüntüleyicide sınayın. Referans koordinatlarını, pafta indeksini ve haritaya yerleştirme sınırlarını kontrol edin.',
  'İndeksle kırpılan bir paftada yanlış poligon seçiliyse katmandaki İndeks poligonu seçin alanını düzeltin.',
  'KMZ içindeki resim çok büyükse bellek sınırına takılabilir; orijinal dosyanın kopyasıyla deneyin.'
 ]},
 {heading:'Fotoğraf ve arşiv sorunları',paragraphs:[
  'Ayarlar > Arşiv klasörünü aç ile yerel dosyaları kontrol edin. Ayarlar > Fotoğraf klasörlerini onar görünür klasör kopyalarını güncelleyebilir.',
  'Taşınabilir .atlas.zip dosyasını açmadan önce ayrı bir konumda saklayın. Mevcut kayıtlar ile çakışan kimliklerin üzerine yazılmaz.',
  'Bütünlük denetiminde eksik dosya bulunursa önce orijinal kaynak klasörünü kontrol edin; dosyaları silmeyin.'
 ]},
 {heading:'Telefon ile QR aktarımı başarısız',paragraphs:[
  'Telefonun kamerasıyla QR kodunu açın; aktarım oturumunun açık olduğundan emin olun. Seçilen kayıtların aktarıldığına ilişkin sonuç özetini inceleyin.',
  'Ana noktanın PC tarafında mevcut olduğundan emin olun. Otomatik onarım yapılmayan ziyaret bağlantılarını elle kontrol edin.'
 ]},
 {heading:'Windows güvenlik ve güncelleme',paragraphs:[
  'Yeni ZIP paketini önceki sürümden farklı bir klasöre çıkarın. Arazi Atlasi.exe ve resources klasörünü ayırmayın.',
  'Uygulama dijital kod imzasıyla imzalanmadığı için Windows uyarı verebilir. Dosyanın resmî GitHub kaynağını kontrol edin.'
 ]}
];
export const HELP_RELEASES=[
 {version:'1.1.0',label:'Kararlı sürüm · Yardım Merkezi ve masaüstü yenilikleri',items:[
  'Çevrimdışı, aranabilir kullanım kılavuzu ve konuya göre yardım.',
  'Program Hakkında, sürüm notları, sorun giderme ve gerçek klavye kısayolları.',
  'Kişisel veri içermeyen tanılama kopyalama ve salt okunur arşiv sağlık özeti.'
 ]},
 {version:'1.1.0-beta.3',label:'Başlangıç hatası düzeltmesi',items:[
  'Arşiv açılıyor… ekranında kalmaya neden olan arayüz sözdizimi hatası düzeltildi.',
  'Chromium ile gerçek başlangıç testi ve görünür hata bildirimi eklendi.'
 ]},
 {version:'1.1.0-beta.2',label:'Yerel arşiv ve KML çizim stilleri',items:[
  'AZIL-ATLAS/1 ZIP arşiviyle güncel kayıtları içe ve dışa aktarma.',
  'Nokta, çizgi, poligon renk/kalınlık ve poligon dolgu saydamlığı.',
  'Eski yedekten geri dönüş menüleri kaldırıldı; arşiv dosyaları silinmedi.'
 ]},
 {version:'1.1.0-beta.1',label:'Tam ekran harita çalışma alanı',items:[
  'Haritayı pencereye yayan görünüm ve gizlenebilir Menü, Araçlar, Katmanlar ve Bilgi panelleri.',
  'Orijinal / 1920 / 1280 piksel yeni fotoğraf seçimi ve depolama boyutu.'
 ]},
 {version:'1.0.3',label:'Önceki kararlı Windows sürümü',items:[
  'Yerel saha arşivi, QR ile telefon→PC aktarımı, proje/nokta/ziyaret işlemleri.',
  'KML/KMZ, pafta indeksi, harita ölçümü ve yerel JSON arşivi.'
 ]}
];
export const HELP_SHORTCUTS=[
 ['F1','Yardım Merkezi'],
 ['F11','Tam ekran aç/kapat'],
 ['Ctrl + N','Yeni nokta'],
 ['Ctrl + Shift + N','Yeni proje'],
 ['Ctrl + Shift + S','Güncel arşivi dışa aktar'],
 ['Ctrl + C / Ctrl + V','Seçili metni kopyala / yapıştır'],
 ['Esc','Açık iletişim kutusunu veya harita panelini kapat (uygunsa)']
];

const escapeHTML=value=>String(value??'').replace(/[&<>"']/g,ch=>({
 '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
}[ch]));
const paras=items=>items.map(v=>'<p>'+escapeHTML(v)+'</p>').join('');
const section=object=>'<section class="atlasHelpSection"><h3>'+escapeHTML(object.heading)+'</h3>'+paras(object.paragraphs)+'</section>';
const action=(id,label)=>'<button type="button" data-help-action="'+id+'">'+escapeHTML(label)+'</button>';
const yesNo=value=>value?'Evet':'Hayır';

export function helpLayout(active='guide'){
 return '<div class="atlasHelpRoot" id="atlasHelpRoot">'+
   '<label for="atlasHelpSearch">Yardım içinde ara</label><input id="atlasHelpSearch" type="search" placeholder="KML, yedek, QR, nokta…" autocomplete="off">'+
   '<div class="atlasHelpLayout"><nav class="atlasHelpNav" aria-label="Yardım bölümleri">'+
   HELP_TOPICS.map(t=>'<button type="button" data-help-topic="'+t.id+'" aria-current="'+(active===t.id?'page':'false')+'"><b>'+escapeHTML(t.name)+'</b><small>'+escapeHTML(t.summary)+'</small></button>').join('')+
   '</nav><article class="atlasHelpArticle" id="atlasHelpArticle" aria-live="polite"></article></div>'+
   '<p class="atlasHelpFooter">AZiL Arazi Atlası · Yerel ve çevrimdışı yardım · Kullanıcı hesabı ve bulut eşitleme yoktur.</p></div>';
}

export function helpArticle(topic,opts={}){
 const version=opts.version||'1.1.0';
 if(topic==='about')return '<h2>AZiL Arazi Atlası</h2><p class="atlasHelpLead">Sahadan kalıcı arşive.</p>'+
   '<p>Geliştirme: <b>Şaban Çifçi (AZiL)</b>. Uygulama sürümü: <b>'+escapeHTML(version)+'</b>.</p>'+
   '<p>Windows için yerel CBS ve saha kaydı uygulaması. Proje, nokta, ziyaret, fotoğraf, harita, KML/KMZ pafta ve raporları bir araya getirir. Çalışma verileri cihazda tutulur; hesap ve bulut servisi kullanılmaz.</p>'+
   '<p>Arşiv standardı: <b>AZIL-ATLAS/1</b>. Kaydedilen ana koordinatlar: <b>EPSG:4326 (WGS84)</b>. UTM 37N gösterim ve ölçüm aracı olarak kullanılır.</p>'+
   '<p>Bu bağımsız AZiL uygulaması, DSİ tarafından yayımlanan veya resmî olarak onaylanan bir kamu yazılımı değildir.</p>'+
   '<div class="actions">'+action('website','AZiL internet sitesi')+action('github','GitHub deposu')+'</div>'+
   '<p>Sol alttaki ŞÇ profil düğmesi kişisel tanıtımı açar; bu ekran programın teknik kimliğine ayrılmıştır.</p>';
 if(topic==='guide')return '<h2>Çevrimdışı Kullanım Kılavuzu</h2><p class="atlasHelpLead">Yedi bölümde uygulamanın temel iş akışı.</p>'+HELP_GUIDE.map(section).join('');
 if(topic==='notes')return '<h2>Sürüm Notları</h2><p>Bu sürüm bir Windows test adayıdır. Kullanıcı testi ve kararlı yayın ayrı aşamalardır.</p>'+
   HELP_RELEASES.map(r=>section({heading:r.version+' · '+r.label,paragraphs:r.items})).join('');
 if(topic==='troubleshoot')return '<h2>Sorun Giderme Merkezi</h2><p class="atlasHelpLead">Sık karşılaşılan durumlar ve güvenli ilk kontroller.</p>'+HELP_TROUBLESHOOT.map(section).join('');
 if(topic==='data')return '<h2>Verilerim Nerede?</h2>'+
   '<p>Veriler bilgisayarınızda tutulur; AZiL otomatik bulut eşitleme veya hesap oluşturma kullanmaz.</p>'+
   '<h3>Güncel kayıtlar ve fotoğraflar</h3><p><code>'+escapeHTML(opts.archivePath||'Arsiv')+'</code></p>'+
   '<h3>Yerel otomatik güvenlik kopyaları</h3><p><code>'+escapeHTML(opts.backupPath||'Yedekler')+'</code></p>'+
   '<p>Program bazı işlemlerde yerel güvenlik kopyası oluşturabilir. Eski yedekten geri dönüş menüleri kaldırılmıştır; önceki dosyalar kendiliğinden silinmez.</p>'+
   '<p>Güncel projeleri, ziyaretleri, katmanları ve bağlı fotoğraf/paftaları başka cihaza taşımak için Ayarlar → <b>Arşiv dosyası oluştur</b> kullanın. ZIP şifreli değildir.</p>'+
   '<div class="actions">'+action('archive-folder','Arşiv klasörünü aç')+action('backup-folder','Yedekler klasörünü aç')+action('health','Arşiv sağlık kontrolü')+'</div>'+
   (opts.health?healthContent(opts.health):'<p class="notice">Arşiv sağlık kontrolü isteğe bağlıdır ve hiçbir dosyayı değiştirmez.</p>');
 if(topic==='diagnostics')return '<h2>Tanılama Bilgileri</h2>'+
   '<p>Paylaşılabilecek teknik özet yalnızca sürüm, işletim sistemi, mimari, Electron ve nesne sayılarını içerir. <b>Fotoğraf, koordinat, kayıt adı, açıklama, klasör yolu, API anahtarı ve QR oturum bilgisi dahil değildir.</b></p>'+
   '<div class="actions">'+action('diagnostics-load','Teknik bilgileri göster')+action('diagnostics-copy','Tanılama bilgilerini kopyala')+action('health','Arşiv sağlık kontrolü')+'</div>'+
   (opts.diagnostics?'<pre class="atlasHelpPre">'+escapeHTML(opts.diagnostics)+'</pre>':'<p class="notice">Özet, istediğinizde bilgisayarınızda hazırlanır.</p>')+
   (opts.health?healthContent(opts.health):'');
 if(topic==='shortcuts')return '<h2>Klavye Kısayolları</h2><div class="atlasHelpShortcut">'+
   HELP_SHORTCUTS.map(([k,v])=>'<div><kbd>'+escapeHTML(k)+'</kbd><span>'+escapeHTML(v)+'</span></div>').join('')+
   '</div><p>Kısayollar uygulama penceresi odaktayken çalışır. Esc, düzenleme sırasında kaydedilmemiş işlemleri onay almadan silmez.</p>';
 return '<h2>Yardım</h2><p>Bölümlerden birini seçin.</p>';
}
function healthContent(info){
 return '<div class="atlasHelpSection"><h3>Salt okunur arşiv kontrolü</h3><p>'+
  'Projeler: '+Number(info.projects||0)+
  ' · Kayıtlar: '+Number(info.records||0)+
  ' · Ziyaretler: '+Number(info.visits||0)+
  ' · Bağlı varlık: '+Number(info.assets||0)+'</p><p>'+
  'Eksik ana nokta: '+Number(info.missingParents||0)+
  ' · Bulunamayan dosya: '+Number(info.missingAssets||0)+
  (info.partial?' · Denetim büyük arşiv nedeniyle sınırlı.':'')+
  '</p><p>Bu işlem dosyaları değiştirmez veya otomatik onarım yapmaz.</p></div>';
}

export function searchHelp(query){
 const token=String(query||'').trim().toLocaleLowerCase('tr-TR');
 if(!token)return [];
 const sources=[
  ...HELP_GUIDE.map(x=>({topic:'guide',heading:x.heading,content:x.paragraphs.join(' ')})),
  ...HELP_TROUBLESHOOT.map(x=>({topic:'troubleshoot',heading:x.heading,content:x.paragraphs.join(' ')})),
  ...HELP_RELEASES.map(x=>({topic:'notes',heading:x.version+' · '+x.label,content:x.items.join(' ')})),
  ...HELP_TOPICS.map(x=>({topic:x.id,heading:x.name,content:x.summary}))
 ];
 return sources.filter(x=>(x.heading+' '+x.content).toLocaleLowerCase('tr-TR').includes(token)).slice(0,35);
}
export function searchResultsHTML(query){
 const matches=searchHelp(query);
 return '<h2>Arama sonuçları</h2><p><b>'+matches.length+'</b> eşleşme bulundu: '+escapeHTML(query)+'</p>'+
 (matches.length?matches.map(m=>
  '<button class="atlasHelpResult" type="button" data-help-topic="'+escapeHTML(m.topic)+'">'+
  '<b>'+escapeHTML(m.heading)+'</b><small>'+escapeHTML(HELP_TOPICS.find(t=>t.id===m.topic)?.name||m.topic)+'</small></button>'
 ).join(''):'<p>Başka bir kelime deneyin: KML, pafta, QR, arşiv, ziyaret.</p>');
}
