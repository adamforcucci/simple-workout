import { beforeEach, describe, expect, test } from 'vitest'
import { migrate } from './migrations'
import { appendHrSamples, getHrSamples, hrSummary } from './repos/hr'
import { getJson, setJson } from './repos/kv'
import { bodyWeightOn, getProfile, saveProfile, upsertBodyMetric } from './repos/profile'
import { createCustomExercise, searchExercises } from './repos/exercises'
import { getRoutine, listRoutines, saveRoutine } from './repos/routines'
import {
  exerciseHistory,
  finishWorkout,
  getInProgressWorkout,
  getWorkout,
  listWorkouts,
  previousSets,
  startWorkout,
  type LoggedExercise,
} from './repos/workouts'
import { seedExercises } from './seed'
import { sqlJsDb } from './sqlJsDb'
import type { Db } from './types'

let db: Db

beforeEach(async () => {
  db = await sqlJsDb()
  await migrate(db)
  await seedExercises(db)
})

const idOf = async (stravaId: string) =>
  (await db.get<{ id: number }>('SELECT id FROM exercises WHERE strava_exercise_type = ?', [stravaId]))!.id

describe('migrations and seed', () => {
  test('are idempotent', async () => {
    await migrate(db)
    expect(await seedExercises(db)).toBe(0)
    expect((await db.get<{ n: number }>('SELECT COUNT(*) AS n FROM exercises'))!.n).toBe(656)
  })
})

describe('profile', () => {
  test('saves profile and looks up body weight by date', async () => {
    await saveProfile(db, { name: 'Adam', dob: '1990-01-01', sex: 'male', heightCm: 180, maxHrOverride: null })
    expect(await getProfile(db)).toMatchObject({ name: 'Adam', sex: 'male' })
    await upsertBodyMetric(db, { date: '2026-10-01', weightKg: 82, bodyFatPct: null })
    await upsertBodyMetric(db, { date: '2026-10-15', weightKg: 81, bodyFatPct: null })
    await upsertBodyMetric(db, { date: '2026-10-15', weightKg: 80.5, bodyFatPct: null })
    expect(await bodyWeightOn(db, '2026-10-10')).toBe(82)
    expect(await bodyWeightOn(db, '2026-10-20')).toBe(80.5)
    expect(await bodyWeightOn(db, '2026-09-01')).toBeNull()
  })
})

describe('exercises', () => {
  test('search by words, muscle and equipment', async () => {
    const r = await searchExercises(db, { query: 'bench barbell' })
    expect(r.map((e) => e.name)).toContain('Barbell Bench Press')
    expect(r.every((e) => /bench/i.test(e.name) && /barbell/i.test(e.name))).toBe(true)

    const calves = await searchExercises(db, { muscle: 'calves', equipment: 'machine' })
    expect(calves.length).toBeGreaterThan(0)
    expect(calves.every((e) => e.primaryMuscles.includes('calves') && e.equipment === 'machine')).toBe(true)
  })

  test('custom exercise can reuse a built-in Strava ID', async () => {
    const id = await createCustomExercise(db, {
      name: 'Paused Bench',
      stravaExerciseType: 'BARBELL_BENCH_PRESS',
      category: 'Bench Press',
      primaryMuscles: ['chest'],
      secondaryMuscles: [],
      equipment: 'barbell',
      tracking: 'weight_reps',
      defaultRestS: 120,
    })
    expect(id).toBeGreaterThan(656)
  })
})

describe('routines', () => {
  test('save, edit and list', async () => {
    const bench = await idOf('BARBELL_BENCH_PRESS')
    const row = await idOf('DUMBBELL_ROW')
    const id = await saveRoutine(db, {
      name: 'Push/Pull',
      notes: '',
      items: [
        { exerciseId: bench, supersetGroup: 1, targetSets: 3, targetReps: 8, restS: 90 },
        { exerciseId: row, supersetGroup: 1, targetSets: 3, targetReps: 10, restS: 90 },
      ],
    })
    await saveRoutine(db, { ...(await getRoutine(db, id))!, name: 'Upper' })
    expect(await listRoutines(db)).toEqual([{ id, name: 'Upper', exerciseNames: ['Barbell Bench Press', 'Dumbbell Row'] }])
    expect((await getRoutine(db, id))!.items).toHaveLength(2)
  })
})

