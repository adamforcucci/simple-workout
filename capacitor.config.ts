import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'au.com.adam.gym',
  appName: 'Simple Workout',
  webDir: 'dist',
  // Capacitor's debug logging echoes plugin traffic (incl. Strava tokens) to logcat.
  loggingBehavior: 'none',
  plugins: {
    CapacitorSQLite: {
      androidIsEncryption: false,
    },
  },
}

export default config
