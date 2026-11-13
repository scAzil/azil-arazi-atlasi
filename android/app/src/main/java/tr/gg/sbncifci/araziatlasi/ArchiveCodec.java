package tr.gg.sbncifci.araziatlasi;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.security.DigestInputStream;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;
import java.util.zip.ZipOutputStream;

/** AZIL-ATLAS/1 compatible Windows/Web portable snapshot importer/exporter. */
final class ArchiveCodec {
    private ArchiveCodec(){}
    private static final long MAX_ZIP_UNPACKED=180L*1024*1024;
    private static final long MAX_ASSET=80L*1024*1024;
    private static final int MAX_ENTRIES=5000;
    private static final String SHA_KEY="data/state.json";

    static JSONObject snapshot(JSONObject raw) throws Exception{
        JSONObject data=new JSONObject();
        data.put("version",1);
        data.put("projects",new JSONArray(raw.getJSONArray("projects").toString()));
        data.put("records",new JSONArray(raw.getJSONArray("records").toString()));
        data.put("layers",new JSONArray(raw.getJSONArray("layers").toString()));
        JSONObject settings=new JSONObject();
        JSONObject available=raw.optJSONObject("settings");
        if(available!=null){
            for(String key:new String[]{"theme","font","dense","basemap","photoMax"}){
                if(available.has(key))settings.put(key,available.get(key));
            }
        }
        data.put("settings",settings);
        validateRecords(data);
        return data;
    }
    static void validateRecords(JSONObject state) throws Exception{
        AtlasStore.verifyStructure(state);
        JSONArray projects=state.getJSONArray("projects"),records=state.getJSONArray("records"),layers=state.getJSONArray("layers");
        if(projects.length()>20000||records.length()>100000||layers.length()>5000)
            throw new IOException("Arşiv çok fazla kayıt içeriyor.");
        HashSet<String> availableProjects=new HashSet<>();
        for(int i=0;i<projects.length();i++){
            String project=projects.getString(i);
            if(project.isEmpty()||project.length()>120||!availableProjects.add(project))
                throw new IOException("Proje adı hatalı veya yineleniyor.");
        }
        HashMap<String,JSONObject> ids=new HashMap<>();
        for(int i=0;i<records.length();i++){
            JSONObject r=records.getJSONObject(i);
            String id=r.optString("id",""),title=r.optString("title",""),project=r.optString("project","");
            if(id.isEmpty()||id.length()>200||title.isEmpty()||!availableProjects.contains(project)||
               ids.put(id,r)!=null||r.optJSONArray("photos")==null)
                throw new IOException("Kayıt kimliği, başlık veya proje ilişkisi geçersiz.");
            String date=r.optString("date","");
            try{Instant.parse(date);}catch(Exception e){throw new IOException("Kayıt tarihi ISO-8601 biçiminde değil.");}
            Object latitude=r.opt("lat"),longitude=r.opt("lon");
            boolean hasLat=latitude instanceof Number,hasLon=longitude instanceof Number;
            if(hasLat!=hasLon)throw new IOException("Koordinat çifti eksik.");
            if(hasLat){
                double lat=((Number)latitude).doubleValue(),lon=((Number)longitude).doubleValue();
                if(!Double.isFinite(lat)||!Double.isFinite(lon)||Math.abs(lat)>90||Math.abs(lon)>180)
                    throw new IOException("WGS84 koordinatı geçersiz.");
            }
            JSONArray photos=r.getJSONArray("photos");
            if(photos.length()>2000)throw new IOException("Tek kayıtta çok fazla fotoğraf var.");
            for(int j=0;j<photos.length();j++){
                JSONObject photo=photos.getJSONObject(j);
                if(photo.has("ref")&&!photo.isNull("ref")&&!validRef(photo.getString("ref")))
                    throw new IOException("Fotoğraf dosya adı güvenli değil.");
            }
        }
        for(JSONObject r:ids.values()){
            if(r.isNull("parentId"))continue;
            String parentId=r.optString("parentId","");
            if(parentId.isEmpty())continue;
            JSONObject parent=ids.get(parentId);
            if(parent==null||!parent.isNull("parentId")&&!parent.optString("parentId","").isEmpty()||
               !parent.optString("project","").equals(r.optString("project","")))
                throw new IOException("Ana nokta–ziyaret bağlantısı geçersiz.");
        }
        HashSet<String> layerIds=new HashSet<>();
        for(int i=0;i<layers.length();i++){
            JSONObject l=layers.getJSONObject(i);
            String id=l.optString("id","");
            if(id.isEmpty()||!layerIds.add(id))throw new IOException("Yinelenen katman kimliği.");
            if(l.has("ref")&&!l.isNull("ref")&&!validRef(l.getString("ref")))
                throw new IOException("Katman dosya adı güvenli değil.");
        }
    }
    static boolean validRef(String v){return v!=null&&AtlasStore.ASSET.matcher(v).matches();}
    static boolean same(Object a,Object b)throws JSONException{
        if(a==b)return true;
        if(a==null||b==null)return false;
        if(a==JSONObject.NULL||b==JSONObject.NULL)return a==JSONObject.NULL&&b==JSONObject.NULL;
        if(a instanceof JSONObject&&b instanceof JSONObject){
            JSONObject x=(JSONObject)a,y=(JSONObject)b;
            if(x.length()!=y.length())return false;
            java.util.Iterator<String> iterator=x.keys();
            while(iterator.hasNext()){
                String key=iterator.next();
                if(!y.has(key)||!same(x.get(key),y.get(key)))return false;
            }
            return true;
        }
        if(a instanceof JSONArray&&b instanceof JSONArray){
            JSONArray x=(JSONArray)a,y=(JSONArray)b;
            if(x.length()!=y.length())return false;
            for(int i=0;i<x.length();i++)if(!same(x.get(i),y.get(i)))return false;
            return true;
        }
        if(a instanceof Number&&b instanceof Number)
            return Double.compare(((Number)a).doubleValue(),((Number)b).doubleValue())==0;
        return a.equals(b);
    }