describe('workouts', () => {
  const t0 = new Date('2026-10-20T07:00:00Z').getTime()

  async function logWorkout(startedAt: number, weight: number) {
    const bench = await idOf('BARBELL_BENCH_PRESS')
    const id = await startWorkout(db, { name: 'Push', routineId: null, startedAt, utcOffsetS: 39600 })
    const exercises: LoggedExercise[] = [
      {
        exerciseId: bench,
        supersetGroup: null,
        restS: 120,
        notes: '',
        sets: [
          { type: 'warmup', weightKg: 40, reps: 10, durationS: null, rpe: null, completedAt: startedAt + 60_000 },
          { type: 'normal', weightKg: weight, reps: 8, durationS: null, rpe: 8, completedAt: startedAt + 300_000 },
          { type: 'normal', weightKg: weight, reps: 7, durationS: null, rpe: 9, completedAt: startedAt + 500_000 },
        ],
      },
    ]
    await finishWorkout(db, id, {
      name: 'Push',
      notes: '',
      endedAt: startedAt + 3_600_000,
      exercises,
      avgHr: 120,
      maxHr: 160,
      calories: 300,
    })
    return { id, bench }
  }

  test('in-progress workout is found until finished', async () => {
    const id = await startWorkout(db, { name: 'Legs', routineId: null, startedAt: t0, utcOffsetS: 0 })
    expect((await getInProgressWorkout(db))?.id).toBe(id)
    expect(await listWorkouts(db)).toHaveLength(0)
  })

  test('finish, read back, list with volume', async () => {
    const { id } = await logWorkout(t0, 60)
    const w = (await getWorkout(db, id))!
    expect(w.exercises[0]).toMatchObject({ name: 'Barbell Bench Press', stravaExerciseType: 'BARBELL_BENCH_PRESS' })
    expect(w.exercises[0].sets.map((s) => s.type)).toEqual(['warmup', 'normal', 'normal'])

    const [summary] = await listWorkouts(db)
    expect(summary).toMatchObject({ id, exerciseCount: 1, setCount: 2, volumeKg: 60 * 15 })
    expect(await getInProgressWorkout(db)).toBeUndefined()
  })

  test('finishing twice replaces rather than duplicates', async () => {
    const { id, bench } = await logWorkout(t0, 60)
    await finishWorkout(db, id, {
      name: 'Push (edited)',
      notes: '',
      endedAt: t0 + 3_600_000,
      exercises: [{ exerciseId: bench, supersetGroup: null, restS: 120, notes: '', sets: [] }],
      avgHr: null,
      maxHr: null,
      calories: null,
    })
    const w = (await getWorkout(db, id))!
    expect(w.name).toBe('Push (edited)')
    expect(w.exercises).toHaveLength(1)
    expect(w.exercises[0].sets).toHaveLength(0)
  })

  test('previous sets and exercise history', async () => {
    const day = 86_400_000
    await logWorkout(t0, 60)
    const { bench } = await logWorkout(t0 + 2 * day, 62.5)
    expect((await previousSets(db, bench, t0 + 3 * day))[1].weightKg).toBe(62.5)
    expect((await previousSets(db, bench, t0 + day))[1].weightKg).toBe(60)
    expect(await previousSets(db, bench, t0)).toEqual([])
    expect((await exerciseHistory(db, bench)).map((s) => s.sets[1].weightKg)).toEqual([60, 62.5])
    expect(await listWorkouts(db, { from: t0 + day })).toHaveLength(1)
  })

  test('hr samples cascade with the workout', async () => {
    const { id } = await logWorkout(t0, 60)
    await appendHrSamples(db, id, [
      { t: 0, bpm: 100 },
      { t: 1, bpm: 110 },
      { t: 1, bpm: 111 },
      { t: 2, bpm: 140 },
    ])
    expect(await getHrSamples(db, id)).toHaveLength(3)
    expect(await hrSummary(db, id)).toEqual({ avg: 117, max: 140 })
    await db.run('DELETE FROM workouts WHERE id = ?', [id])
    expect(await getHrSamples(db, id)).toHaveLength(0)
  })
})

describe('kv', () => {
  test('json round-trip and overwrite', async () => {
    await setJson(db, 'draft', { a: 1 })
    await setJson(db, 'draft', { a: 2 })
    expect(await getJson(db, 'draft')).toEqual({ a: 2 })
    expect(await getJson(db, 'missing')).toBeUndefined()
  })
})
