import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.kutchihub.mobile',
  appName: 'Kutchi Hub',
  webDir: 'dist',
  server: {
    url: 'https://kutchi-hub.lovable.app',
    cleartext: false,
  },
};

export default config;