    static JSONObject exportArchive(AtlasStore store,OutputStream destination) throws Exception{
        JSONObject data=snapshot(store.snapshot());
        byte[] json=data.toString().getBytes(StandardCharsets.UTF_8);
        if(json.length>20*1024*1024)throw new IOException("JSON arşivi 20 MB sınırını aşıyor.");
        Set<String> refs=collectReferences(data);
        ArrayList<String> assetList=new ArrayList<>(refs);java.util.Collections.sort(assetList);
        JSONArray manifestAssets=new JSONArray();
        long total=0;
        for(String ref:assetList){
            File f=store.assetFile(ref);
            if(!f.isFile())throw new IOException("Fotoğraf veya pafta bulunamadı: "+ref);
            if(f.length()>MAX_ASSET)throw new IOException("Tek dosya Android aktarım sınırını aşıyor.");
            total+=f.length();
            if(total>MAX_ZIP_UNPACKED)throw new IOException("Telefon arşivi 180 MB sınırını aşıyor; Windows'tan aktarın.");
            String fileSha=digestFile(f);
            if(!ref.substring(0,64).equals(fileSha))throw new IOException("Dosya SHA-256 hatası: "+ref);
            String ext=ref.substring(ref.lastIndexOf('.')+1);
            String contentType="application/octet-stream";
            if(ext.equals("jpg"))contentType="image/jpeg";
            if(ext.equals("png"))contentType="image/png";
            if(ext.equals("webp"))contentType="image/webp";
            if(ext.equals("kml"))contentType="application/vnd.google-earth.kml+xml";
            if(ext.equals("kmz"))contentType="application/vnd.google-earth.kmz";
            if(ext.equals("json"))contentType="application/json";
            manifestAssets.put(new JSONObject()
              .put("path","assets/"+ref).put("sha256",fileSha).put("size",f.length())
              .put("mediaType",contentType));
        }
        // sourcePlatform=web is the existing Windows v1.1.0 interoperable profile.
        // producer discloses the actual native Android origin.
        JSONObject manifest=new JSONObject()
          .put("format","azil-atlas")
          .put("schemaVersion",1).put("kind","snapshot")
          .put("createdAt",Instant.now().toString())
          .put("sourcePlatform","web")
          .put("producer","azil-android")
          .put("appVersion",AtlasStore.VERSION)
          .put("crs","EPSG:4326")
          .put("paths",new JSONObject().put("state",SHA_KEY))
          .put("counts",new JSONObject().put("projects",data.getJSONArray("projects").length())
            .put("records",data.getJSONArray("records").length())
            .put("layers",data.getJSONArray("layers").length())
            .put("assets",manifestAssets.length()))
          .put("assets",manifestAssets)
          .put("checksums",new JSONObject().put(SHA_KEY,AtlasStore.sha256(json)));
        try(ZipOutputStream zip=new ZipOutputStream(destination,StandardCharsets.UTF_8)){
            write(zip,"manifest.json",manifest.toString(2).getBytes(StandardCharsets.UTF_8));
            write(zip,SHA_KEY,json);
            byte[] buffer=new byte[65536];
            for(String ref:assetList){
                zip.putNextEntry(new ZipEntry("assets/"+ref));
                try(FileInputStream in=new FileInputStream(store.assetFile(ref))){
                    int n;while((n=in.read(buffer))!=-1)zip.write(buffer,0,n);
                }
                zip.closeEntry();
            }
            zip.finish();
        }
        return new JSONObject().put("ok",true).put("message","Arşiv ZIP oluşturuldu.")
                .put("records",data.getJSONArray("records").length())
                .put("assets",assetList.size());
    }
    private static void write(ZipOutputStream zip,String name,byte[] data)throws IOException{
        zip.putNextEntry(new ZipEntry(name));zip.write(data);zip.closeEntry();
    }
    private static Set<String> collectReferences(JSONObject data)throws Exception{
        HashSet<String> refs=new HashSet<>();
        JSONArray records=data.getJSONArray("records");
        for(int i=0;i<records.length();i++){
            JSONArray photos=records.getJSONObject(i).getJSONArray("photos");
            for(int j=0;j<photos.length();j++){
                JSONObject photo=photos.getJSONObject(j);
                String ref=photo.isNull("ref")?"":photo.optString("ref","");
                if(!ref.isEmpty())refs.add(ref);
            }
        }
        JSONArray layers=data.getJSONArray("layers");
        for(int i=0;i<layers.length();i++){
            JSONObject layer=layers.getJSONObject(i);
            String ref=layer.isNull("ref")?"":layer.optString("ref","");
            if(!ref.isEmpty())refs.add(ref);
        }
        for(String ref:refs)if(!validRef(ref))throw new IOException("Güvensiz varlık adı.");
        return refs;
    }

