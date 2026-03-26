import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.vexel.pts.admin',
  appName: 'PTS Admin Hub',
  webDir: 'out',
  server: { url: 'https://pts-vexel.vercel.app/admin/dashboard', cleartext: true }
};

export default config;
