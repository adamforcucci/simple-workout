import { beforeEach, describe, expect, test } from 'vitest'
import { exportBackup, importBackup } from './backup'
import { migrate } from './migrations'
import { appendHrSamples } from './repos/hr'
import { getJson, setJson } from './repos/kv'
import { getProfile, saveProfile, upsertBodyMetric } from './repos/profile'
import { saveRoutine } from './repos/routines'
import { finishWorkout, getWorkout, listWorkouts, startWorkout } from './repos/workouts'
import { seedExercises } from './seed'
import { sqlJsDb } from './sqlJsDb'
import type { Db } from './types'

async function freshDb(): Promise<Db> {
  const db = await sqlJsDb()
  await migrate(db)
  await seedExercises(db)
  return db
}

let source: Db
let workoutId: number

beforeEach(async () => {
  source = await freshDb()
  const bench = (await source.get<{ id: number }>("SELECT id FROM exercises WHERE strava_exercise_type = 'BARBELL_BENCH_PRESS'"))!.id
  await saveProfile(source, { name: 'Adam', dob: '1990-05-01', sex: 'male', heightCm: 180, maxHrOverride: null })
  await upsertBodyMetric(source, { date: '2026-10-01', weightKg: 82, bodyFatPct: null })
  await saveRoutine(source, {
    name: 'Push',
    notes: '',
    items: [{ exerciseId: bench, supersetGroup: null, targetSets: 3, targetReps: 8, targetWeightKg: null, targetDurationS: null, restS: 120 }],
  })
  workoutId = await startWorkout(source, { name: 'Push', routineId: null, startedAt: 1_000_000, utcOffsetS: 39600 })
  await finishWorkout(source, workoutId, {
    name: 'Push',
    notes: 'good',
    endedAt: 4_600_000,
    avgHr: 120,
    maxHr: 160,
    calories: 300,
    exercises: [
      {
        exerciseId: bench,
        supersetGroup: null,
        restS: 120,
        notes: '',
        sets: [{ type: 'normal', weightKg: 60, reps: 8, durationS: null, rpe: null, completedAt: 1_300_000 }],
      },
    ],
  })
  await appendHrSamples(source, workoutId, Array.from({ length: 5000 }, (_, t) => ({ t, bpm: 100 + (t % 40) })))
  await setJson(source, 'settings', { unit: 'lb' })
  await setJson(source, 'stravaAuth', { accessToken: 'secret' })
})

describe('backup', () => {
  test('round-trips everything into a fresh install', async () => {
    const backup = JSON.parse(JSON.stringify(await exportBackup(source)))
    const target = await freshDb()
    expect(await importBackup(target, backup)).toEqual({ workouts: 1 })

    expect(await getProfile(target)).toMatchObject({ name: 'Adam', dob: '1990-05-01' })
    expect(await getWorkout(target, workoutId)).toEqual(await getWorkout(source, workoutId))
    expect(await listWorkouts(target)).toEqual(await listWorkouts(source))
    expect((await target.get<{ n: number }>('SELECT COUNT(*) AS n FROM hr_samples'))!.n).toBe(5000)
    expect((await target.get<{ n: number }>('SELECT COUNT(*) AS n FROM routines'))!.n).toBe(1)
    expect(await getJson(target, 'settings')).toEqual({ unit: 'lb' })
  })

  test('never exports the Strava login, and keeps the current one on restore', async () => {
    const backup = await exportBackup(source)
    expect(JSON.stringify(backup)).not.toContain('secret')

    const target = await freshDb()
    await setJson(target, 'stravaAuth', { accessToken: 'target-token' })
    await importBackup(target, backup)
    expect(await getJson(target, 'stravaAuth')).toEqual({ accessToken: 'target-token' })
  })

  test('replaces rather than merges', async () => {
    const target = await freshDb()
    await startWorkout(target, { name: 'Old', routineId: null, startedAt: 5, utcOffsetS: 0 })
    await importBackup(target, await exportBackup(source))
    expect((await target.all<{ name: string }>('SELECT name FROM workouts')).map((w) => w.name)).toEqual(['Push'])
  })

  test('rejects foreign or future files and leaves data untouched', async () => {
    const target = await freshDb()
    await startWorkout(target, { name: 'Keep', routineId: null, startedAt: 5, utcOffsetS: 0 })
    const good = await exportBackup(source)
    await expect(importBackup(target, { hello: 'world' })).rejects.toThrow("isn't a backup from this app")
    await expect(importBackup(target, { ...good, schemaVersion: 99 })).rejects.toThrow('newer version')
    await expect(importBackup(target, { ...good, tables: { evil: { columns: ['x'], rows: [] } } })).rejects.toThrow('Unknown table')
    await expect(
      importBackup(target, { ...good, tables: { kv: { columns: ['key); DROP TABLE x; --'], rows: [] } } }),
    ).rejects.toThrow('malformed')
    expect((await target.all<{ name: string }>('SELECT name FROM workouts')).map((w) => w.name)).toEqual(['Keep'])
  })

  test('a failing insert rolls the whole restore back', async () => {
    const target = await freshDb()
    await startWorkout(target, { name: 'Keep', routineId: null, startedAt: 5, utcOffsetS: 0 })
    const backup = await exportBackup(source)
    backup.tables.sets.rows[0][backup.tables.sets.columns.indexOf('workout_exercise_id')] = 999_999 // broken FK
    await expect(importBackup(target, backup)).rejects.toThrow()
    expect((await target.all<{ name: string }>('SELECT name FROM workouts')).map((w) => w.name)).toEqual(['Keep'])
  })
})
