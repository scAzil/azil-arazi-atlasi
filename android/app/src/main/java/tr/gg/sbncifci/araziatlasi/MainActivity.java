package tr.gg.sbncifci.araziatlasi;

import android.Manifest;
import android.app.Activity;
import android.app.AlertDialog;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.location.Location;
import android.location.LocationManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.CancellationSignal;
import android.os.Handler;
import android.os.Looper;
import android.provider.Settings;
import android.webkit.JavascriptInterface;
import android.webkit.PermissionRequest;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.webkit.WebSettings;
import android.widget.Toast;

import androidx.webkit.WebViewAssetLoader;

import org.json.JSONObject;
import com.google.zxing.integration.android.IntentIntegrator;
import com.google.zxing.integration.android.IntentResult;

import java.io.ByteArrayInputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public final class MainActivity extends Activity {
    private static final int PICK_PHOTO=10,EXPORT_ARCHIVE=11,IMPORT_ARCHIVE=12,LOCATION_PERMISSION=13;
    private final ExecutorService executor=Executors.newSingleThreadExecutor();
    private final Handler mainHandler=new Handler(Looper.getMainLooper());
    private AtlasStore store;
    private WebView webView;
    private ValueCallback<Uri[]> fileChooser;
    private CancellationSignal locationSignal;

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        getWindow().setStatusBarColor(Color.rgb(20,44,42));
        getWindow().setNavigationBarColor(Color.WHITE);
        try {
            store=new AtlasStore(this);
        } catch(Exception exception) {
            new AlertDialog.Builder(this)
             .setTitle("Arşiv açılamadı")
             .setMessage("Mevcut kayıtlar korunmuştur; uygulama verilerini silmeyin.\n\n"+
                 safeError(exception))
             .setPositiveButton("Kapat",(dialog,button)->finish())
             .setCancelable(false).show();
            return;
        }
        WebViewAssetLoader assetLoader=new WebViewAssetLoader.Builder()
            .addPathHandler("/assets/",new WebViewAssetLoader.AssetsPathHandler(this))
            .addPathHandler("/local/",relativePath->{
                if(relativePath==null||!AtlasStore.ASSET.matcher(relativePath).matches())
                    return denied();
                try {
                    File target=store.assetFile(relativePath);
                    if(!target.isFile())return denied();
                    String mime="image/jpeg";
                    if(relativePath.endsWith(".png"))mime="image/png";
                    else if(relativePath.endsWith(".webp"))mime="image/webp";
                    else if(!relativePath.endsWith(".jpg"))return denied();
                    return new WebResourceResponse(mime,null,new FileInputStream(target));
                }catch(Exception error){return denied();}
            })
            .build();
        webView=new WebView(this);
        WebSettings settings=webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(false);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(true); // Only for an explicit system photo picker
        settings.setJavaScriptCanOpenWindowsAutomatically(false);
        settings.setMediaPlaybackRequiresUserGesture(true);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setUserAgentString(settings.getUserAgentString()+" AZiL-Arazi-Atlasi-Android/0.1.0-beta.2");
        webView.setWebViewClient(new WebViewClient(){
            @Override public WebResourceResponse shouldInterceptRequest(WebView view,WebResourceRequest req){
                return assetLoader.shouldInterceptRequest(req.getUrl());
            }
            @Override public boolean shouldOverrideUrlLoading(WebView view,WebResourceRequest req){
                Uri uri=req.getUrl();
                return !"appassets.androidplatform.net".equals(uri.getHost())||
                    !"https".equals(uri.getScheme());
            }
        });
        webView.setWebChromeClient(new WebChromeClient(){
            @Override public boolean onShowFileChooser(WebView view,ValueCallback<Uri[]> callback,FileChooserParams params){
                if(fileChooser!=null)fileChooser.onReceiveValue(null);
                fileChooser=callback;
                Intent intent=new Intent(Intent.ACTION_GET_CONTENT);
                intent.setType("image/*");
                intent.addCategory(Intent.CATEGORY_OPENABLE);
                try{startActivityForResult(Intent.createChooser(intent,"Fotoğraf seç"),PICK_PHOTO);}
                catch(Exception error){
                    fileChooser.onReceiveValue(null);fileChooser=null;showToast("Fotoğraf seçici açılamadı.");
                }
                return true;
            }
            @Override public void onPermissionRequest(PermissionRequest request){
                runOnUiThread(request::deny);
            }
        });
        webView.addJavascriptInterface(new AndroidBridge(),"AndroidAtlas");
        setContentView(webView);
        webView.loadUrl("https://appassets.androidplatform.net/assets/index.html");
    }

    private static WebResourceResponse denied(){
        return new WebResourceResponse("text/plain","UTF-8",new ByteArrayInputStream(new byte[0]));
    }
    private static String safeError(Exception e){
        String message=e.getMessage();
        return message==null?"Beklenmeyen hata.":message.length()>240?message.substring(0,240):message;
    }
    private void showToast(String message){
        runOnUiThread(()->Toast.makeText(this,message,Toast.LENGTH_LONG).show());
    }
    private void informBrowser(String handler,JSONObject value){
        runOnUiThread(()->{
            if(webView!=null){
                webView.evaluateJavascript(
                    "if(window.Atlas&&window.Atlas."+handler+")window.Atlas."+handler+"("+value.toString()+");",
                    null);
            }
        });
    }
    private void archiveFailed(Exception e){
        try{informBrowser("archiveDone",new JSONObject().put("ok",false).put("error",safeError(e)));}
        catch(Exception ignored){}
    }

    final class AndroidBridge {
        private JSONObject failure(Exception e){
            try{return new JSONObject().put("ok",false).put("error",safeError(e));}
            catch(Exception ignored){return new JSONObject();}
        }
        @JavascriptInterface public String getState(){
            try{return store.snapshot().toString();}
            catch(Exception e){return failure(e).toString();}
        }
        @JavascriptInterface public String addProject(String name){
            try{return store.addProject(name).toString();}
            catch(Exception e){return failure(e).toString();}
        }
        @JavascriptInterface public String addRecord(String json){
            try{return store.addRecord(new JSONObject(json)).toString();}
            catch(Exception e){return failure(e).toString();}
        }
        @JavascriptInterface public String addLayer(String json){
            try{return store.addLayer(new JSONObject(json)).toString();}
            catch(Exception e){return failure(e).toString();}
        }
        @JavascriptInterface public String toggleLayer(String id){
            try{return store.toggleLayer(id).toString();}
            catch(Exception e){return failure(e).toString();}
        }
        @JavascriptInterface public String updateLayerStyle(String id,String json){
            try{return store.updateLayerStyle(id,new JSONObject(json)).toString();}
            catch(Exception e){return failure(e).toString();}
        }
        @JavascriptInterface public String addPhoto(String id,String encoded){
            try{return store.addPhoto(id,encoded).toString();}
            catch(Exception e){return failure(e).toString();}
        }
        @JavascriptInterface public void requestExport(){runOnUiThread(()->{
            Intent intent=new Intent(Intent.ACTION_CREATE_DOCUMENT);
            intent.addCategory(Intent.CATEGORY_OPENABLE);
            intent.setType("application/zip");
            intent.putExtra(Intent.EXTRA_TITLE,"AZiL-Atlas-"+java.time.LocalDate.now()+".atlas.zip");
            try{startActivityForResult(intent,EXPORT_ARCHIVE);}
            catch(Exception e){archiveFailed(e);}
        });}
        @JavascriptInterface public void requestImport(){runOnUiThread(()->{
            Intent intent=new Intent(Intent.ACTION_OPEN_DOCUMENT);
            intent.addCategory(Intent.CATEGORY_OPENABLE);
            intent.setType("application/zip");
            intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            try{startActivityForResult(intent,IMPORT_ARCHIVE);}
            catch(Exception e){archiveFailed(e);}
        });}
        @JavascriptInterface public void scanDesktopQr(){runOnUiThread(()->{
            new IntentIntegrator(MainActivity.this)
              .setDesiredBarcodeFormats(IntentIntegrator.QR_CODE)
              .setPrompt("Windows Arazi Atlası QR kodunu okutun")
              .setBeepEnabled(false)
              .setBarcodeImageEnabled(false)
              .setOrientationLocked(false)
              .initiateScan();
        });}
        @JavascriptInterface public void requestLocation(){runOnUiThread(MainActivity.this::requestLocation);}
    }

    @Override protected void onActivityResult(int request,int result,Intent data){
        super.onActivityResult(request,result,data);
        IntentResult scanned=IntentIntegrator.parseActivityResult(request,result,data);
        if(scanned!=null){
            String value=scanned.getContents();
            if(value==null){
                showToast("QR tarama iptal edildi.");
            }else if(value.length()>4000){
                showToast("QR verisi çok uzun.");
            }else{
                webView.evaluateJavascript(
                  "if(window.AZILQr)window.AZILQr.onScanResult("+JSONObject.quote(value)+");",
                  null);
            }
            return;
        }
        if(request==PICK_PHOTO){
            if(fileChooser!=null){
                fileChooser.onReceiveValue(result==RESULT_OK&&data!=null&&data.getData()!=null?
                    new Uri[]{data.getData()}:null);
                fileChooser=null;
            }
            return;
        }
        if(result!=RESULT_OK||data==null||data.getData()==null)return;
        Uri uri=data.getData();
        if(request==EXPORT_ARCHIVE){
            executor.execute(()->{
                try(OutputStream out=getContentResolver().openOutputStream(uri,"w")){
                    if(out==null)throw new java.io.IOException("Dosya oluşturulamadı.");
                    JSONObject resultData=ArchiveCodec.exportArchive(store,out);
                    informBrowser("archiveDone",resultData);
                }catch(Exception e){archiveFailed(e);}
            });
        }else if(request==IMPORT_ARCHIVE){
            new AlertDialog.Builder(this)
              .setTitle("Arşiv içe aktarılsın mı?")
              .setMessage("Var olan kayıtlar silinmeyecek. Aynı kimlikle farklı kayıt varsa işlem iptal edilecek. ZIP doğrulanmadan arşive yazılmayacak.")
              .setNegativeButton("Vazgeç",null)
              .setPositiveButton("İçe aktar",(dialog,which)->executor.execute(()->{
                  try(InputStream input=getContentResolver().openInputStream(uri)){
                      if(input==null)throw new java.io.IOException("Seçilen dosya açılamıyor.");
                      JSONObject outcome=ArchiveCodec.importArchive(store,getCacheDir(),input);
                      informBrowser("archiveDone",outcome);
                  }catch(Exception error){archiveFailed(error);}
              })).show();
        }
    }
    private boolean hasLocationPermission(){
        return checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION)==PackageManager.PERMISSION_GRANTED||
               checkSelfPermission(Manifest.permission.ACCESS_COARSE_LOCATION)==PackageManager.PERMISSION_GRANTED;
    }
    private void requestLocation(){
        if(!hasLocationPermission()){
            requestPermissions(new String[]{Manifest.permission.ACCESS_FINE_LOCATION,
                Manifest.permission.ACCESS_COARSE_LOCATION},LOCATION_PERMISSION);
            return;
        }
        LocationManager manager=(LocationManager)getSystemService(LOCATION_SERVICE);
        if(manager==null){locationError("GPS hizmeti bulunamadı.");return;}
        String provider;
        if(manager.isProviderEnabled(LocationManager.GPS_PROVIDER)&&
            checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION)==PackageManager.PERMISSION_GRANTED)
            provider=LocationManager.GPS_PROVIDER;
        else if(manager.isProviderEnabled(LocationManager.NETWORK_PROVIDER))
            provider=LocationManager.NETWORK_PROVIDER;
        else{locationError("Konum sağlayıcısı kapalı. Telefon konumunu etkinleştirin.");return;}
        try{
            if(Build.VERSION.SDK_INT>=30){
                if(locationSignal!=null)locationSignal.cancel();
                CancellationSignal signal=new CancellationSignal();locationSignal=signal;
                mainHandler.postDelayed(()->{
                    if(locationSignal==signal){
                        locationSignal=null;signal.cancel();
                        locationError("Konum alınamadı. GPS açık alanda yeniden deneyin.");
                    }
                },15000);
                manager.getCurrentLocation(provider,signal,getMainExecutor(),location->{
                    if(locationSignal!=signal)return;
                    locationSignal=null;
                    if(location!=null)sendLocation(location);
                    else locationError("GPS konum üretemedi.");
                });
            }else{
                manager.requestSingleUpdate(provider,new android.location.LocationListener(){
                    @Override public void onLocationChanged(Location location){sendLocation(location);}
                    @Override public void onProviderDisabled(String p){}
                },Looper.getMainLooper());
            }
        }catch(SecurityException exception){locationError("Konum izni verilmedi.");}
        catch(Exception exception){locationError(safeError(exception));}
    }
    private void sendLocation(Location location){
        try{
            JSONObject result=new JSONObject().put("ok",true)
               .put("lat",location.getLatitude()).put("lon",location.getLongitude())
               .put("accuracy",location.hasAccuracy()?location.getAccuracy():0);
            informBrowser("location",result);
        }catch(Exception ignored){}
    }
    private void locationError(String message){
        try{informBrowser("location",new JSONObject().put("ok",false).put("error",message));}
        catch(Exception ignored){}
    }
    @Override public void onRequestPermissionsResult(int request,String[] permissions,int[] results){
        super.onRequestPermissionsResult(request,permissions,results);
        if(request==LOCATION_PERMISSION){
            if(hasLocationPermission())requestLocation();
            else locationError("Konum izni reddedildi. Elle haritadan nokta ekleyebilirsiniz.");
        }
    }
    @Override public void onBackPressed(){
        if(webView!=null){
            webView.evaluateJavascript("Boolean(window.atlasBack&&window.atlasBack())",value->{
                if("false".equals(value))finish();
            });
        }else super.onBackPressed();
    }
    @Override protected void onDestroy(){
        if(locationSignal!=null)locationSignal.cancel();
        executor.shutdown();
        if(webView!=null){webView.removeJavascriptInterface("AndroidAtlas");webView.destroy();webView=null;}
        super.onDestroy();
    }
}
