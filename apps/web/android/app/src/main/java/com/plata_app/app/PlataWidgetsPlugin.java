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

@CapacitorPlugin(name = "PlataWidgets")
public class PlataWidgetsPlugin extends Plugin {
    @PluginMethod public void updateSummary(PluginCall call) {
        SharedPreferences.Editor prefs = PlataWidgetProvider.preferences(getContext()).edit();
        prefs.putBoolean("hasAccount", Boolean.TRUE.equals(call.getBoolean("hasAccount", false)));
        for (String key : new String[]{"accountName", "balance", "todayExpenses", "dateKey", "updatedLabel"}) {
            String value = call.getString(key, "");
            prefs.putString(key, value.length() > 160 ? value.substring(0, 160) : value);
        }
        prefs.apply();
        PlataWidgetProvider.updateAll(getContext());
        call.resolve();
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
