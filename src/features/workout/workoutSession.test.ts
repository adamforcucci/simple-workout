import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { migrate } from '../../db/migrations'
import { getHrSamples } from '../../db/repos/hr'
import { seedExercises } from '../../db/seed'
import { sqlJsDb } from '../../db/sqlJsDb'
import type { Db } from '../../db/types'

let db: Db
vi.mock('../../db/client', () => ({ getDb: () => Promise.resolve(db) }))
vi.mock('../../ble/scan', () => ({ ensureBluetooth: () => Promise.resolve() }))

// Fake native service: a sample buffer plus a call log.
const native = vi.hoisted(() => ({
  calls: [] as string[],
  buffer: [] as { timestamp: number; bpm: number }[],
}))
vi.mock('../../native/workoutService', () => ({
  WorkoutService: {
    start: async () => void native.calls.push('start'),
    stop: async () => void native.calls.push('stop'),
    connectHeartRate: async ({ deviceId }: { deviceId: string }) => void native.calls.push(`connect:${deviceId}`),
    disconnectHeartRate: async () => void native.calls.push('disconnect'),
    clearSamples: async () => void (native.buffer = []),
    getSamples: async ({ since }: { since: number }) => ({ samples: native.buffer.filter((s) => s.timestamp > since) }),
    setRestAlert: async () => void native.calls.push('rest'),
    cancelRestAlert: async () => void native.calls.push('cancelRest'),
    getState: async () => ({ running: false, hrState: 'disconnected', deviceId: null, bpm: 0, battery: -1 }),
    addListener: async () => ({ remove: async () => {} }),
  },
}))

const { useActiveWorkout } = await import('../../store/activeWorkout')
const { useHeartRate } = await import('../../store/heartRate')
const { flushHeartRate, startWorkoutSession } = await import('./workoutSession')

let stop: () => void

beforeEach(async () => {
  db = await sqlJsDb()
  await migrate(db)
  await seedExercises(db)
  native.calls = []
  native.buffer = []
  useActiveWorkout.setState({ workout: null, hydrated: true })
  useHeartRate.setState({ device: { deviceId: 'AA:BB', name: 'Helio Strap' } })
  stop = startWorkoutSession()
})

afterEach(() => stop())

const settle = () => new Promise((r) => setTimeout(r, 20))

describe('workout session', () => {
  test('starting a workout starts the service and connects the paired strap', async () => {
    await useActiveWorkout.getState().startEmpty()
    await settle()
    expect(native.calls).toEqual(['start', 'connect:AA:BB'])
  })

  test('pulls samples into the workout as second offsets, without duplicates', async () => {
    await useActiveWorkout.getState().startEmpty()
    await settle()
    const { workoutId, startedAt } = useActiveWorkout.getState().workout!
    native.buffer.push({ timestamp: startedAt - 5000, bpm: 70 }) // before the workout: ignored
    native.buffer.push({ timestamp: startedAt + 1000, bpm: 110 }, { timestamp: startedAt + 2000, bpm: 112 })
    await flushHeartRate()
    native.buffer.push({ timestamp: startedAt + 3000, bpm: 115 })
    await flushHeartRate()
    expect(await getHrSamples(db, workoutId)).toEqual([
      { t: 1, bpm: 110 },
      { t: 2, bpm: 112 },
      { t: 3, bpm: 115 },
    ])
  })

  test('finishing stops the service and disconnects', async () => {
    await useActiveWorkout.getState().startEmpty()
    await settle()
    native.calls = []
    await useActiveWorkout.getState().discard()
    await settle()
    expect(native.calls).toEqual(['cancelRest', 'disconnect', 'stop'])
  })

  test('editing a past workout does not start the service', async () => {
    await useActiveWorkout.getState().startEmpty()
    await settle()
    const { workoutId } = useActiveWorkout.getState().workout!
    await useActiveWorkout.getState().finish({ name: 'W', notes: '', calories: null, avgHr: null, maxHr: null, endedAt: Date.now() })
    await settle()
    native.calls = []
    await useActiveWorkout.getState().editFinished(workoutId)
    await settle()
    expect(native.calls).toEqual([])
  })
})
