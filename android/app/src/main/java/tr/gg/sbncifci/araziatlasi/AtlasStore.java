package tr.gg.sbncifci.araziatlasi;

import android.content.Context;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Matrix;
import android.media.ExifInterface;
import android.util.AtomicFile;
import android.util.Base64;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.FileInputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Instant;
import java.util.UUID;
import java.util.regex.Pattern;

final class AtlasStore {
    static final String VERSION = "0.1.0-beta.2";
    static final Pattern ASSET = Pattern.compile("^[a-f0-9]{64}\\.(jpg|png|webp|json|kml|kmz)$");
    private final Context context;
    private final AtomicFile file;
    private final File assets;
    private JSONObject state;

    AtlasStore(Context context) throws Exception {
        this.context = context.getApplicationContext();
        File root = new File(context.getFilesDir(), "atlas");
        if (!root.exists() && !root.mkdirs()) throw new IOException("Arşiv klasörü açılamadı.");
        assets = new File(root,"assets");
        if (!assets.exists() && !assets.mkdirs()) throw new IOException("Fotoğraf klasörü açılamadı.");
        file = new AtomicFile(new File(root,"state.json"));
        if (file.getBaseFile().exists()) {
            try (FileInputStream reader = file.openRead()) {
                byte[] bytes = readLimited(reader,20*1024*1024);
                state = new JSONObject(new String(bytes,StandardCharsets.UTF_8));
                verifyStructure(state);
            }
        } else {
            state = emptyState();
            save(state);
        }
    }

