import { beforeEach, describe, expect, test, vi } from 'vitest'
import { migrate } from '../db/migrations'
import { getJson } from '../db/repos/kv'
import { saveRoutine } from '../db/repos/routines'
import { getWorkout, listWorkouts } from '../db/repos/workouts'
import { seedExercises } from '../db/seed'
import { sqlJsDb } from '../db/sqlJsDb'
import type { Db } from '../db/types'

let db: Db
vi.mock('../db/client', () => ({ getDb: () => Promise.resolve(db) }))

const { suggestSet, useActiveWorkout } = await import('./activeWorkout')
const store = () => useActiveWorkout.getState()
const workout = () => store().workout!

const idOf = async (stravaId: string) =>
  (await db.get<{ id: number }>('SELECT id FROM exercises WHERE strava_exercise_type = ?', [stravaId]))!.id

beforeEach(async () => {
  await store().flush() // don't let a pending save from the last test land in the new db
  db = await sqlJsDb()
  await migrate(db)
  await seedExercises(db)
  useActiveWorkout.setState({ workout: null, hydrated: false })
})

async function startSuperset() {
  const bench = await idOf('BARBELL_BENCH_PRESS')
  const row = await idOf('DUMBBELL_ROW')
  const routineId = await saveRoutine(db, {
    name: 'Upper',
    notes: '',
    items: [
      { exerciseId: bench, supersetGroup: 1, targetSets: 2, targetReps: 8, restS: 90 },
      { exerciseId: row, supersetGroup: 1, targetSets: 2, targetReps: 10, restS: 60 },
    ],
  })
  await store().startFromRoutine(routineId)
  return { bench, row, routineId }
}

