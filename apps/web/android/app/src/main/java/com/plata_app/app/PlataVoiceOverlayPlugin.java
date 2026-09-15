package com.plata_app.app;

import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import android.os.Handler;
import android.os.Looper;
import androidx.core.content.ContextCompat;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "PlataVoiceOverlay")
public class PlataVoiceOverlayPlugin extends Plugin {
    static final String EXTRA = "plata_voice_panel";
    @PluginMethod public void getStatus(PluginCall call) {
        JSObject result = new JSObject();
        result.put("enabled", PlataVoiceOverlayService.running);
        result.put("permitted", Settings.canDrawOverlays(getContext()));
        result.put("compact", ((MainActivity)getActivity()).isVoiceCompact());
        call.resolve(result);
    }
    @PluginMethod public void requestPermission(PluginCall call) {
        Intent intent = new Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION, Uri.parse("package:" + getContext().getPackageName()));
        try { getActivity().startActivity(intent); call.resolve(); }
        catch (Exception error) { call.reject("Abre los ajustes Android y permite mostrar Plata sobre otras apps.", error); }
    }
    @PluginMethod public void setEnabled(PluginCall call) {
        if (!Boolean.TRUE.equals(call.getBoolean("enabled", false))) {
            getContext().stopService(new Intent(getContext(), PlataVoiceOverlayService.class)); new Handler(Looper.getMainLooper()).postDelayed(call::resolve, 150); return;
        }
        if (!Settings.canDrawOverlays(getContext())) { call.reject("Permite mostrar Plata sobre otras aplicaciones."); return; }
        if (!PlataSummaryNotification.permitted(getContext())) { call.reject("Permite las notificaciones de Plata."); return; }
        try { ContextCompat.startForegroundService(getContext(), new Intent(getContext(), PlataVoiceOverlayService.class)); waitForService(call, 0); }
        catch (Exception error) { call.reject("No se pudo activar la burbuja. Abre Plata y vuelve a intentar.", error); }
    }
    private void waitForService(PluginCall call, int attempts) {
        new Handler(Looper.getMainLooper()).postDelayed(() -> {
            if (PlataVoiceOverlayService.running) call.resolve();
            else if (attempts < 15) waitForService(call, attempts + 1);
            else call.reject("No se pudo iniciar la burbuja. Revisa los permisos Android.");
        }, 100);
    }
    @PluginMethod public void closePanel(PluginCall call) {
        getActivity().runOnUiThread(() -> { ((MainActivity)getActivity()).closeVoicePanel(); call.resolve(); });
    }
    @Override protected void handleOnNewIntent(Intent intent) {
        if (intent.getBooleanExtra(EXTRA, false)) notifyListeners("openVoicePanel", new JSObject(), true);
    }
}
