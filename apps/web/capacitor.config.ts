import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.plata_app.app',
  appName: '@plata/web',
  webDir: 'dist',
  server: {
    url: 'https://petronovacaribe.com/web/',
    androidScheme: 'https'
  }
};

export default config;
