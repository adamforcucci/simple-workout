import { beforeEach, describe, expect, test, vi } from 'vitest'
import { migrate } from '../db/migrations'
import { getJson } from '../db/repos/kv'
import { getRoutine, saveRoutine } from '../db/repos/routines'
import { getWorkout, listWorkouts } from '../db/repos/workouts'
import { seedExercises } from '../db/seed'
import { sqlJsDb } from '../db/sqlJsDb'
import type { Db } from '../db/types'

let db: Db
vi.mock('../db/client', () => ({ getDb: () => Promise.resolve(db) }))

const { routineChanged, routineFromWorkout, suggestSet, useActiveWorkout } = await import('./activeWorkout')
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
      { exerciseId: bench, supersetGroup: 1, targetSets: 2, targetReps: 8, targetWeightKg: null, targetDurationS: null, restS: 90 },
      { exerciseId: row, supersetGroup: 1, targetSets: 2, targetReps: 10, targetWeightKg: null, targetDurationS: null, restS: 60 },
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

    expect(store().toggleSet(row.key, row.sets[0].key)).toBe(0) // back to the first exercise of the round
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
    store().toggleSet(bench.key, bench.sets[0].key) // a completed set makes it resumable
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

  test('routine targets fill a first session', async () => {
    const bench = await idOf('BARBELL_BENCH_PRESS')
    const plank = await idOf('PLANK_GENERIC')
    const routineId = await saveRoutine(db, {
      name: 'R',
      notes: '',
      items: [
        { exerciseId: bench, supersetGroup: null, targetSets: 2, targetReps: 5, targetWeightKg: 80, targetDurationS: null, restS: 0 },
        { exerciseId: plank, supersetGroup: null, targetSets: 1, targetReps: null, targetWeightKg: null, targetDurationS: 45, restS: 0 },
      ],
    })
    await store().startFromRoutine(routineId)
    const [b, p] = workout().exercises
    expect(suggestSet(b, 1)).toEqual({ weightKg: 80, reps: 5, durationS: null })
    expect(suggestSet(p, 0)).toEqual({ weightKg: null, reps: null, durationS: 45 })
    expect(b.restS).toBe(0)
  })

  test('finishing can save changes back to the routine', async () => {
    const { routineId } = await startSuperset()
    const [bench, row] = workout().exercises
    store().updateSet(bench.key, bench.sets[0].key, { weightKg: 65, reps: 6 })
    store().toggleSet(bench.key, bench.sets[0].key)
    store().removeSet(row.key, row.sets[1].key) // swipe-deleted a set
    const routine = (await getRoutine(db, routineId))!
    const updated = routineFromWorkout(workout(), routine)
    expect(routineChanged(routine, updated)).toBe(true)
    expect(updated.items.map((i) => [i.targetSets, i.targetReps, i.targetWeightKg, i.supersetGroup])).toEqual([
      [2, 6, 65, 1],
      [1, 10, null, 1],
    ])

    await store().finish({ name: 'Upper', notes: '', calories: null, avgHr: null, maxHr: null, endedAt: Date.now(), updateRoutine: true })
    expect((await getRoutine(db, routineId))!.items.map((i) => i.targetSets)).toEqual([2, 1])
  })

  test('an unchanged session reports no routine change', async () => {
    const { routineId } = await startSuperset()
    expect(routineChanged((await getRoutine(db, routineId))!, routineFromWorkout(workout(), (await getRoutine(db, routineId))!))).toBe(false)
  })

  test('swap keeps position, superset and set count', async () => {
    await startSuperset()
    const [bench] = workout().exercises
    await store().swapExercise(bench.key, await idOf('DUMBBELL_BENCH_PRESS'))
    const [first, second] = workout().exercises
    expect([first.name, first.supersetGroup, first.sets.length, first.restS]).toEqual(['Dumbbell Bench Press', 1, 2, 90])
    expect(second.name).toBe('Dumbbell Row')
  })

  test('best set comes from history', async () => {
    const { routineId } = await startSuperset()
    const [bench] = workout().exercises
    store().updateSet(bench.key, bench.sets[0].key, { weightKg: 60, reps: 8 })
    store().toggleSet(bench.key, bench.sets[0].key)
    store().updateSet(bench.key, bench.sets[1].key, { weightKg: 70, reps: 3 })
    store().toggleSet(bench.key, bench.sets[1].key)
    await store().finish({ name: 'U', notes: '', calories: null, avgHr: null, maxHr: null, endedAt: Date.now() })
    await new Promise((r) => setTimeout(r, 5))
    await store().startFromRoutine(routineId)
    expect(workout().exercises[0].best).toMatchObject({ weightKg: 70, reps: 3 }) // e1RM 77 kg beats 60×8 (76 kg)
  })

  test('leaving before completing a set discards the workout', async () => {
    await startSuperset()
    expect(await store().discardIfEmpty()).toBe(true)
    expect(store().workout).toBeNull()
    expect((await db.get<{ n: number }>('SELECT COUNT(*) AS n FROM workouts'))!.n).toBe(0)

    await startSuperset()
    const [bench] = workout().exercises
    store().updateSet(bench.key, bench.sets[0].key, { weightKg: 60 })
    store().toggleSet(bench.key, bench.sets[0].key)
    expect(await store().discardIfEmpty()).toBe(false)
    expect(store().workout).not.toBeNull()
  })

  test('an empty workout is not resumed after a restart', async () => {
    await startSuperset()
    await store().flush()
    useActiveWorkout.setState({ workout: null, hydrated: false })
    await store().hydrate()
    expect(store().workout).toBeNull()
  })

  test('discard removes the workout', async () => {
    await startSuperset()
    await store().discard()
    expect(store().workout).toBeNull()
    expect((await db.get<{ n: number }>('SELECT COUNT(*) AS n FROM workouts'))!.n).toBe(0)
  })
})
