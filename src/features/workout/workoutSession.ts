import { Capacitor } from '@capacitor/core'
import { ensureBluetooth } from '../../ble/scan'
import { getDb } from '../../db/client'
import { appendHrSamples } from '../../db/repos/hr'
import { WorkoutService } from '../../native/workoutService'
import { useActiveWorkout, type ActiveWorkout } from '../../store/activeWorkout'
import { useHeartRate } from '../../store/heartRate'
import { useSettings } from '../../store/settings'

const PULL_INTERVAL_MS = 10_000

// Live (not editing) workouts run the native service; edits of past workouts don't.
const live = (w: ActiveWorkout | null) => (w && !w.editing ? w : null)

let session: { workoutId: number; startedAt: number; since: number } | null = null
let pulling: Promise<void> | null = null

async function pull(): Promise<void> {
  const s = session
  if (!s) return
  const { samples } = await WorkoutService.getSamples({ since: s.since })
  const own = samples.filter((x) => x.timestamp >= s.startedAt)
  if (own.length === 0) return
  await appendHrSamples(
    await getDb(),
    s.workoutId,
    own.map((x) => ({ t: Math.round((x.timestamp - s.startedAt) / 1000), bpm: x.bpm })),
  )
  s.since = own[own.length - 1].timestamp
}

// Moves buffered native samples into the database now (e.g. before finishing).
export function flushHeartRate(): Promise<void> {
  pulling ??= pull().finally(() => (pulling = null))
  return pulling
}

async function begin(w: ActiveWorkout) {
  const db = await getDb()
  // Resume after a restart from the last stored sample rather than re-reading.
  const last = await db.get<{ t: number | null }>('SELECT MAX(t_offset_s) AS t FROM hr_samples WHERE workout_id = ?', [
    w.workoutId,
  ])
  session = { workoutId: w.workoutId, startedAt: w.startedAt, since: w.startedAt + (last?.t ?? -1) * 1000 }
  await WorkoutService.start({ title: w.name })
  if (Capacitor.isNativePlatform() && w.rest && w.rest.endsAt > Date.now())
    await WorkoutService.setRestAlert({ endsAt: w.rest.endsAt, sound: useSettings.getState().restSound })
  if (useHeartRate.getState().device) {
    try {
      await ensureBluetooth()
      await useHeartRate.getState().connect()
    } catch {
      // Bluetooth off or permission denied: the workout carries on without HR.
    }
  }
}

async function end() {
  session = null
  await WorkoutService.cancelRestAlert()
  await WorkoutService.disconnectHeartRate()
  await WorkoutService.clearSamples()
  await WorkoutService.stop()
}

// Keeps the native service, HR connection, sample pulls and rest alarm in step
// with the active workout. Returns an unsubscribe function.
export function startWorkoutSession(): () => void {
  const timer = setInterval(() => void flushHeartRate(), PULL_INTERVAL_MS)
  const initial = live(useActiveWorkout.getState().workout)
  if (initial) void begin(initial)

  const unsubscribe = useActiveWorkout.subscribe((state, prev) => {
    const next = live(state.workout)
    const before = live(prev.workout)
    if (next?.workoutId !== before?.workoutId) {
      if (before) void end()
      if (next) void begin(next)
    }

    // Rest alarm: native so it fires with the screen off.
    if (Capacitor.isNativePlatform() && next?.rest?.endsAt !== before?.rest?.endsAt) {
      if (next?.rest) void WorkoutService.setRestAlert({ endsAt: next.rest.endsAt, sound: useSettings.getState().restSound })
      // Only an early skip cancels; when rest runs out the UI clears it at about
      // the moment the native alarm fires, and that mustn't race it.
      else if (before?.rest && Date.now() < before.rest.endsAt - 500) void WorkoutService.cancelRestAlert()
    }
  })

  return () => {
    clearInterval(timer)
    unsubscribe()
  }
}