    private static JSONObject emptyState() throws JSONException {
        JSONObject o = new JSONObject();
        o.put("version",1);
        o.put("projects",new JSONArray());
        o.put("records",new JSONArray());
        o.put("layers",new JSONArray());
        o.put("settings",new JSONObject().put("theme","light").put("photoMax","1920"));
        return o;
    }
    static void verifyStructure(JSONObject s) throws JSONException {
        if(s.optInt("version",-1)!=1||s.optJSONArray("projects")==null
            ||s.optJSONArray("records")==null||s.optJSONArray("layers")==null)
            throw new JSONException("Arşiv şeması geçersiz. Veriler sıfırlanmadı.");
    }
    synchronized JSONObject snapshot() throws JSONException {
        return new JSONObject(state.toString());
    }
    private synchronized void save(JSONObject next) throws Exception {
        verifyStructure(next);
        byte[] raw=next.toString().getBytes(StandardCharsets.UTF_8);
        if(raw.length>20*1024*1024)throw new IOException("Yerel kayıt dosyası 20 MB sınırını aşıyor.");
        FileOutputStream out=null;
        try{
            out=file.startWrite();
            out.write(raw);
            out.flush();
            file.finishWrite(out);
            state=next;
        }catch(Exception e){
            if(out!=null)file.failWrite(out);
            throw e;
        }
    }
    synchronized JSONObject addProject(String input) throws Exception {
        String name=input==null?"":input.trim();
        if(name.isEmpty()||name.length()>120)throw new IOException("Proje adı 1–120 karakter olmalıdır.");
        JSONObject next=snapshot();
        JSONArray projects=next.getJSONArray("projects");
        for(int i=0;i<projects.length();i++)if(projects.getString(i).equalsIgnoreCase(name))
            throw new IOException("Bu proje zaten bulunuyor.");
        projects.put(name);save(next);
        return ok();
    }
    synchronized JSONObject addRecord(JSONObject input) throws Exception {
        JSONObject next=snapshot();
        String title=input.optString("title","").trim();
        String project=input.optString("project","").trim();
        String note=input.optString("note","").trim();
        String parent=input.isNull("parentId")?"":input.optString("parentId","");
        if(title.isEmpty()||title.length()>150||note.length()>12000)
            throw new IOException("Başlık veya not uzunluğu geçersiz.");
        if(!projectExists(next,project))throw new IOException("Proje bulunamadı.");
        JSONObject parentRecord=null;
        if(!parent.isEmpty()){
            parentRecord=find(next.getJSONArray("records"),parent);
            if(parentRecord==null||!parentRecord.isNull("parentId")&&
                !parentRecord.optString("parentId","").isEmpty())throw new IOException("Ana nokta bulunamadı.");
            if(!parentRecord.getString("project").equals(project))
                throw new IOException("Ziyaret ve ana nokta aynı projede olmalıdır.");
        }
        Object latValue=input.opt("lat"),lonValue=input.opt("lon");
        boolean hasLat=latValue instanceof Number,hasLon=lonValue instanceof Number;
        if(hasLat!=hasLon)throw new IOException("Enlem ve boylam birlikte girilmeli.");
        if(hasLat){
            double lat=((Number)latValue).doubleValue(),lon=((Number)lonValue).doubleValue();
            if(!Double.isFinite(lat)||!Double.isFinite(lon)||Math.abs(lat)>90||Math.abs(lon)>180)
                throw new IOException("Koordinatlar WGS84 aralığında değil.");
        }
        JSONObject record=new JSONObject();
        record.put("id","and-"+UUID.randomUUID());
        record.put("title",title);
        record.put("project",project);
        record.put("type",input.optString("type","Gözlem").substring(0,Math.min(80,input.optString("type","Gözlem").length())));
        record.put("note",note);
        record.put("date",Instant.now().toString());
        record.put("lat",hasLat?latValue:JSONObject.NULL);
        record.put("lon",hasLon?lonValue:JSONObject.NULL);
        record.put("parentId",parent.isEmpty()?JSONObject.NULL:parent);
        record.put("photos",new JSONArray());
        next.getJSONArray("records").put(record);
        save(next);
        return ok().put("id",record.getString("id"));
    }
    private static boolean projectExists(JSONObject s,String name) throws JSONException{
        JSONArray arr=s.getJSONArray("projects");
        for(int i=0;i<arr.length();i++)if(name.equals(arr.optString(i)))return true;
        return false;
    }
    static JSONObject find(JSONArray values,String id) throws JSONException{
        for(int i=0;i<values.length();i++){
            JSONObject r=values.getJSONObject(i);
            if(id.equals(r.optString("id")))return r;
        }
        return null;
    }
    synchronized JSONObject addLayer(JSONObject input) throws Exception{
        JSONObject next=snapshot();
        String name=input.optString("name","").trim();
        if(name.isEmpty()||name.length()>120)throw new IOException("Katman adı geçersiz.");
        JSONObject data=input.optJSONObject("data");
        if(data==null||!"FeatureCollection".equals(data.optString("type"))||
           data.optJSONArray("features")==null||data.optJSONArray("features").length()>5000)
            throw new IOException("GeoJSON FeatureCollection bekleniyor.");
        if(data.toString().length()>3*1024*1024)throw new IOException("Vektör verisi 3 MB sınırını aşıyor.");
        JSONObject layer=new JSONObject();
        layer.put("id","and-layer-"+UUID.randomUUID());
        layer.put("kind","vector");
        layer.put("name",name);
        layer.put("visible",true);
        layer.put("data",data);
        layer.put("style",input.optJSONObject("style")!=null?input.getJSONObject("style"):new JSONObject());
        next.getJSONArray("layers").put(layer);
        save(next);
        return ok().put("id",layer.getString("id"));
    }
    synchronized JSONObject updateLayerStyle(String id,JSONObject style) throws Exception{
        if(style.toString().length()>8000)throw new IOException("Stil verisi çok büyük.");
        JSONObject next=snapshot(),layer=find(next.getJSONArray("layers"),id);
        if(layer==null)throw new IOException("Katman bulunamadı.");
        layer.put("style",style);
        save(next);return ok();
    }
    synchronized JSONObject toggleLayer(String id) throws Exception {
        JSONObject next=snapshot(),layer=find(next.getJSONArray("layers"),id);
        if(layer==null)throw new IOException("Katman bulunamadı.");
        layer.put("visible",!layer.optBoolean("visible",true));
        save(next);return ok();
    }
    synchronized JSONObject addPhoto(String recordId,String encoded) throws Exception{
        if(encoded==null||encoded.length()>24*1024*1024)
            throw new IOException("Fotoğraf çok büyük (en fazla 15 MB kaynak).");
        byte[] raw;
        try{raw=Base64.decode(encoded,Base64.DEFAULT);}
        catch(Exception e){throw new IOException("Fotoğraf veri biçimi geçersiz.");}
        if(raw.length>15*1024*1024)throw new IOException("Fotoğraf 15 MB sınırını aşıyor.");
        BitmapFactory.Options opt=new BitmapFactory.Options();
        opt.inJustDecodeBounds=true;
        BitmapFactory.decodeByteArray(raw,0,raw.length,opt);
        if(opt.outWidth<=0||opt.outHeight<=0||opt.outWidth>20000||opt.outHeight>20000)
            throw new IOException("Fotoğraf okunamıyor.");
        int sample=1;
        while(Math.max(opt.outWidth/sample,opt.outHeight/sample)>2200)sample*=2;
        opt.inSampleSize=sample;opt.inJustDecodeBounds=false;
        Bitmap decoded=BitmapFactory.decodeByteArray(raw,0,raw.length,opt);
        if(decoded==null)throw new IOException("Fotoğraf çözülemedi.");
        Bitmap working=decoded;
        try{
            int rotation=0;
            try{
                ExifInterface exif=new ExifInterface(new ByteArrayInputStream(raw));
                int orientation=exif.getAttributeInt(ExifInterface.TAG_ORIENTATION,ExifInterface.ORIENTATION_NORMAL);
                if(orientation==ExifInterface.ORIENTATION_ROTATE_90)rotation=90;
                if(orientation==ExifInterface.ORIENTATION_ROTATE_180)rotation=180;
                if(orientation==ExifInterface.ORIENTATION_ROTATE_270)rotation=270;
            }catch(Exception ignored){}
            int maxSide=1920;
            double factor=Math.min(1.,(double)maxSide/Math.max(decoded.getWidth(),decoded.getHeight()));
            int width=Math.max(1,(int)(decoded.getWidth()*factor));
            int height=Math.max(1,(int)(decoded.getHeight()*factor));
            if(width!=decoded.getWidth()||height!=decoded.getHeight()){
                working=Bitmap.createScaledBitmap(decoded,width,height,true);
                decoded.recycle();
            }
            if(rotation!=0){
                Matrix matrix=new Matrix();matrix.postRotate(rotation);
                Bitmap rotated=Bitmap.createBitmap(working,0,0,working.getWidth(),working.getHeight(),matrix,true);
                working.recycle();working=rotated;
            }
            ByteArrayOutputStream output=new ByteArrayOutputStream();
            if(!working.compress(Bitmap.CompressFormat.JPEG,86,output))throw new IOException("JPEG kodlanamadı.");
            byte[] photo=output.toByteArray();
            if(photo.length>12*1024*1024)throw new IOException("Fotoğraf sıkıştırılamadı.");
            String name=sha256(photo)+".jpg";
            File dest=assetFile(name);
            if(!dest.exists()){
                try(FileOutputStream out=new FileOutputStream(dest)){out.write(photo);out.getFD().sync();}
            }
            JSONObject next=snapshot(),record=find(next.getJSONArray("records"),recordId);
            if(record==null)throw new IOException("Kayıt bulunamadı.");
            JSONArray images=record.optJSONArray("photos");
            if(images==null){images=new JSONArray();record.put("photos",images);}
            images.put(new JSONObject().put("ref",name).put("name","Fotoğraf "+(images.length()+1)+".jpg"));
            save(next);
            return ok().put("ref",name);
        }finally{if(!working.isRecycled())working.recycle();}
    }
    File assetFile(String ref) throws IOException{
        if(ref==null||!ASSET.matcher(ref).matches())throw new IOException("Güvensiz arşiv dosyası adı.");
        return new File(assets,ref);
    }
    synchronized void mergeImported(JSONObject incoming,java.util.Map<String,File> staging) throws Exception {
        verifyStructure(incoming);
        JSONObject next=snapshot();
        JSONArray existing=next.getJSONArray("records"),oldLayers=next.getJSONArray("layers");
        JSONArray addRec=incoming.getJSONArray("records"),addLayers=incoming.getJSONArray("layers");
        for(int i=0;i<addRec.length();i++){
            JSONObject r=addRec.getJSONObject(i);
            JSONObject old=find(existing,r.getString("id"));
            if(old!=null){if(!ArchiveCodec.same(old,r))throw new IOException("Kayıt kimliği çakışıyor: "+r.getString("id"));}
            else existing.put(r);
        }
        for(int i=0;i<addLayers.length();i++){
            JSONObject layer=addLayers.getJSONObject(i),old=find(oldLayers,layer.getString("id"));
            if(old!=null){if(!ArchiveCodec.same(old,layer))throw new IOException("Katman kimliği çakışıyor.");}
            else oldLayers.put(layer);
        }
        JSONArray projects=next.getJSONArray("projects"),incomingProjects=incoming.getJSONArray("projects");
        for(int i=0;i<incomingProjects.length();i++){
            String name=incomingProjects.getString(i);
            if(!projectExists(next,name))projects.put(name);
        }
        ArchiveCodec.validateRecords(next);
        // Do not overwrite any existing file; verify its hash first.
        for(java.util.Map.Entry<String,File> item:staging.entrySet()){
            File dest=assetFile(item.getKey());
            if(dest.exists()){
                if(!sha256(readLimited(new FileInputStream(dest),250*1024*1024)).equals(item.getKey().split("\\.")[0]))
                    throw new IOException("Mevcut dosya SHA-256 uyuşmuyor.");
            }
        }
        for(java.util.Map.Entry<String,File> item:staging.entrySet()){
            File dest=assetFile(item.getKey());
            if(!dest.exists()){
                try(FileInputStream in=new FileInputStream(item.getValue());
                    FileOutputStream out=new FileOutputStream(dest)){
                    byte[] buffer=new byte[65536];int n;
                    while((n=in.read(buffer))!=-1)out.write(buffer,0,n);
                    out.getFD().sync();
                }
            }
        }
        save(next);
    }
    static String sha256(byte[] data){
        try{
            byte[] hash=MessageDigest.getInstance("SHA-256").digest(data);
            StringBuilder builder=new StringBuilder();
            for(byte b:hash)builder.append(String.format(java.util.Locale.ROOT,"%02x",b&255));
            return builder.toString();
        }catch(NoSuchAlgorithmException e){throw new IllegalStateException(e);}
    }
    static byte[] readLimited(java.io.InputStream stream,int maximum) throws IOException{
        try(java.io.InputStream input=stream;ByteArrayOutputStream out=new ByteArrayOutputStream()){
            byte[] b=new byte[65536];int count=0,n;
            while((n=input.read(b))!=-1){
                count+=n;if(count>maximum)throw new IOException("Dosya boyutu sınırı aşıldı.");
                out.write(b,0,n);
            }
            return out.toByteArray();
        }
    }
    static JSONObject ok()throws JSONException{return new JSONObject().put("ok",true);}
}
