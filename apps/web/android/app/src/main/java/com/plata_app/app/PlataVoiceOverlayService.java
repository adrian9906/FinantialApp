package com.plata_app.app;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.app.KeyguardManager;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.pm.ServiceInfo;
import android.graphics.Color;
import android.graphics.PixelFormat;
import android.graphics.drawable.GradientDrawable;
import android.os.Build;
import android.os.IBinder;
import android.provider.Settings;
import android.view.Gravity;
import android.view.MotionEvent;
import android.view.View;
import android.view.WindowManager;
import android.widget.ImageButton;
import android.widget.LinearLayout;
import android.widget.TextView;
import androidx.core.app.NotificationCompat;

public class PlataVoiceOverlayService extends Service {
    static volatile boolean running = false;
    static volatile boolean appVisible = false;
    private static PlataVoiceOverlayService instance;
    private WindowManager manager;
    private LinearLayout bubble;
    private WindowManager.LayoutParams params;
    private final BroadcastReceiver screen = new BroadcastReceiver() { @Override public void onReceive(Context context, Intent intent) { updateVisibility(); } };
    static void setAppVisible(boolean visible) { appVisible = visible; if (instance != null) instance.updateVisibility(); }
    private int dp(int value) { return Math.round(value * getResources().getDisplayMetrics().density); }
    @Override public void onCreate() { super.onCreate(); instance = this; }
    @Override public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent != null && "stop".equals(intent.getAction())) { stopSelf(); return START_NOT_STICKY; }
        if (!Settings.canDrawOverlays(this)) { stopSelf(); return START_NOT_STICKY; }
        try {
            NotificationManager notifications = (NotificationManager)getSystemService(NOTIFICATION_SERVICE);
            String channel = "plata-voice-bubble";
            if (Build.VERSION.SDK_INT >= 26) notifications.createNotificationChannel(new NotificationChannel(channel, "Burbuja de dictado", NotificationManager.IMPORTANCE_LOW));
            PendingIntent stop = PendingIntent.getService(this, 8202, new Intent(this, PlataVoiceOverlayService.class).setAction("stop"), PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
            android.app.Notification notification = new NotificationCompat.Builder(this, channel).setSmallIcon(R.drawable.ic_plata_voice_mic).setContentTitle("Burbuja de Plata activa").setContentText("Toca la burbuja para dictar gastos y gustos.").setContentIntent(PlataWidgetProvider.openApp(this, false)).addAction(0, "Desactivar", stop).setOngoing(true).setOnlyAlertOnce(true).build();
            if (Build.VERSION.SDK_INT >= 34) startForeground(8201, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE);
            else startForeground(8201, notification);
            if (bubble == null) createBubble();
            running = true; updateVisibility();
        } catch (Exception error) { stopSelf(); }
        return START_NOT_STICKY;
    }
    private void createBubble() {
        manager = (WindowManager)getSystemService(WINDOW_SERVICE);
        int type = Build.VERSION.SDK_INT >= 26 ? WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY : WindowManager.LayoutParams.TYPE_PHONE;
        params = new WindowManager.LayoutParams(dp(84), dp(56), type, WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE, PixelFormat.TRANSLUCENT);
        params.gravity = Gravity.TOP | Gravity.LEFT;
        params.x = getSharedPreferences("plata-voice-overlay", MODE_PRIVATE).getInt("x", getResources().getDisplayMetrics().widthPixels - dp(100));
        params.y = getSharedPreferences("plata-voice-overlay", MODE_PRIVATE).getInt("y", getResources().getDisplayMetrics().heightPixels - dp(160));
        clampPosition();
        bubble = new LinearLayout(this); bubble.setGravity(Gravity.CENTER_VERTICAL);
        ImageButton microphone = new ImageButton(this); microphone.setImageResource(R.drawable.ic_plata_voice_mic); microphone.setColorFilter(Color.WHITE); microphone.setContentDescription("Abrir dictado de Plata");
        GradientDrawable background = new GradientDrawable(); background.setColor(Color.rgb(90, 65, 145)); background.setCornerRadius(dp(28)); microphone.setBackground(background);
        bubble.addView(microphone, new LinearLayout.LayoutParams(dp(56), dp(56)));
        TextView close = new TextView(this); close.setText("×"); close.setTextColor(Color.WHITE); close.setTextSize(24); close.setGravity(Gravity.CENTER); close.setContentDescription("Desactivar burbuja de Plata"); close.setOnClickListener(view -> stopSelf()); bubble.addView(close, new LinearLayout.LayoutParams(dp(28), dp(48)));
        microphone.setOnClickListener(view -> openPanel());
        microphone.setOnTouchListener(new View.OnTouchListener() {
            float startX, startY; int originalX, originalY; boolean moved;
            @Override public boolean onTouch(View view, MotionEvent event) {
                if (event.getAction() == MotionEvent.ACTION_DOWN) { startX = event.getRawX(); startY = event.getRawY(); originalX = params.x; originalY = params.y; moved = false; return true; }
                if (event.getAction() == MotionEvent.ACTION_MOVE) {
                    if (Math.hypot(event.getRawX() - startX, event.getRawY() - startY) > dp(8)) moved = true;
                    if (moved) { params.x = originalX + (int)(event.getRawX() - startX); params.y = originalY + (int)(event.getRawY() - startY); clampPosition(); try { manager.updateViewLayout(bubble, params); } catch (Exception error) { stopSelf(); } }
                    return true;
                }
                if (event.getAction() == MotionEvent.ACTION_UP) { if (!moved) view.performClick(); else getSharedPreferences("plata-voice-overlay", MODE_PRIVATE).edit().putInt("x", params.x).putInt("y", params.y).apply(); return true; }
                return event.getAction() == MotionEvent.ACTION_CANCEL;
            }
        });
        manager.addView(bubble, params);
        IntentFilter filter = new IntentFilter(); filter.addAction(Intent.ACTION_SCREEN_OFF); filter.addAction(Intent.ACTION_SCREEN_ON); filter.addAction(Intent.ACTION_USER_PRESENT);
        if (Build.VERSION.SDK_INT >= 33) registerReceiver(screen, filter, Context.RECEIVER_NOT_EXPORTED); else registerReceiver(screen, filter);
    }
    private void clampPosition() {
        params.x = Math.max(0, Math.min(params.x, getResources().getDisplayMetrics().widthPixels - dp(84)));
        params.y = Math.max(dp(40), Math.min(params.y, getResources().getDisplayMetrics().heightPixels - dp(96)));
    }
    private void updateVisibility() {
        if (bubble == null) return;
        if (!Settings.canDrawOverlays(this) || !PlataSummaryNotification.permitted(this)) { stopSelf(); return; }
        boolean locked = ((KeyguardManager)getSystemService(KEYGUARD_SERVICE)).isKeyguardLocked();
        bubble.setVisibility(appVisible || locked ? View.GONE : View.VISIBLE);
    }
    private void openPanel() {
        if (((KeyguardManager)getSystemService(KEYGUARD_SERVICE)).isKeyguardLocked()) return;
        Intent intent = new Intent(this, MainActivity.class).putExtra(PlataVoiceOverlayPlugin.EXTRA, true).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        try { startActivity(intent); } catch (Exception error) { stopSelf(); }
    }
    @Override public void onDestroy() {
        running = false; instance = null;
        if (bubble != null) { try { manager.removeView(bubble); } catch (Exception ignored) {} try { unregisterReceiver(screen); } catch (Exception ignored) {} bubble = null; }
        super.onDestroy();
    }
    @Override public IBinder onBind(Intent intent) { return null; }
    @Override public void onConfigurationChanged(android.content.res.Configuration configuration) {
        super.onConfigurationChanged(configuration);
        if (bubble != null) { clampPosition(); try { manager.updateViewLayout(bubble, params); } catch (Exception error) { stopSelf(); } }
    }
}
