import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.kutchihub.mobile',
  appName: 'Kutchi Hub',
  webDir: 'dist',
  server: {
    url: 'https://www.kutchihub.com',
    cleartext: false,
    allowNavigation: ['kutchihub.com', 'www.kutchihub.com'],
  },
};

export default config;
