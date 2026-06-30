import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.plata_app.app',
  appName: 'Plata App',
  webDir: 'dist',
  server: {
    url: 'https://finantial-app-web.vercel.app/',
    androidScheme: 'https',
  },
  plugins: {
    SplashScreen: {
      androidSplashResourceName: 'splash',
      launchAutoHide: true,
      showSpinner: false,
    },
  },
};

export default config;
