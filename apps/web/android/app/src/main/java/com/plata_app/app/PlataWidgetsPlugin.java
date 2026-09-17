package com.plata_app.app;

import android.appwidget.AppWidgetManager;
import android.content.ComponentName;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

@CapacitorPlugin(name = "PlataWidgets")
public class PlataWidgetsPlugin extends Plugin {
    @PluginMethod public void updateSummary(PluginCall call) {
        SharedPreferences current = PlataWidgetProvider.preferences(getContext());
        SharedPreferences.Editor prefs = current.edit();
        prefs.putBoolean("hasAccount", Boolean.TRUE.equals(call.getBoolean("hasAccount", false)));
        for (String key : new String[]{"accountName", "balance", "todayExpenses", "dateKey", "updatedLabel"}) {
            String value = call.getString(key, "");
            prefs.putString(key, value.length() > 160 ? value.substring(0, 160) : value);
        }
        String catalogJson = call.getString("catalogJson", "");
        try {
            JSONObject catalog = new JSONObject(catalogJson);
            if (!(catalog.opt("accounts") instanceof JSONArray) || !(catalog.opt("currencies") instanceof JSONArray)) {
                call.reject("Invalid widget catalog");
                return;
            }
            prefs.putString("catalogJson", catalogJson);
        } catch (JSONException error) {
            call.reject("Invalid widget catalog", error);
            return;
        }
        String requestedAccount = call.getString("selectedAccountId", "");
        String requestedCurrency = call.getString("selectedCurrencyCode", "USD");
        boolean changed = current.getBoolean("selectionChanged", false);
        try {
            JSONArray availableCurrencies = new JSONObject(catalogJson).getJSONArray("currencies");
            boolean stillAvailable = false;
            for (int index = 0; index < availableCurrencies.length(); index++) {
                if (current.getString("selectedCurrencyCode", "USD").equals(availableCurrencies.optString(index))) {
                    stillAvailable = true;
                    break;
                }
            }
            if (!stillAvailable) changed = false;
        } catch (JSONException error) {
            call.reject("Invalid widget catalog", error);
            return;
        }
        if (!changed || (requestedAccount.equals(current.getString("selectedAccountId", ""))
            && requestedCurrency.equals(current.getString("selectedCurrencyCode", "USD")))) {
            prefs.putString("selectedAccountId", requestedAccount);
            prefs.putString("selectedCurrencyCode", requestedCurrency);
            prefs.putBoolean("selectionChanged", false);
        }
        prefs.apply();
        PlataWidgetProvider.refreshSummary(getContext());
        PlataWidgetProvider.updateAll(getContext());
        call.resolve();
    }

    @PluginMethod public void getSelection(PluginCall call) {
        SharedPreferences prefs = PlataWidgetProvider.preferences(getContext());
        JSObject result = new JSObject();
        result.put("accountId", prefs.getString("selectedAccountId", ""));
        result.put("currencyCode", prefs.getString("selectedCurrencyCode", "USD"));
        result.put("changed", prefs.getBoolean("selectionChanged", false));
        call.resolve(result);
    }

    @PluginMethod public void clearSummary(PluginCall call) {
        PlataWidgetProvider.preferences(getContext()).edit().clear().apply();
        PlataWidgetProvider.updateAll(getContext());
        call.resolve();
    }

    @PluginMethod public void pinWidget(PluginCall call) {
        AppWidgetManager manager = AppWidgetManager.getInstance(getContext());
        JSObject result = new JSObject();
        boolean supported = Build.VERSION.SDK_INT >= 26 && manager.isRequestPinAppWidgetSupported();
        result.put("requested", supported && manager.requestPinAppWidget(
            new ComponentName(getContext(), PlataWidgetProvider.class), null, null));
        call.resolve(result);
    }

    @PluginMethod public void setNotificationEnabled(PluginCall call) {
        boolean enabled = Boolean.TRUE.equals(call.getBoolean("enabled", false));
        if (enabled && !PlataSummaryNotification.permitted(getContext())) {
            call.reject("Permite las notificaciones en los ajustes del teléfono.");
            return;
        }
        PlataWidgetProvider.preferences(getContext()).edit().putBoolean("notificationEnabled", enabled).apply();
        PlataSummaryNotification.update(getContext());
        call.resolve();
    }

    @PluginMethod public void getStatus(PluginCall call) {
        JSObject result = new JSObject();
        result.put("notificationEnabled", PlataWidgetProvider.preferences(getContext()).getBoolean("notificationEnabled", false));
        call.resolve(result);
    }

    @PluginMethod public void getLaunchAction(PluginCall call) {
        Intent intent = getActivity().getIntent();
        JSObject result = new JSObject();
        result.put("action", intent.getStringExtra(PlataWidgetProvider.ACTION_EXTRA));
        intent.removeExtra(PlataWidgetProvider.ACTION_EXTRA);
        call.resolve(result);
    }

    @Override protected void handleOnNewIntent(Intent intent) {
        if (intent.hasExtra(PlataWidgetProvider.ACTION_EXTRA)) {
            getActivity().setIntent(intent);
            notifyListeners("launchAction", new JSObject(), true);
        }
    }
}
