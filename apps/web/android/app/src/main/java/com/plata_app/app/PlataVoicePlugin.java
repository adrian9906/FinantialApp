package com.plata_app.app;

import android.Manifest;
import android.content.Intent;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.speech.RecognitionListener;
import android.speech.RecognizerIntent;
import android.speech.SpeechRecognizer;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import java.util.ArrayList;

@CapacitorPlugin(name = "PlataVoice", permissions = {@Permission(alias = "microphone", strings = {Manifest.permission.RECORD_AUDIO})})
public class PlataVoicePlugin extends Plugin {
    private SpeechRecognizer recognizer;
    private PluginCall pendingStart;
    private final Handler handler = new Handler(Looper.getMainLooper());
    private final Runnable timeout = () -> stopSession();
    private final Runnable finishTimeout = () -> fail("No se recibió un resultado. Reintenta o escribe.");

    @PluginMethod public void available(PluginCall call) {
        JSObject result = new JSObject();
        result.put("available", SpeechRecognizer.isRecognitionAvailable(getContext()));
        call.resolve(result);
    }
    @PluginMethod public void start(PluginCall call) {
        pendingStart = call;
        if (getPermissionState("microphone") != PermissionState.GRANTED) {
            requestPermissionForAlias("microphone", call, "microphoneGranted");
            return;
        }
        handler.postDelayed(() -> { if (pendingStart == call) { pendingStart = null; begin(call); } else call.reject("El dictado se canceló."); }, 200);
    }
    @PermissionCallback private void microphoneGranted(PluginCall call) {
        if (pendingStart != call) { call.reject("El dictado se canceló."); return; }
        if (getPermissionState("microphone") != PermissionState.GRANTED) { call.reject("Permite el micrófono para dictar."); return; }
        start(call);
    }
    private void begin(PluginCall call) {
        if (!SpeechRecognizer.isRecognitionAvailable(getContext())) { call.reject("Reconocimiento de voz no disponible."); return; }
        if (!getActivity().hasWindowFocus()) { call.reject("Abre el panel de Plata para dictar."); return; }
        cleanup();
        try {
            recognizer = SpeechRecognizer.createSpeechRecognizer(getContext());
            recognizer.setRecognitionListener(new RecognitionListener() {
                @Override public void onReadyForSpeech(Bundle params) {}
                @Override public void onBeginningOfSpeech() {}
                @Override public void onRmsChanged(float value) {}
                @Override public void onBufferReceived(byte[] buffer) {}
                @Override public void onEndOfSpeech() { handler.removeCallbacks(timeout); handler.postDelayed(finishTimeout, 5000); }
                @Override public void onError(int code) { fail(code == SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS ? "Permite el micrófono para dictar." : code == SpeechRecognizer.ERROR_NETWORK || code == SpeechRecognizer.ERROR_NETWORK_TIMEOUT ? "El reconocimiento necesita conexión. Reintenta o escribe." : "No se pudo reconocer la frase. Reintenta o escribe."); }
                @Override public void onResults(Bundle results) { emitResult(results, true); cleanup(); }
                @Override public void onPartialResults(Bundle results) { emitResult(results, false); }
                @Override public void onEvent(int type, Bundle params) {}
            });
            Intent intent = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
            intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
            intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE, call.getString("language", "es-ES"));
            intent.putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true);
            intent.putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 1);
            recognizer.startListening(intent);
            handler.postDelayed(timeout, 60000);
            call.resolve();
        } catch (Exception error) { cleanup(); call.reject("No se pudo iniciar el reconocimiento de voz.", error); }
    }
    private void emitResult(Bundle results, boolean complete) {
        ArrayList<String> matches = results.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);
        if (matches == null || matches.isEmpty()) { if (complete) fail("No se recibió un dictado."); return; }
        JSObject event = new JSObject(); event.put("text", matches.get(0)); event.put("final", complete);
        notifyListeners("voiceResult", event);
    }
    private void fail(String message) {
        JSObject event = new JSObject(); event.put("text", ""); event.put("final", true); event.put("error", message);
        notifyListeners("voiceResult", event); cleanup();
    }
    private void stopSession() {
        handler.removeCallbacks(timeout);
        if (recognizer != null) { recognizer.stopListening(); handler.postDelayed(finishTimeout, 5000); }
    }
    private void cleanup() {
        handler.removeCallbacks(timeout); handler.removeCallbacks(finishTimeout);
        if (recognizer != null) { recognizer.cancel(); recognizer.destroy(); recognizer = null; }
    }
    @PluginMethod public void stop(PluginCall call) { getActivity().runOnUiThread(() -> { stopSession(); call.resolve(); }); }
    @PluginMethod public void cancel(PluginCall call) { pendingStart = null; getActivity().runOnUiThread(() -> { cleanup(); call.resolve(); }); }
    @Override protected void handleOnPause() { handler.post(() -> { if (recognizer != null) fail("El dictado se detuvo al ocultar Plata."); }); }
    @Override protected void handleOnDestroy() { handler.post(this::cleanup); }
}
