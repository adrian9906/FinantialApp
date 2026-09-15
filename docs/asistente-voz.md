# Asistente de voz

En Ajustes puedes activar el micrófono flotante y elegir la variante de español. Pulsa Dictar, o escribe una frase como «gasto pan 5 USD y gusto cine 20 USD». Revisa los borradores, completa los datos ambiguos y guarda uno o varios. Se crean pendientes salvo que indiques que están pagados. Minimizar conserva los borradores durante la sesión; cerrar sesión los descarta.

El reconocimiento utiliza el servicio de Android o SpeechRecognition del navegador, sin API de IA. Según el dispositivo, idioma y navegador puede necesitar conexión. La entrada escrita siempre está disponible.

## Android

La burbuja sobre otras aplicaciones se activa desde Ajustes, concediendo los permisos de superposición y notificaciones. Abre un panel compacto con la misma sesión y almacenamiento de Plata. El micrófono se inicia al pulsar Dictar con el panel visible; no escucha en segundo plano. La notificación permite detener la burbuja.

La compilación necesita JDK 21 y Android SDK 35. El script `scripts/setup-android-tools.ps1 -AcceptAndroidLicense` instala herramientas en `.codex-tools` y genera `apps/web/android/local.properties`. El parámetro acepta explícitamente la licencia del SDK. Si ya tienes Android Studio, configura `sdk.dir` en ese archivo con tu SDK instalado y usa tu JDK 21.

Después ejecuta `pnpm build:web`, `pnpm --dir apps/web android:sync` y, con JAVA_HOME apuntando al JDK 21, `apps/web/android/gradlew.bat -p apps/web/android :app:assembleDebug`. La APK resultante queda en `apps/web/android/app/build/outputs/apk/debug/app-debug.apk`.

## Validación pendiente

Las pruebas de interpretación, presupuesto acumulado, saldo, reintentos y fallos de persistencia pasan. El panel web se verificó a 320 y 375 píxeles sin desbordamiento horizontal.

El 15 de septiembre de 2026 se resolvió la descarga usando la ruta de distribución de Google `redirector.gvt1.com/edgedl/android/repository/`: el índice y los archivos descargados se verificaron contra sus hashes oficiales. Se instalaron SDK 35 y build-tools 35.0.0. Gradle completó `assembleDebug` y `assembleRelease`, incluida la comprobación lint de release. La firma de la APK universal se verificó con apksigner. Archivo entregado: `Plata-App-v1.3.0-voz.apk` (SHA-256 `d743d484b2f6db912343fa049a25eba0d1b66a5b05744c9020285148d1460694`).

Falta probar en un Android real: reconocimiento y permisos, abrir el panel desde otra aplicación tanto con Plata cerrada como abierta, teclado, rotación, botón Atrás, pantalla bloqueada y retirada de permisos. La tarea permanece en Doing hasta cerrar estas comprobaciones.
