import { Battery, Bluetooth, ChevronLeft, Heart, Loader2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { ensureBluetooth, scan, type FoundDevice } from '../../ble/scan'
import { WorkoutService } from '../../native/workoutService'
import { useActiveWorkout } from '../../store/activeWorkout'
import { useHeartRate } from '../../store/heartRate'

const STATE_LABEL = {
  disconnected: 'Not connected',
  connecting: 'Connecting…',
  connected: 'Connected',
  unsupported: 'No heart rate service found',
} as const

export function HeartRateSettings() {
  const navigate = useNavigate()
  const { device, state, bpm, contact, battery, pair, forget } = useHeartRate()
  const workoutLive = useActiveWorkout((s) => !!s.workout && !s.workout.editing)
  const [found, setFound] = useState<FoundDevice[]>([])
  const [scanning, setScanning] = useState(false)
  const [scanned, setScanned] = useState(false)
  const [showAll, setShowAll] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const stopScan = useRef<(() => Promise<void>) | null>(null)

  // Connect to the paired strap while this screen is open so you can check it
  // reads; leave it connected only if a workout is running.
  useEffect(() => {
    if (device) void ensureBluetooth().then(() => useHeartRate.getState().connect()).catch(() => {})
    return () => {
      if (!useActiveWorkout.getState().workout) void WorkoutService.disconnectHeartRate()
    }
  }, [device])

  useEffect(() => () => void stopScan.current?.(), [])

  const startScan = async () => {
    setError(null)
    setFound([])
    setScanning(true)
    setScanned(true)
    try {
      stopScan.current = await scan((d) =>
        setFound((xs) => (xs.some((x) => x.deviceId === d.deviceId) ? xs : [...xs, d].sort((a, b) => (b.rssi ?? -999) - (a.rssi ?? -999)))),
      )
      setTimeout(() => setScanning(false), 15_000)
    } catch (e) {
      setScanning(false)
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  const choose = async (d: FoundDevice) => {
    await stopScan.current?.()
    setScanning(false)
    await pair({ deviceId: d.deviceId, name: d.name })
  }

  const hrDevices = found.filter((d) => d.advertisesHeartRate)
  const others = found.filter((d) => !d.advertisesHeartRate)

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center gap-2 border-b border-line px-3 py-3">
        <button onClick={() => navigate(-1)} aria-label="Back" className="p-1 text-muted">
          <ChevronLeft size={24} />
        </button>
        <h1 className="flex-1 font-semibold">Heart rate monitor</h1>
      </header>

      <main className="flex-1 space-y-4 overflow-y-auto p-4">
        {device && (
          <section className="space-y-3 rounded-xl bg-surface p-4">
            <div className="flex items-center gap-3">
              <Heart size={22} className={state === 'connected' ? 'fill-red-500 text-red-500' : 'text-faint'} />
              <div className="flex-1">
                <p className="font-semibold">{device.name}</p>
                <p className="text-sm text-muted">{STATE_LABEL[state]}</p>
              </div>
              {battery !== null && (
                <span className="flex items-center gap-1 text-sm text-muted">
                  <Battery size={16} /> {battery}%
                </span>
              )}
            </div>
            <p className="text-center text-5xl font-semibold">
              {state === 'connected' && bpm !== null ? bpm : '–'}
              <span className="ml-1 text-base font-normal text-muted">bpm</span>
            </p>
            {state === 'connected' && !contact && (
              <p className="text-center text-sm text-warn">No skin contact — wet the strap's sensors and check the fit.</p>
            )}
            {state === 'unsupported' && (
              <p className="text-sm text-warn">
                This device didn't offer standard Bluetooth heart rate. If it's a strap or watch, turn on its heart rate
                broadcast and try again.
              </p>
            )}
            <button
              onClick={() => {
                if (workoutLive && !confirm('A workout is running. Stop recording heart rate from this device?')) return
                void forget()
              }}
              className="w-full rounded-lg bg-raised py-2.5 text-sm text-bad"
            >
              Forget device
            </button>
          </section>
        )}

        <section className="space-y-3">
          <button
            onClick={() => void startScan()}
            disabled={scanning}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-accent py-3 font-semibold text-black disabled:opacity-60"
          >
            {scanning ? <Loader2 size={18} className="animate-spin" /> : <Bluetooth size={18} />}
            {scanning ? 'Scanning…' : device ? 'Pair a different device' : 'Find heart rate monitor'}
          </button>
          {error && <p className="text-sm text-bad">{error}</p>}
          <p className="text-xs text-subtle">
            Wear the strap (or start its heart rate broadcast) so it's awake. Chest straps like Wahoo TICKR wake when
            worn; Amazfit Helio Strap may need heart rate broadcast turned on in the Zepp app.
          </p>

          {hrDevices.length > 0 && (
            <DeviceList title="Heart rate monitors" devices={hrDevices} selected={device?.deviceId} onChoose={choose} />
          )}
          {others.length > 0 && (
            <>
              <button onClick={() => setShowAll((s) => !s)} className="text-sm text-muted underline">
                {showAll ? 'Hide' : 'Show'} other Bluetooth devices ({others.length})
              </button>
              {showAll && (
                <DeviceList
                  title="Other devices (may not support heart rate)"
                  devices={others}
                  selected={device?.deviceId}
                  onChoose={choose}
                />
              )}
            </>
          )}
          {!scanning && found.length === 0 && scanned && (
            <p className="text-center text-sm text-subtle">Nothing found. Make sure the strap is awake and nearby.</p>
          )}
        </section>
      </main>
    </div>
  )
}

function DeviceList({
  title,
  devices,
  selected,
  onChoose,
}: {
  title: string
  devices: FoundDevice[]
  selected: string | undefined
  onChoose: (d: FoundDevice) => void
}) {
  return (
    <div>
      <p className="mb-1 text-sm font-medium text-muted">{title}</p>
      <ul className="overflow-hidden rounded-xl bg-surface">
        {devices.map((d) => (
          <li key={d.deviceId} className="border-t border-line first:border-t-0">
            <button onClick={() => onChoose(d)} className="flex w-full items-center gap-3 px-4 py-3 text-left active:bg-raised">
              <span className="flex-1">
                <span className="block">{d.name}</span>
                <span className="text-xs text-subtle">{d.deviceId}</span>
              </span>
              {selected === d.deviceId ? (
                <span className="text-sm text-accent-ink">Paired</span>
              ) : (
                d.rssi !== null && <span className="text-xs text-subtle">{d.rssi} dBm</span>
              )}
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
