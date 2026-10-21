import { create } from 'zustand'
import { getDb } from '../db/client'
import { getExercises, type Exercise } from '../db/repos/exercises'
import { deleteKey, getJson, setJson } from '../db/repos/kv'
import { getRoutine } from '../db/repos/routines'
import {
  deleteWorkout,
  finishWorkout,
  getInProgressWorkout,
  getWorkout,
  previousSets,
  startWorkout,
  type LoggedExercise,
  type LoggedSet,
  type SetType,
} from '../db/repos/workouts'
import type { Tracking } from '../domain/exerciseCatalog'
import { afterSetCompleted, linkWithNext, moveItem, normalizeSupersets, unlink } from '../domain/superset'

export interface DraftSet extends LoggedSet {
  key: string
}

export interface DraftExercise {
  key: string
  exerciseId: number
  name: string
  tracking: Tracking
  supersetGroup: number | null
  restS: number
  notes: string
  targetReps: number | null
  previous: LoggedSet[]
  sets: DraftSet[]
}

export interface RestTimer {
  startedAt: number
  endsAt: number
}

export interface ActiveWorkout {
  workoutId: number
  name: string
  routineId: number | null
  startedAt: number
  exercises: DraftExercise[]
  rest: RestTimer | null
  // Set when re-opening a finished workout to correct it; saving keeps its
  // original end time and heart-rate summary.
  editing?: { endedAt: number; avgHr: number | null; maxHr: number | null; notes: string }
}

export interface FinishOptions {
  name: string
  notes: string
  calories: number | null
  avgHr: number | null
  maxHr: number | null
  endedAt: number
}

const DRAFT_KEY = 'activeWorkout'
const SAVE_DELAY_MS = 400

