import type { CapacitorConfig } from '@capacitor/cli';

// The app is a native shell around https://www.kutchihub.com (server.url). webDir only holds two tiny local pages:
// index.html (never really shown) and offline.html (shown by errorPath when the site cannot be reached).
const config: CapacitorConfig = {
  appId: 'app.kutchihub.mobile',
  appName: 'Kutchi Hub',
  webDir: 'native-www',
  server: {
    url: 'https://www.kutchihub.com',
    cleartext: false,
    allowNavigation: ['kutchihub.com', 'www.kutchihub.com'],
    errorPath: 'offline.html',
  },
};

export default config;
