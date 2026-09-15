package com.plata_app.app;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.widget.RemoteViews;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;

public class PlataWidgetProvider extends AppWidgetProvider {
    static final String PREFS = "plata-home-summary";
    static final String ACTION_EXTRA = "plata_action";

    static PendingIntent openApp(Context context, boolean addExpense) {
        Intent intent = new Intent(context, MainActivity.class);
        intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        intent.putExtra(ACTION_EXTRA, addExpense ? "add-expense" : "dashboard");
        return PendingIntent.getActivity(context, addExpense ? 8102 : 8101, intent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    static SharedPreferences preferences(Context context) {
        return context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    static String today() {
        return new SimpleDateFormat("yyyy-MM-dd", Locale.US).format(new Date());
    }

    static void updateAll(Context context) {
        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        int[] ids = manager.getAppWidgetIds(new ComponentName(context, PlataWidgetProvider.class));
        for (int id : ids) update(context, manager, id);
        PlataSummaryNotification.update(context);
    }

    private static void update(Context context, AppWidgetManager manager, int id) {
        SharedPreferences prefs = preferences(context);
        boolean hasAccount = prefs.getBoolean("hasAccount", false);
        boolean currentDay = today().equals(prefs.getString("dateKey", ""));
        RemoteViews view = new RemoteViews(context.getPackageName(), R.layout.plata_summary_widget);
        view.setTextViewText(R.id.widget_account, prefs.getString("accountName", "Abre Plata App"));
        view.setTextViewText(R.id.widget_balance, hasAccount ? prefs.getString("balance", "—") : "—");
        view.setTextViewText(R.id.widget_expenses, hasAccount && currentDay ? prefs.getString("todayExpenses", "—") : "—");
        view.setTextViewText(R.id.widget_updated, hasAccount && currentDay
            ? "Actualizado " + prefs.getString("updatedLabel", "") : "Abre la app para actualizar");
        view.setOnClickPendingIntent(R.id.widget_root, openApp(context, false));
        view.setOnClickPendingIntent(R.id.widget_add, openApp(context, true));
        manager.updateAppWidget(id, view);
    }

    @Override public void onUpdate(Context context, AppWidgetManager manager, int[] ids) {
        for (int id : ids) update(context, manager, id);
    }

    @Override public void onReceive(Context context, Intent intent) {
        super.onReceive(context, intent);
        String action = intent.getAction();
        if (Intent.ACTION_DATE_CHANGED.equals(action) || Intent.ACTION_TIME_CHANGED.equals(action)
            || Intent.ACTION_TIMEZONE_CHANGED.equals(action)) updateAll(context);
    }
}
