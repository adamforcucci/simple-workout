import { create } from 'zustand'
import { getDb } from '../db/client'
import { getHrSamples } from '../db/repos/hr'
import { getWorkout, listWorkouts } from '../db/repos/workouts'
import { buildHealthWorkout } from '../health/payload'
import { HealthConnect, type HealthAvailability } from '../native/healthConnect'
import { useSettings } from './settings'

interface HealthConnectStore {
  availability: HealthAvailability | null
  granted: boolean
  error: string | null
  // Progress of "add past workouts": done / total, null when idle.
  backfill: { done: number; total: number } | null
  load: () => Promise<void>
  enable: () => Promise<void>
  disable: () => Promise<void>
  save: (workoutId: number) => Promise<void>
  remove: (workoutId: number) => Promise<void>
  saveAll: () => Promise<void>
}

const message = (err: unknown) => (err instanceof Error ? err.message : String(err))

async function write(workoutId: number) {
  const db = await getDb()
  const workout = await getWorkout(db, workoutId)
  if (!workout || workout.endedAt === null) return
  await HealthConnect.saveWorkout(buildHealthWorkout(workout, await getHrSamples(db, workoutId)))
}

export const useHealthConnect = create<HealthConnectStore>((set, get) => {
  // Writes only while switched on and still permitted (access can be revoked
  // in Health Connect's own settings at any time).
  const active = () => useSettings.getState().healthConnect && get().granted

  return {
    availability: null,
    granted: false,
    error: null,
    backfill: null,

    async load() {
      try {
        const { availability, granted } = await HealthConnect.status()
        set({ availability, granted })
      } catch (err) {
        set({ availability: 'unavailable', error: message(err) })
      }
    },

    async enable() {
      set({ error: null })
      try {
        const { granted } = await HealthConnect.requestAccess()
        set({ granted })
        if (granted) await useSettings.getState().update({ healthConnect: true })
        else set({ error: 'Health Connect access wasn’t granted' })
      } catch (err) {
        set({ error: message(err) })
      }
    },

    async disable() {
      await useSettings.getState().update({ healthConnect: false })
    },

    async save(workoutId) {
      if (!active()) return
      try {
        await write(workoutId)
        set({ error: null })
      } catch (err) {
        set({ error: `Couldn’t save to Health Connect: ${message(err)}` })
      }
    },

    async remove(workoutId) {
      if (!active()) return
      await HealthConnect.deleteWorkout({ id: workoutId }).catch(() => {})
    },

    async saveAll() {
      if (!active() || get().backfill) return
      const workouts = await listWorkouts(await getDb())
      set({ backfill: { done: 0, total: workouts.length }, error: null })
      try {
        for (const [i, w] of workouts.entries()) {
          await write(w.id)
          set({ backfill: { done: i + 1, total: workouts.length } })
        }
      } catch (err) {
        set({ error: `Couldn’t save to Health Connect: ${message(err)}` })
      } finally {
        set({ backfill: null })
      }
    },
  }
})
