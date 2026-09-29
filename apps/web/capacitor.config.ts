import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.plata_app.app',
  appName: 'Plata App',
  webDir: 'dist',
  plugins: {
    CapacitorCookies: {
      enabled: true,
    },
    CapacitorHttp: {
      // Use the WebView fetch implementation for every API method. The native
      // patch routes GET and POST through different transports, which can
      // leave a sync half-finished after Android reconnects to the network.
      enabled: false,
    },
    SplashScreen: {
      androidSplashResourceName: 'splash',
      launchAutoHide: true,
      showSpinner: false,
    },
  },
};

export default config;
