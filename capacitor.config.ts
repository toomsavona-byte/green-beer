import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.greenbeer.pizedes',
  appName: 'Green Beer Pizedes',
  webDir: 'dist',
  server: {
    androidScheme: 'http',
    cleartext: true,
  },
  android: {
    backgroundColor: '#090C11',
    allowMixedContent: true,
  },
};

export default config;
