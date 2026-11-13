package tr.gg.sbncifci.araziatlasi;

import android.net.Uri;
import android.util.Base64;
import org.json.JSONArray;
import org.json.JSONObject;
import javax.crypto.Cipher;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.io.FileInputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;

/**
 * Local Wi-Fi transfer to the desktop v1.1.1 LAN receiver.
 * Uses AES-256-GCM application-layer encryption over local HTTP.
 * No data is uploaded to an internet server.
 */
final class LanTransfer {
    static final int MAX_REPLY=1024*1024;
    static final int MAX_RECORD_BYTES=75*1024*1024;
    private static final SecureRandom RANDOM=new SecureRandom();

    static final class Invite {
        final String ip,token;
        final int port;
        Invite(String host,int port,String token){this.ip=host;this.port=port;this.token=token;}
    }

    static boolean privateIPv4(String ip){
        if(ip==null||!ip.matches("\\d{1,3}(\\.\\d{1,3}){3}"))return false;
        String[] parts=ip.split("\\.");
        int[] n=new int[4];
        for(int i=0;i<4;i++){
            try{n[i]=Integer.parseInt(parts[i]);}
            catch(NumberFormatException e){return false;}
            if(n[i]<0||n[i]>255)return false;
        }
        return n[0]==10||(n[0]==172&&n[1]>=16&&n[1]<=31)||
            (n[0]==192&&n[1]==168);
    }
    static Invite parseInvite(String input)throws IOException{
        if(input==null||input.length()>2000)throw new IOException("QR metni geçersiz.");
        Uri uri=Uri.parse(input.trim());
        if(!"azil-atlas".equals(uri.getScheme())||!"lan".equals(uri.getHost())||
           uri.getFragment()!=null||uri.getUserInfo()!=null)
            throw new IOException("Yeni Windows v1.1.1 yerel QR kodunu okutun.");
        String ip=uri.getQueryParameter("ip");
        String portText=uri.getQueryParameter("port");
        String token=uri.getQueryParameter("token");
        if(!privateIPv4(ip)||portText==null||!portText.matches("\\d{1,5}")||
           token==null||!token.matches("[0-9a-f]{64}"))
            throw new IOException("Yerel QR adresi ya da oturum anahtarı geçersiz.");
        int port=Integer.parseInt(portText);
        if(port<1024||port>65535)throw new IOException("Yerel aktarım bağlantı noktası geçersiz.");
        return new Invite(ip,port,token);
    }
    static byte[] unhex(String raw) {
        if(raw==null||!raw.matches("[a-f0-9]{64}"))throw new IllegalArgumentException("Oturum anahtarı geçersiz.");
        byte[] out=new byte[32];
        for(int i=0;i<out.length;i++)out[i]=(byte)Integer.parseInt(raw.substring(i*2,i*2+2),16);
        return out;
    }
    static JSONObject seal(byte[] key,JSONObject message)throws Exception{
        Cipher cipher=Cipher.getInstance("AES/GCM/NoPadding");
        byte[] iv=new byte[12];RANDOM.nextBytes(iv);
        cipher.init(Cipher.ENCRYPT_MODE,new SecretKeySpec(key,"AES"),new GCMParameterSpec(128,iv));
        byte[] combined=cipher.doFinal(message.toString().getBytes(StandardCharsets.UTF_8));
        byte[] encrypted=new byte[combined.length-16],tag=new byte[16];
        System.arraycopy(combined,0,encrypted,0,encrypted.length);
        System.arraycopy(combined,encrypted.length,tag,0,16);
        return new JSONObject()
          .put("iv",Base64.encodeToString(iv,Base64.NO_WRAP))
          .put("data",Base64.encodeToString(encrypted,Base64.NO_WRAP))
          .put("tag",Base64.encodeToString(tag,Base64.NO_WRAP));
    }
    static JSONObject open(byte[] key,JSONObject envelope)throws Exception{
        byte[] iv=Base64.decode(envelope.getString("iv"),Base64.DEFAULT);
        byte[] content=Base64.decode(envelope.getString("data"),Base64.DEFAULT);
        byte[] tag=Base64.decode(envelope.getString("tag"),Base64.DEFAULT);
        if(iv.length!=12||tag.length!=16||content.length>MAX_REPLY)
            throw new IOException("Yanıt şifreleme biçimi geçersiz.");
        byte[] combined=new byte[content.length+tag.length];
        System.arraycopy(content,0,combined,0,content.length);
        System.arraycopy(tag,0,combined,content.length,tag.length);
        Cipher cipher=Cipher.getInstance("AES/GCM/NoPadding");
        cipher.init(Cipher.DECRYPT_MODE,new SecretKeySpec(key,"AES"),new GCMParameterSpec(128,iv));
        return new JSONObject(new String(cipher.doFinal(combined),StandardCharsets.UTF_8));
    }
    static byte[] readLimited(InputStream source,int limit)throws IOException{
        try(InputStream in=source;ByteArrayOutputStream out=new ByteArrayOutputStream()){
            byte[] block=new byte[32768];int size=0,n;
            while((n=in.read(block))!=-1){
                size+=n;if(size>limit)throw new IOException("Yerel aktarım veri sınırı aşıldı.");
                out.write(block,0,n);
            }
            return out.toByteArray();
        }
    }
    static JSONObject prepareRecord(AtlasStore store,String id)throws Exception{
        JSONObject source=AtlasStore.find(store.snapshot().getJSONArray("records"),id);
        if(source==null)throw new IOException("Gönderilecek kayıt bulunamadı.");
        JSONObject record=new JSONObject(source.toString());
        JSONArray pics=new JSONArray();
        JSONArray existing=source.optJSONArray("photos");
        if(existing!=null)for(int i=0;i<existing.length();i++){
            JSONObject item=existing.getJSONObject(i);
            String ref=item.getString("ref");
            String ext=ref.substring(ref.lastIndexOf('.')+1);
            if(!ext.equals("jpg")&&!ext.equals("png")&&!ext.equals("webp"))
                throw new IOException("Fotoğraf biçimi uygun değil.");
            byte[] content=readLimited(new FileInputStream(store.assetFile(ref)),15*1024*1024);
            String base64=Base64.encodeToString(content,Base64.NO_WRAP);
            pics.put(new JSONObject().put("name",item.optString("name","Fotoğraf"))
                .put("data","data:image/"+(ext.equals("jpg")?"jpeg":ext)+";base64,"+base64));
        }
        record.put("photos",pics);
        if(record.toString().getBytes(StandardCharsets.UTF_8).length>MAX_RECORD_BYTES)
            throw new IOException("Kayıt 75 MB sınırını aşıyor; ZIP kullanın.");
        return record;
    }

