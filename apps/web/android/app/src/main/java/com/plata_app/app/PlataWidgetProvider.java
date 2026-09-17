package com.plata_app.app;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.widget.RemoteViews;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;

public class PlataWidgetProvider extends AppWidgetProvider {
    static final String PREFS = "plata-home-summary";
    static final String ACTION_EXTRA = "plata_action";
    private static final String NEXT_ACCOUNT = "com.plata_app.app.NEXT_WIDGET_ACCOUNT";
    private static final String NEXT_CURRENCY = "com.plata_app.app.NEXT_WIDGET_CURRENCY";

    private static PendingIntent changeSelection(Context context, String action, int requestCode) {
        Intent intent = new Intent(context, PlataWidgetProvider.class).setAction(action);
        return PendingIntent.getBroadcast(context, requestCode, intent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    private static JSONObject catalog(SharedPreferences prefs) {
        try { return new JSONObject(prefs.getString("catalogJson", "{}")); }
        catch (JSONException error) { return new JSONObject(); }
    }

    private static JSONObject firstAccount(JSONArray accounts, String currencyCode) {
        for (int index = 0; index < accounts.length(); index++) {
            JSONObject account = accounts.optJSONObject(index);
            if (account != null && currencyCode.equals(account.optString("currencyCode"))) return account;
        }
        return null;
    }

    static void refreshSummary(Context context) {
        SharedPreferences prefs = preferences(context);
        JSONObject data = catalog(prefs);
        JSONArray accounts = data.optJSONArray("accounts");
        if (accounts == null) return;
        String currencyCode = prefs.getString("selectedCurrencyCode", "USD");
        String accountId = prefs.getString("selectedAccountId", "");
        JSONObject selected = null;
        for (int index = 0; index < accounts.length(); index++) {
            JSONObject account = accounts.optJSONObject(index);
            if (account != null && currencyCode.equals(account.optString("currencyCode"))
                && accountId.equals(account.optString("id"))) {
                selected = account;
                break;
            }
        }
        if (selected == null) selected = firstAccount(accounts, currencyCode);
        SharedPreferences.Editor editor = prefs.edit();
        editor.putBoolean("hasAccount", selected != null);
        editor.putString("selectedAccountId", selected == null ? "" : selected.optString("id"));
        editor.putString("accountName", selected == null ? "Sin cuenta en " + currencyCode : selected.optString("name"));
        editor.putString("balance", selected == null ? "—" : selected.optString("balance"));
        editor.putString("todayExpenses", selected == null ? "—" : selected.optString("todayExpenses"));
        editor.apply();
    }

    private static void advanceSelection(Context context, boolean currency) {
        SharedPreferences prefs = preferences(context);
        JSONObject data = catalog(prefs);
        JSONArray accounts = data.optJSONArray("accounts");
        JSONArray currencies = data.optJSONArray("currencies");
        if (accounts == null || currencies == null) return;
        String currencyCode = prefs.getString("selectedCurrencyCode", "USD");
        String accountId = prefs.getString("selectedAccountId", "");
        if (currency) {
            if (currencies.length() < 2) return;
            int current = -1;
            for (int index = 0; index < currencies.length(); index++) {
                if (currencyCode.equals(currencies.optString(index))) { current = index; break; }
            }
            currencyCode = currencies.optString((current + 1) % currencies.length(), "USD");
            JSONObject first = firstAccount(accounts, currencyCode);
            accountId = first == null ? "" : first.optString("id");
        } else {
            JSONArray matching = new JSONArray();
            for (int index = 0; index < accounts.length(); index++) {
                JSONObject account = accounts.optJSONObject(index);
                if (account != null && currencyCode.equals(account.optString("currencyCode"))) matching.put(account);
            }
            if (matching.length() < 2) return;
            int current = -1;
            for (int index = 0; index < matching.length(); index++) {
                if (accountId.equals(matching.optJSONObject(index).optString("id"))) { current = index; break; }
            }
            accountId = matching.optJSONObject((current + 1) % matching.length()).optString("id");
        }
        prefs.edit().putString("selectedCurrencyCode", currencyCode).putString("selectedAccountId", accountId)
            .putBoolean("selectionChanged", true).apply();
        refreshSummary(context);
        updateAll(context);
    }

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
        view.setTextViewText(R.id.widget_account, "Cuenta: " + prefs.getString("accountName", "Abre Plata App") + "  ›");
        view.setTextViewText(R.id.widget_currency, "Moneda: " + prefs.getString("selectedCurrencyCode", "USD") + "  ›");
        view.setTextViewText(R.id.widget_balance, hasAccount ? prefs.getString("balance", "—") : "—");
        view.setTextViewText(R.id.widget_expenses, hasAccount && currentDay ? prefs.getString("todayExpenses", "—") : "—");
        view.setTextViewText(R.id.widget_updated, hasAccount && currentDay
            ? "Actualizado " + prefs.getString("updatedLabel", "") : "Abre la app para actualizar");
        view.setOnClickPendingIntent(R.id.widget_root, openApp(context, false));
        view.setOnClickPendingIntent(R.id.widget_add, openApp(context, true));
        view.setOnClickPendingIntent(R.id.widget_account, changeSelection(context, NEXT_ACCOUNT, 8104));
        view.setOnClickPendingIntent(R.id.widget_currency, changeSelection(context, NEXT_CURRENCY, 8105));
        manager.updateAppWidget(id, view);
    }

    @Override public void onUpdate(Context context, AppWidgetManager manager, int[] ids) {
        for (int id : ids) update(context, manager, id);
    }

    @Override public void onReceive(Context context, Intent intent) {
        super.onReceive(context, intent);
        String action = intent.getAction();
        if (NEXT_ACCOUNT.equals(action) || NEXT_CURRENCY.equals(action)) {
            advanceSelection(context, NEXT_CURRENCY.equals(action));
            return;
        }
        if (Intent.ACTION_DATE_CHANGED.equals(action) || Intent.ACTION_TIME_CHANGED.equals(action)
            || Intent.ACTION_TIMEZONE_CHANGED.equals(action)) updateAll(context);
    }
}
