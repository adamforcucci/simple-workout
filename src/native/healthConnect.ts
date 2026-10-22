import { registerPlugin, WebPlugin } from '@capacitor/core'
import type { HealthWorkout } from '../health/payload'

export type HealthAvailability = 'available' | 'update_required' | 'unavailable'

export interface HealthConnectPlugin {
  status(): Promise<{ availability: HealthAvailability; granted: boolean }>
  requestAccess(): Promise<{ granted: boolean }>
  openStore(): Promise<void>
  openSettings(): Promise<void>
  saveWorkout(workout: HealthWorkout): Promise<void>
  deleteWorkout(options: { id: number }): Promise<void>
}

// Health Connect only exists on Android.
class HealthConnectWeb extends WebPlugin {
  async status() {
    return { availability: 'unavailable' as const, granted: false }
  }
  async requestAccess() {
    return { granted: false }
  }
  async openStore() {}
  async openSettings() {}
  async saveWorkout() {}
  async deleteWorkout() {}
}

export const HealthConnect = registerPlugin<HealthConnectPlugin>('HealthConnect', {
  web: () => new HealthConnectWeb(),
})
