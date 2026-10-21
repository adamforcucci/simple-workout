import { create } from 'zustand'
import { getDb } from '../db/client'
import { deleteKey, getJson, setJson } from '../db/repos/kv'
import { WorkoutService, type HrState } from '../native/workoutService'

export interface PairedDevice {
  deviceId: string
  name: string
}

const KEY = 'hrDevice'

interface HeartRateStore {
  device: PairedDevice | null
  state: HrState
  bpm: number | null
  contact: boolean
  battery: number | null
  lastReadingAt: number | null
  load: () => Promise<void>
  pair: (d: PairedDevice) => Promise<void>
  forget: () => Promise<void>
  connect: () => Promise<void>
  disconnect: () => Promise<void>
}

export const useHeartRate = create<HeartRateStore>((set, get) => ({
  device: null,
  state: 'disconnected',
  bpm: null,
  contact: true,
  battery: null,
  lastReadingAt: null,

  async load() {
    set({ device: (await getJson<PairedDevice>(await getDb(), KEY)) ?? null })
    // Live readings arrive from the native service whoever started the connection.
    void WorkoutService.addListener('heartRate', (e) => set({ bpm: e.bpm, contact: e.contact, lastReadingAt: e.timestamp }))
    void WorkoutService.addListener('hrState', (e) => set({ state: e.state, ...(e.state !== 'connected' && { bpm: null }) }))
    void WorkoutService.addListener('battery', (e) => set({ battery: e.level }))
    const s = await WorkoutService.getState()
    set({ state: s.hrState, battery: s.battery >= 0 ? s.battery : null })
  },

  async pair(d) {
    await setJson(await getDb(), KEY, d)
    set({ device: d, battery: null })
  },

  async forget() {
    await WorkoutService.disconnectHeartRate()
    await deleteKey(await getDb(), KEY)
    set({ device: null, bpm: null, battery: null })
  },

  async connect() {
    const d = get().device
    if (d) await WorkoutService.connectHeartRate({ deviceId: d.deviceId })
  },

  async disconnect() {
    await WorkoutService.disconnectHeartRate()
  },
}))
