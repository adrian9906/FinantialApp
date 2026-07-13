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
      enabled: true,
    },
    SplashScreen: {
      androidSplashResourceName: 'splash',
      launchAutoHide: true,
      showSpinner: false,
    },
  },
};

export default config;