    static JSONObject importArchive(AtlasStore store,File cache,InputStream input)throws Exception{
        File temp=new File(cache,"azil-import-"+UUID.randomUUID());
        if(!temp.mkdirs())throw new IOException("Geçici arşiv klasörü açılamadı.");
        try{
            Map<String,File> staged=new HashMap<>();
            HashSet<String> seen=new HashSet<>();
            byte[] manifestData=null,stateData=null;
            long unpacked=0;int count=0;
            try(ZipInputStream zip=new ZipInputStream(input,StandardCharsets.UTF_8)){
                ZipEntry entry;
                while((entry=zip.getNextEntry())!=null){
                    if(entry.isDirectory())throw new IOException("ZIP'te beklenmeyen klasör girdisi.");
                    String name=entry.getName();
                    if(++count>MAX_ENTRIES||!seen.add(name)||name.contains("..")||name.contains("\\")||
                       name.startsWith("/")||(!name.equals("manifest.json")&&!name.equals(SHA_KEY)&&
                       !name.matches("^assets/[a-f0-9]{64}\\.(jpg|png|webp|json|kml|kmz)$")))
                        throw new IOException("Arşivde güvenli olmayan dosya yolu.");
                    long max=name.equals("manifest.json")?1024*1024:
                        name.equals(SHA_KEY)?20*1024*1024:MAX_ASSET;
                    long size=0;
                    ByteArrayOutputStream text=new ByteArrayOutputStream();
                    File stage=null;FileOutputStream fileOut=null;
                    if(name.startsWith("assets/")){
                        String ref=name.substring(7);
                        stage=new File(temp,ref);
                        fileOut=new FileOutputStream(stage);
                    }
                    try{
                        byte[] buffer=new byte[65536];int n;
                        while((n=zip.read(buffer))!=-1){
                            size+=n;unpacked+=n;
                            if(size>max||unpacked>MAX_ZIP_UNPACKED)
                                throw new IOException("ZIP boyut sınırı aşıldı (en fazla 180 MB).");
                            if(fileOut!=null)fileOut.write(buffer,0,n);
                            else text.write(buffer,0,n);
                        }
                    }finally{if(fileOut!=null)fileOut.close();}
                    if(name.equals("manifest.json"))manifestData=text.toByteArray();
                    else if(name.equals(SHA_KEY))stateData=text.toByteArray();
                    else staged.put(name.substring(7),stage);
                    zip.closeEntry();
                }
            }
            if(manifestData==null||stateData==null)throw new IOException("Arşiv başlığı/verisi bulunamadı.");
            JSONObject manifest=new JSONObject(new String(manifestData,StandardCharsets.UTF_8));
            if(!"azil-atlas".equals(manifest.optString("format"))||
               manifest.optInt("schemaVersion")!=1||!"snapshot".equals(manifest.optString("kind"))||
               !"EPSG:4326".equals(manifest.optString("crs"))||
               !"data/state.json".equals(manifest.optJSONObject("paths")==null ? "" : manifest.optJSONObject("paths").optString("state"))){
                throw new IOException("AZIL-ATLAS/1 arşiv biçimi tanınmadı.");
            }
            String producer=manifest.optString("sourcePlatform","");
            if(!producer.equals("desktop")&&!producer.equals("web")&&!producer.equals("android"))
                throw new IOException("Bilinmeyen arşiv kaynağı.");
            if(!AtlasStore.sha256(stateData).equals(
                 manifest.optJSONObject("checksums").optString(SHA_KEY,"")))
                throw new IOException("Arşiv JSON SHA-256 doğrulaması başarısız.");
            JSONObject incoming=new JSONObject(new String(stateData,StandardCharsets.UTF_8));
            validateRecords(incoming);
            JSONArray assetMeta=manifest.optJSONArray("assets");
            if(assetMeta==null||assetMeta.length()!=staged.size())
                throw new IOException("Arşiv dosya listesi eksik veya fazla.");
            Set<String> references=collectReferences(incoming);
            if(references.size()!=staged.size()||!references.equals(staged.keySet()))
                throw new IOException("Arşiv içeriği kayıtlarla eşleşmiyor.");
            Set<String> unique=new HashSet<>();
            for(int i=0;i<assetMeta.length();i++){
                JSONObject meta=assetMeta.getJSONObject(i);
                String name=meta.getString("path"),sha=meta.getString("sha256");
                if(!name.startsWith("assets/"))throw new IOException("Varlık yolu hatalı.");
                String ref=name.substring(7);
                if(!unique.add(ref)||!validRef(ref)||!staged.containsKey(ref)||
                   !ref.substring(0,64).equals(sha)||meta.getLong("size")!=staged.get(ref).length()||
                   !digestFile(staged.get(ref)).equals(sha))
                    throw new IOException("Varlık SHA-256 doğrulaması başarısız.");
            }
            store.mergeImported(incoming,staged);
            return new JSONObject().put("ok",true)
              .put("message","Arşiv içe aktarıldı; mevcut kayıtlar korundu.")
              .put("records",incoming.getJSONArray("records").length())
              .put("assets",staged.size());
        }finally{deleteTree(temp);}
    }
    private static void deleteTree(File root){
        File[] items=root.listFiles();
        if(items!=null)for(File f:items)if(f.isDirectory())deleteTree(f);else f.delete();
        root.delete();
    }
    private static String digestFile(File file)throws Exception{
        MessageDigest digest=MessageDigest.getInstance("SHA-256");
        try(FileInputStream in=new FileInputStream(file)){
            byte[] buffer=new byte[65536];int n;
            while((n=in.read(buffer))!=-1)digest.update(buffer,0,n);
        }
        StringBuilder text=new StringBuilder();
        for(byte b:digest.digest())text.append(String.format(java.util.Locale.ROOT,"%02x",b&255));
        return text.toString();
    }
}