const newKey = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`)

const emptySet = (type: SetType = 'normal'): DraftSet => ({
  key: newKey(),
  type,
  weightKg: null,
  reps: null,
  durationS: null,
  rpe: null,
  completedAt: null,
})

function defaultName(at: Date): string {
  const h = at.getHours()
  const part = h < 12 ? 'Morning' : h < 17 ? 'Afternoon' : 'Evening'
  return `${part} Workout`
}

async function draftExercise(
  e: Exercise,
  startedAt: number,
  opts: { sets?: number; targetReps?: number | null; restS?: number | null; supersetGroup?: number | null } = {},
): Promise<DraftExercise> {
  const previous = await previousSets(await getDb(), e.id, startedAt)
  const count = opts.sets ?? Math.max(1, previous.length)
  return {
    key: newKey(),
    exerciseId: e.id,
    name: e.name,
    tracking: e.tracking,
    supersetGroup: opts.supersetGroup ?? null,
    restS: opts.restS ?? e.defaultRestS,
    notes: '',
    targetReps: opts.targetReps ?? null,
    previous,
    sets: Array.from({ length: count }, (_, i) => emptySet(previous[i]?.type === 'warmup' ? 'warmup' : 'normal')),
  }
}

export interface SetSuggestion {
  weightKg: number | null
  reps: number | null
  durationS: number | null
}

// What a blank set will be logged as if ticked: the same set last session,
// else whatever the set above holds (typed or suggested), else the routine's
// target reps.
export function suggestSet(ex: DraftExercise, index: number): SetSuggestion {
  const prev = ex.previous[index]
  const above = index > 0 ? ex.sets[index - 1] : undefined
  const aboveHint = above ? suggestSet(ex, index - 1) : undefined
  const fromAbove = (k: keyof SetSuggestion) => above?.[k] ?? aboveHint?.[k] ?? null
  if (ex.tracking === 'duration') return { weightKg: null, reps: null, durationS: prev?.durationS ?? fromAbove('durationS') }
  return {
    weightKg: prev?.weightKg ?? fromAbove('weightKg'),
    reps: prev?.reps ?? fromAbove('reps') ?? ex.targetReps,
    durationS: null,
  }
}

// Fills blanks from the suggestion. Returns null if there's still nothing to log.
function resolveSet(ex: DraftExercise, index: number): DraftSet | null {
  const s = ex.sets[index]
  const hint = suggestSet(ex, index)
  const filled = {
    ...s,
    weightKg: s.weightKg ?? (ex.tracking === 'weight_reps' ? hint.weightKg : null),
    reps: s.reps ?? hint.reps,
    durationS: s.durationS ?? hint.durationS,
  }
  if (ex.tracking === 'duration' ? !filled.durationS : !filled.reps) return null
  return filled
}

interface ActiveWorkoutStore {
  workout: ActiveWorkout | null
  hydrated: boolean
  hydrate: () => Promise<void>
  startEmpty: () => Promise<void>
  startFromRoutine: (routineId: number) => Promise<void>
  repeatWorkout: (workoutId: number) => Promise<void>
  editFinished: (workoutId: number) => Promise<void>
  rename: (name: string) => void
  addExercises: (ids: number[], asSuperset: boolean) => Promise<void>
  removeExercise: (exKey: string) => void
  moveExercise: (exKey: string, delta: -1 | 1) => void
  linkWithNext: (exKey: string) => void
  unlink: (exKey: string) => void
  setRest: (exKey: string, restS: number) => void
  setExerciseNotes: (exKey: string, notes: string) => void
  addSet: (exKey: string) => void
  removeSet: (exKey: string, setKey: string) => void
  updateSet: (exKey: string, setKey: string, patch: Partial<LoggedSet>) => void
  // Returns the index of the exercise to focus next, or null; false if the set
  // couldn't be completed because nothing was entered.
  toggleSet: (exKey: string, setKey: string) => number | null | false
  adjustRest: (deltaS: number) => void
  skipRest: () => void
  // Writes any pending draft change now (e.g. when the app is backgrounded).
  flush: () => Promise<void>
  finish: (opts: FinishOptions) => Promise<number>
  discard: () => Promise<void>
}

let saveTimer: ReturnType<typeof setTimeout> | undefined

export const useActiveWorkout = create<ActiveWorkoutStore>((set, get) => {
  // Applies a change to the active workout and schedules a draft save.
  const mutate = (fn: (w: ActiveWorkout) => void) => {
    const w = get().workout
    if (!w) return
    const next = structuredClone(w)
    fn(next)
    set({ workout: next })
    clearTimeout(saveTimer)
    saveTimer = setTimeout(() => void saveDraft(), SAVE_DELAY_MS)
  }

  const saveDraft = async () => {
    saveTimer = undefined
    const w = get().workout
    if (w) await setJson(await getDb(), DRAFT_KEY, w)
  }

  const exIndex = (w: ActiveWorkout, exKey: string) => w.exercises.findIndex((e) => e.key === exKey)

  const begin = async (name: string, routineId: number | null, build: (startedAt: number) => Promise<DraftExercise[]>) => {
    const db = await getDb()
    const startedAt = Date.now()
    const workoutId = await startWorkout(db, {
      name,
      routineId,
      startedAt,
      utcOffsetS: -new Date(startedAt).getTimezoneOffset() * 60,
    })
    const workout: ActiveWorkout = {
      workoutId,
      name,
      routineId,
      startedAt,
      exercises: normalizeSupersets(await build(startedAt)),
      rest: null,
    }
    await setJson(db, DRAFT_KEY, workout)
    set({ workout })
  }

  return {
    workout: null,
    hydrated: false,

    async hydrate() {
      const db = await getDb()
      const row = await getInProgressWorkout(db)
      const draft = await getJson<ActiveWorkout>(db, DRAFT_KEY)
      if (!row) {
        set({ workout: draft?.editing ? draft : null, hydrated: true })
        return
      }
      const workout =
        draft?.workoutId === row.id
          ? draft
          : { workoutId: row.id, name: row.name, routineId: row.routineId, startedAt: row.startedAt, exercises: [], rest: null }
      set({ workout, hydrated: true })
    },

    startEmpty: () => begin(defaultName(new Date()), null, async () => []),

    async startFromRoutine(routineId) {
      const db = await getDb()
      const routine = await getRoutine(db, routineId)
      if (!routine) return
      const exercises = await getExercises(
        db,
        routine.items.map((i) => i.exerciseId),
      )
      await begin(routine.name, routineId, async (startedAt) => {
        const out: DraftExercise[] = []
        for (const item of routine.items) {
          const e = exercises.get(item.exerciseId)
          if (!e) continue
          out.push(
            await draftExercise(e, startedAt, {
              sets: item.targetSets,
              targetReps: item.targetReps,
              restS: item.restS,
              supersetGroup: item.supersetGroup,
            }),
          )
        }
        return out
      })
    },

    async repeatWorkout(workoutId) {
      const db = await getDb()
      const past = await getWorkout(db, workoutId)
      if (!past) return
      const exercises = await getExercises(
        db,
        past.exercises.map((e) => e.exerciseId),
      )
      await begin(past.name, past.routineId, async (startedAt) => {
        const out: DraftExercise[] = []
        for (const pe of past.exercises) {
          const e = exercises.get(pe.exerciseId)
          if (e)
            out.push(
              await draftExercise(e, startedAt, {
                sets: pe.sets.length,
                restS: pe.restS,
                supersetGroup: pe.supersetGroup,
              }),
            )
        }
        return out
      })
    },

    async editFinished(workoutId) {
      const db = await getDb()
      const past = await getWorkout(db, workoutId)
      if (!past || past.endedAt === null) return
      const exercises = await getExercises(
        db,
        past.exercises.map((e) => e.exerciseId),
      )
      const drafts: DraftExercise[] = []
      for (const pe of past.exercises) {
        const e = exercises.get(pe.exerciseId)
        if (!e) continue
        drafts.push({
          key: newKey(),
          exerciseId: e.id,
          name: e.name,
          tracking: e.tracking,
          supersetGroup: pe.supersetGroup,
          restS: pe.restS,
          notes: pe.notes,
          targetReps: null,
          previous: await previousSets(db, e.id, past.startedAt),
          sets: pe.sets.map((s) => ({ ...s, key: newKey(), completedAt: s.completedAt ?? past.startedAt })),
        })
      }
      const workout: ActiveWorkout = {
        workoutId,
        name: past.name,
        routineId: past.routineId,
        startedAt: past.startedAt,
        exercises: drafts,
        rest: null,
        editing: { endedAt: past.endedAt, avgHr: past.avgHr, maxHr: past.maxHr, notes: past.notes },
      }
      await setJson(db, DRAFT_KEY, workout)
      set({ workout })
    },

    rename: (name) => mutate((w) => void (w.name = name)),

    async addExercises(ids, asSuperset) {
      const w = get().workout
      if (!w || ids.length === 0) return
      const exercises = await getExercises(await getDb(), ids)
      const group = asSuperset && ids.length > 1 ? Math.max(0, ...w.exercises.map((e) => e.supersetGroup ?? 0)) + 1 : null
      const drafts: DraftExercise[] = []
      for (const id of ids) {
        const e = exercises.get(id)
        if (e) drafts.push(await draftExercise(e, w.startedAt, { supersetGroup: group }))
      }
      mutate((w) => {
        w.exercises = normalizeSupersets([...w.exercises, ...drafts])
      })
    },

    removeExercise: (exKey) =>
      mutate((w) => {
        const i = exIndex(w, exKey)
        if (i >= 0) w.exercises = normalizeSupersets(unlink(w.exercises, i).filter((e) => e.key !== exKey))
      }),

    moveExercise: (exKey, delta) =>
      mutate((w) => {
        const i = exIndex(w, exKey)
        w.exercises = moveItem(w.exercises, i, i + delta)
      }),

    linkWithNext: (exKey) => mutate((w) => void (w.exercises = linkWithNext(w.exercises, exIndex(w, exKey)))),
    unlink: (exKey) => mutate((w) => void (w.exercises = unlink(w.exercises, exIndex(w, exKey)))),

    setRest: (exKey, restS) =>
      mutate((w) => {
        const e = w.exercises[exIndex(w, exKey)]
        if (e) e.restS = restS
      }),

    setExerciseNotes: (exKey, notes) =>
      mutate((w) => {
        const e = w.exercises[exIndex(w, exKey)]
        if (e) e.notes = notes
      }),

    addSet: (exKey) =>
      mutate((w) => {
        const e = w.exercises[exIndex(w, exKey)]
        if (!e) return
        // Carry over the last set's values so the next set is one tap.
        const last = e.sets.at(-1)
        e.sets.push({
          ...emptySet(),
          weightKg: last?.weightKg ?? null,
          reps: last?.reps ?? null,
          durationS: last?.durationS ?? null,
        })
      }),

    removeSet: (exKey, setKey) =>
      mutate((w) => {
        const e = w.exercises[exIndex(w, exKey)]
        if (e) e.sets = e.sets.filter((s) => s.key !== setKey)
      }),

    updateSet: (exKey, setKey, patch) =>
      mutate((w) => {
        const s = w.exercises[exIndex(w, exKey)]?.sets.find((s) => s.key === setKey)
        if (s) Object.assign(s, patch)
      }),

    toggleSet(exKey, setKey) {
      const w = get().workout
      if (!w) return null
      const i = exIndex(w, exKey)
      const ex = w.exercises[i]
      const si = ex?.sets.findIndex((s) => s.key === setKey) ?? -1
      if (!ex || si < 0) return null

      if (ex.sets[si].completedAt !== null) {
        mutate((w) => void (w.exercises[i].sets[si].completedAt = null))
        return null
      }
      const resolved = resolveSet(ex, si)
      if (!resolved) return false

      const now = Date.now()
      const after = afterSetCompleted(w.exercises, i)
      mutate((w) => {
        w.exercises[i].sets[si] = { ...resolved, completedAt: now }
        if (!w.editing && after.kind === 'rest' && after.restS > 0) w.rest = { startedAt: now, endsAt: now + after.restS * 1000 }
      })
      return after.kind === 'next' ? after.index : null
    },

    adjustRest: (deltaS) =>
      mutate((w) => {
        if (!w.rest) return
        w.rest.endsAt = Math.max(Date.now(), w.rest.endsAt + deltaS * 1000)
      }),

    skipRest: () => mutate((w) => void (w.rest = null)),

    async flush() {
      if (saveTimer === undefined) return
      clearTimeout(saveTimer)
      await saveDraft()
    },

    async finish(opts) {
      const w = get().workout
      if (!w) throw new Error('No active workout')
      clearTimeout(saveTimer)
      const exercises: LoggedExercise[] = w.exercises
        .map((e) => ({
          exerciseId: e.exerciseId,
          supersetGroup: e.supersetGroup,
          restS: e.restS,
          notes: e.notes,
          sets: e.sets.filter((s) => s.completedAt !== null).map(({ key: _key, ...s }) => s),
        }))
        .filter((e) => e.sets.length > 0)
      const db = await getDb()
      await finishWorkout(db, w.workoutId, {
        name: opts.name.trim() || w.name,
        notes: opts.notes,
        endedAt: opts.endedAt,
        exercises: normalizeSupersets(exercises),
        avgHr: opts.avgHr,
        maxHr: opts.maxHr,
        calories: opts.calories,
      })
      await deleteKey(db, DRAFT_KEY)
      set({ workout: null })
      return w.workoutId
    },

    async discard() {
      const w = get().workout
      if (!w) return
      clearTimeout(saveTimer)
      const db = await getDb()
      // Cancelling an edit keeps the original workout untouched.
      if (!w.editing) await deleteWorkout(db, w.workoutId)
      await deleteKey(db, DRAFT_KEY)
      set({ workout: null })
    },
  }
})