    static final class Session {
        final Invite invite;
        final byte[] key;
        private int sequence=0;
        Session(Invite invite){this.invite=invite;key=unhex(invite.token);}
        synchronized JSONObject request(String kind,JSONObject extra)throws Exception{
            JSONObject input=new JSONObject();
            input.put("seq",++sequence).put("kind",kind);
            if(extra!=null){
                java.util.Iterator<String> keys=extra.keys();
                while(keys.hasNext()){
                    String k=keys.next();
                    input.put(k,extra.get(k));
                }
            }
            byte[] encrypted=seal(key,input).toString().getBytes(StandardCharsets.UTF_8);
            URL url=new URL("http://"+invite.ip+":"+invite.port+"/v1/transfer");
            HttpURLConnection conn=(HttpURLConnection)url.openConnection();
            conn.setConnectTimeout(7000);
            conn.setReadTimeout(120000);
            conn.setInstanceFollowRedirects(false);
            conn.setRequestMethod("POST");
            conn.setDoOutput(true);
            conn.setUseCaches(false);
            conn.setRequestProperty("Content-Type","application/json");
            conn.setRequestProperty("Connection","close");
            conn.setFixedLengthStreamingMode(encrypted.length);
            try{
                try(OutputStream out=conn.getOutputStream()){
                    out.write(encrypted);
                }
                int status=conn.getResponseCode();
                byte[] body=readLimited(status==200?conn.getInputStream():conn.getErrorStream(),MAX_REPLY);
                JSONObject response=new JSONObject(new String(body,StandardCharsets.UTF_8));
                if(status!=200)throw new IOException(response.optString("error","Windows aktarımı reddetti."));
                return open(key,response);
            }catch(java.net.ConnectException e){
                throw new IOException("Bilgisayara ulaşılamıyor. Aynı Wi-Fi'yi ve Windows Güvenlik Duvarı özel ağ iznini kontrol edin.",e);
            }catch(java.net.SocketTimeoutException e){
                throw new IOException("Bağlantı zaman aşımı. Windows QR ekranı ve özel ağ iznini kontrol edin.",e);
            }finally{conn.disconnect();}
        }
    }
}
