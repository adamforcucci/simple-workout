import { BleClient, numberToUUID } from '@capacitor-community/bluetooth-le'
import { Capacitor } from '@capacitor/core'
import { SIMULATED_DEVICE_ID } from '../native/workoutService'

export const HEART_RATE_SERVICE = numberToUUID(0x180d)

export interface FoundDevice {
  deviceId: string
  name: string
  rssi: number | null
  advertisesHeartRate: boolean
}

let initialized = false

// Requests Bluetooth permissions (and asks to turn Bluetooth on) once.
export async function ensureBluetooth(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return
  if (!initialized) {
    await BleClient.initialize({ androidNeverForLocation: true })
    initialized = true
  }
  if (!(await BleClient.isEnabled())) await BleClient.requestEnable()
}

// Scans for nearby devices. Everything with a name is reported (some straps
// only advertise the heart rate service once connected); the caller sorts.
export async function scan(onFound: (d: FoundDevice) => void, durationMs = 15_000): Promise<() => Promise<void>> {
  if (!Capacitor.isNativePlatform()) {
    setTimeout(() => onFound({ deviceId: SIMULATED_DEVICE_ID, name: 'Simulated strap', rssi: -50, advertisesHeartRate: true }), 500)
    return async () => {}
  }
  await ensureBluetooth()
  await BleClient.requestLEScan({ allowDuplicates: false }, (r) => {
    const name = r.localName ?? r.device.name
    if (!name) return
    onFound({
      deviceId: r.device.deviceId,
      name,
      rssi: r.rssi ?? null,
      advertisesHeartRate: (r.uuids ?? []).some((u) => u.toLowerCase() === HEART_RATE_SERVICE),
    })
  })
  const timer = setTimeout(() => void BleClient.stopLEScan(), durationMs)
  return async () => {
    clearTimeout(timer)
    await BleClient.stopLEScan()
  }
}
