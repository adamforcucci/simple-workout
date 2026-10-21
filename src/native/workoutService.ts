import { registerPlugin, WebPlugin, type PluginListenerHandle } from '@capacitor/core'

export type HrState = 'disconnected' | 'connecting' | 'connected' | 'unsupported'

export interface HrSampleRaw {
  timestamp: number // epoch ms
  bpm: number
}

export interface WorkoutServicePlugin {
  start(options: { title: string }): Promise<void>
  stop(): Promise<void>
  connectHeartRate(options: { deviceId: string }): Promise<void>
  disconnectHeartRate(): Promise<void>
  getSamples(options: { since: number }): Promise<{ samples: HrSampleRaw[] }>
  clearSamples(): Promise<void>
  getState(): Promise<{ running: boolean; hrState: HrState; deviceId: string | null; bpm: number; battery: number }>
  setRestAlert(options: { endsAt: number; sound: boolean }): Promise<void>
  cancelRestAlert(): Promise<void>
  addListener(event: 'heartRate', fn: (e: { timestamp: number; bpm: number; contact: boolean }) => void): Promise<PluginListenerHandle>
  addListener(event: 'hrState', fn: (e: { state: HrState }) => void): Promise<PluginListenerHandle>
  addListener(event: 'battery', fn: (e: { level: number }) => void): Promise<PluginListenerHandle>
}

export const SIMULATED_DEVICE_ID = 'simulated'

// Browser stand-in: a fake strap so workouts can be developed on desktop.
class WorkoutServiceWeb extends WebPlugin {
  private samples: HrSampleRaw[] = []
  private timer: ReturnType<typeof setInterval> | undefined
  private state: HrState = 'disconnected'
  private bpm = 0

  async start() {}
  async stop() {}

  async connectHeartRate({ deviceId }: { deviceId: string }) {
    clearInterval(this.timer)
    this.setState('connecting')
    setTimeout(() => {
      if (deviceId !== SIMULATED_DEVICE_ID) return this.setState('unsupported')
      this.setState('connected')
      this.notifyListeners('battery', { level: 87 })
      const t0 = Date.now()
      this.timer = setInterval(() => {
        const timestamp = Date.now()
        // Slow drift between ~100 and ~160 with a little noise, like sets and rests.
        this.bpm = Math.round(130 + 28 * Math.sin((timestamp - t0) / 40_000) + (Math.random() - 0.5) * 4)
        this.samples.push({ timestamp, bpm: this.bpm })
        this.notifyListeners('heartRate', { timestamp, bpm: this.bpm, contact: true })
      }, 1000)
    }, 600)
  }

  async disconnectHeartRate() {
    clearInterval(this.timer)
    this.setState('disconnected')
  }

  async getSamples({ since }: { since: number }) {
    return { samples: this.samples.filter((s) => s.timestamp > since) }
  }

  async clearSamples() {
    this.samples = []
  }

  async getState() {
    return { running: false, hrState: this.state, deviceId: null, bpm: this.bpm, battery: -1 }
  }

  async setRestAlert() {}
  async cancelRestAlert() {}

  private setState(state: HrState) {
    this.state = state
    this.notifyListeners('hrState', { state })
  }
}

export const WorkoutService = registerPlugin<WorkoutServicePlugin>('WorkoutService', {
  web: () => new WorkoutServiceWeb(),
})
