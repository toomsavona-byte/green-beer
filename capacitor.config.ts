import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.greenbeer.pizedes',
  appName: 'Green Beer Pizedes',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
  android: {
    backgroundColor: '#090C11',
    allowMixedContent: false,
  },
};

export default config;
