package com.plata_app.app;

import com.getcapacitor.BridgeActivity;
import android.os.Bundle;
import android.content.Intent;
import android.graphics.Color;
import android.graphics.drawable.ColorDrawable;
import android.util.DisplayMetrics;
import android.view.Gravity;
import android.view.WindowManager;

public class MainActivity extends BridgeActivity {
    private boolean voiceCompact = false;
    @Override public void onCreate(Bundle savedInstanceState) {
        registerPlugin(PlataWidgetsPlugin.class);
        registerPlugin(PlataVoicePlugin.class);
        registerPlugin(PlataVoiceOverlayPlugin.class);
        super.onCreate(savedInstanceState);
        voiceCompact = getIntent().getBooleanExtra(PlataVoiceOverlayPlugin.EXTRA, false);
        getOnBackPressedDispatcher().addCallback(this, new androidx.activity.OnBackPressedCallback(true) {
            @Override public void handleOnBackPressed() {
                if (voiceCompact) closeVoicePanel();
                else {
                    setEnabled(false);
                    getOnBackPressedDispatcher().onBackPressed();
                    setEnabled(true);
                }
            }
        });
        applyVoiceWindow();
    }
    @Override protected void onNewIntent(Intent intent) {
        boolean previousCompact = voiceCompact;
        setIntent(intent);
        voiceCompact = intent.getBooleanExtra(PlataVoiceOverlayPlugin.EXTRA, false);
        applyVoiceWindow();
        super.onNewIntent(intent);
        if (previousCompact && !voiceCompact && getBridge() != null) getBridge().triggerWindowJSEvent("plata-voice-closed");
    }
    public boolean isVoiceCompact() { return voiceCompact; }
    public void closeVoicePanel() {
        if (!voiceCompact) return;
        voiceCompact = false; getIntent().removeExtra(PlataVoiceOverlayPlugin.EXTRA);
        if (getBridge() != null) getBridge().triggerWindowJSEvent("plata-voice-closed");
        applyVoiceWindow(); moveTaskToBack(true);
    }
    private void applyVoiceWindow() {
        getWindow().setBackgroundDrawable(new ColorDrawable(Color.TRANSPARENT));
        getWindow().setSoftInputMode(WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE);
        if (voiceCompact) {
            DisplayMetrics metrics = new DisplayMetrics(); getWindowManager().getDefaultDisplay().getMetrics(metrics);
            float density = metrics.density;
            getWindow().setGravity(Gravity.CENTER);
            getWindow().setLayout(Math.min(metrics.widthPixels - (int)(24 * density), (int)(420 * density)), Math.min(metrics.heightPixels - (int)(80 * density), (int)(720 * density)));
        } else {
            getWindow().setGravity(Gravity.CENTER);
            getWindow().setLayout(WindowManager.LayoutParams.MATCH_PARENT, WindowManager.LayoutParams.MATCH_PARENT);
        }
    }
    @Override public void onConfigurationChanged(android.content.res.Configuration configuration) { super.onConfigurationChanged(configuration); applyVoiceWindow(); }
    @Override public void onResume() { super.onResume(); PlataVoiceOverlayService.setAppVisible(true); }
    @Override public void onPause() { super.onPause(); PlataVoiceOverlayService.setAppVisible(false); }
}
