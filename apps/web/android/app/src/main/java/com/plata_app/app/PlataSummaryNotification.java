package com.plata_app.app;

import android.Manifest;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.Context;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.os.Build;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import androidx.core.content.ContextCompat;

final class PlataSummaryNotification {
    private static final String CHANNEL = "plata-quick-summary";
    private static final int ID = 8103;

    static boolean permitted(Context context) {
        return NotificationManagerCompat.from(context).areNotificationsEnabled()
            && (Build.VERSION.SDK_INT < 33 || ContextCompat.checkSelfPermission(context,
                Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED);
    }

    static void update(Context context) {
        SharedPreferences prefs = PlataWidgetProvider.preferences(context);
        NotificationManager manager = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        if (!prefs.getBoolean("notificationEnabled", false) || !prefs.getBoolean("hasAccount", false) || !permitted(context)) {
            manager.cancel(ID);
            return;
        }
        if (Build.VERSION.SDK_INT >= 26) {
            NotificationChannel channel = new NotificationChannel(CHANNEL, "Resumen y accesos rápidos", NotificationManager.IMPORTANCE_LOW);
            channel.setDescription("Saldo de la cuenta seleccionada y acceso para añadir gastos.");
            channel.setLockscreenVisibility(NotificationCompat.VISIBILITY_PRIVATE);
            manager.createNotificationChannel(channel);
        }
        boolean current = PlataWidgetProvider.today().equals(prefs.getString("dateKey", ""));
        String body = "Saldo: " + prefs.getString("balance", "—") + " · Gastos hoy: "
            + (current ? prefs.getString("todayExpenses", "—") : "Abre para actualizar");
        NotificationCompat.Builder notification = new NotificationCompat.Builder(context, CHANNEL)
            .setSmallIcon(R.drawable.ic_plata_notification)
            .setContentTitle("Plata App · " + prefs.getString("accountName", ""))
            .setContentText(body)
            .setStyle(new NotificationCompat.BigTextStyle().bigText(body + "\nÚltima actualización: " + prefs.getString("updatedLabel", "")))
            .setContentIntent(PlataWidgetProvider.openApp(context, false))
            .addAction(R.drawable.ic_plata_notification, "Añadir gasto", PlataWidgetProvider.openApp(context, true))
            .setVisibility(NotificationCompat.VISIBILITY_PRIVATE)
            .setOnlyAlertOnce(true).setOngoing(true).setShowWhen(false);
        manager.notify(ID, notification.build());
    }
}