describe('active workout store', () => {
  test('starting from a routine builds exercises and sets', async () => {
    await startSuperset()
    expect(workout().name).toBe('Upper')
    expect(workout().exercises.map((e) => [e.name, e.sets.length, e.supersetGroup])).toEqual([
      ['Barbell Bench Press', 2, 1],
      ['Dumbbell Row', 2, 1],
    ])
  })

  test('superset: no rest mid-round, rest after the last exercise', async () => {
    await startSuperset()
    const [bench, row] = workout().exercises
    store().updateSet(bench.key, bench.sets[0].key, { weightKg: 60 })
    expect(store().toggleSet(bench.key, bench.sets[0].key)).toBe(1)
    expect(workout().rest).toBeNull()
    expect(workout().exercises[0].sets[0]).toMatchObject({ weightKg: 60, reps: 8 })

    expect(store().toggleSet(row.key, row.sets[0].key)).toBeNull()
    const rest = workout().rest!
    expect(rest.endsAt - rest.startedAt).toBe(60_000)
  })

  test('suggestions cascade down from a typed or suggested set above', async () => {
    await startSuperset()
    const bench = workout().exercises[0]
    store().updateSet(bench.key, bench.sets[0].key, { weightKg: 60 })
    expect(suggestSet(workout().exercises[0], 1)).toEqual({ weightKg: 60, reps: 8, durationS: null })
  })

  test('blank sets copy the set above; nothing to copy means it cannot complete', async () => {
    await store().startEmpty()
    await store().addExercises([await idOf('DIAMOND_PUSH_UP')], false)
    const ex = workout().exercises[0]
    expect(store().toggleSet(ex.key, ex.sets[0].key)).toBe(false)

    store().updateSet(ex.key, ex.sets[0].key, { reps: 15 })
    store().toggleSet(ex.key, ex.sets[0].key)
    store().addSet(ex.key)
    store().updateSet(ex.key, workout().exercises[0].sets[1].key, { reps: null })
    store().toggleSet(ex.key, workout().exercises[0].sets[1].key)
    expect(workout().exercises[0].sets[1]).toMatchObject({ reps: 15 })
    expect(workout().exercises[0].sets[1].completedAt).not.toBeNull()
  })

  test('draft is persisted and restored after a restart', async () => {
    await startSuperset()
    const [bench] = workout().exercises
    store().updateSet(bench.key, bench.sets[0].key, { weightKg: 70 })
    await vi.waitFor(async () => {
      const draft = await getJson<{ exercises: { sets: { weightKg: number | null }[] }[] }>(db, 'activeWorkout')
      expect(draft?.exercises[0].sets[0].weightKg).toBe(70)
    })

    useActiveWorkout.setState({ workout: null, hydrated: false })
    await store().hydrate()
    expect(workout().exercises[0].sets[0].weightKg).toBe(70)
  })

  test('finish saves only completed sets and the next session sees them as previous', async () => {
    const { routineId } = await startSuperset()
    const [bench] = workout().exercises
    store().updateSet(bench.key, bench.sets[0].key, { weightKg: 60 })
    store().toggleSet(bench.key, bench.sets[0].key)
    const id = await store().finish({ name: 'Upper', notes: '', calories: 250, avgHr: null, maxHr: null, endedAt: Date.now() })

    expect(store().workout).toBeNull()
    expect(await getJson(db, 'activeWorkout')).toBeUndefined()
    const saved = (await getWorkout(db, id))!
    expect(saved.exercises).toHaveLength(1)
    expect(saved.exercises[0].sets).toHaveLength(1)
    expect((await listWorkouts(db))[0]).toMatchObject({ id, calories: 250, volumeKg: 480 })

    await new Promise((r) => setTimeout(r, 5)) // the next session must start later
    await store().startFromRoutine(routineId)
    expect(workout().exercises[0].previous[0]).toMatchObject({ weightKg: 60, reps: 8 })
  })

  test('editing a finished workout replaces its sets and keeps its times', async () => {
    await startSuperset()
    const [bench] = workout().exercises
    store().updateSet(bench.key, bench.sets[0].key, { weightKg: 60 })
    store().toggleSet(bench.key, bench.sets[0].key)
    const endedAt = Date.now() - 1000
    const id = await store().finish({ name: 'Upper', notes: 'good', calories: 200, avgHr: 120, maxHr: 150, endedAt })
    const original = (await getWorkout(db, id))!

    await store().editFinished(id)
    expect(workout().editing).toMatchObject({ endedAt, avgHr: 120, notes: 'good' })
    const ex = workout().exercises[0]
    store().updateSet(ex.key, ex.sets[0].key, { weightKg: 65 })
    store().toggleSet(ex.key, ex.sets[0].key) // un-complete…
    store().toggleSet(ex.key, ex.sets[0].key) // …and complete again: no rest while editing
    expect(workout().rest).toBeNull()

    // Survives a restart mid-edit.
    await store().flush()
    useActiveWorkout.setState({ workout: null, hydrated: false })
    await store().hydrate()
    expect(workout().editing).toBeDefined()

    await store().finish({ name: 'Upper', notes: 'good', calories: 200, avgHr: 120, maxHr: 150, endedAt })
    const edited = (await getWorkout(db, id))!
    expect(edited.exercises[0].sets[0].weightKg).toBe(65)
    expect([edited.startedAt, edited.endedAt]).toEqual([original.startedAt, original.endedAt])
    expect(await listWorkouts(db)).toHaveLength(1)
  })

  test('cancelling an edit keeps the original', async () => {
    await startSuperset()
    const [bench] = workout().exercises
    store().updateSet(bench.key, bench.sets[0].key, { weightKg: 60 })
    store().toggleSet(bench.key, bench.sets[0].key)
    const id = await store().finish({ name: 'Upper', notes: '', calories: null, avgHr: null, maxHr: null, endedAt: Date.now() })
    await store().editFinished(id)
    await store().discard()
    expect((await getWorkout(db, id))!.exercises[0].sets[0].weightKg).toBe(60)
  })

  test('repeat starts a new workout with the same exercises', async () => {
    await startSuperset()
    const [bench] = workout().exercises
    store().updateSet(bench.key, bench.sets[0].key, { weightKg: 60 })
    store().toggleSet(bench.key, bench.sets[0].key)
    const id = await store().finish({ name: 'Upper', notes: '', calories: null, avgHr: null, maxHr: null, endedAt: Date.now() })
    await new Promise((r) => setTimeout(r, 5)) // the repeat must start later than the original
    await store().repeatWorkout(id)
    expect(workout().workoutId).not.toBe(id)
    expect(workout().exercises.map((e) => [e.name, e.sets.length])).toEqual([['Barbell Bench Press', 1]])
    expect(workout().exercises[0].previous[0].weightKg).toBe(60)
  })

  test('discard removes the workout', async () => {
    await startSuperset()
    await store().discard()
    expect(store().workout).toBeNull()
    expect((await db.get<{ n: number }>('SELECT COUNT(*) AS n FROM workouts'))!.n).toBe(0)
  })
})
