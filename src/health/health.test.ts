import { describe, expect, test } from 'vitest'
import type { LoggedSet, Workout } from '../db/repos/workouts'
import { buildHealthWorkout, SEGMENT, segmentType } from './payload'

const T0 = Date.UTC(2026, 9, 20, 21, 0, 0)

const set = (completedAt: number | null, p: Partial<LoggedSet> = {}): LoggedSet => ({
  type: 'normal',
  weightKg: 60,
  reps: 8,
  durationS: null,
  rpe: null,
  completedAt,
  ...p,
})

function workout(exercises: [string, LoggedSet[]][]): Workout {
  return {
    id: 7,
    name: 'Push',
    notes: 'Felt strong',
    routineId: null,
    startedAt: T0,
    endedAt: T0 + 45 * 60_000,
    utcOffsetS: 39600,
    avgHr: 120,
    maxHr: 150,
    calories: 310,
    exercises: exercises.map(([type, sets], i) => ({
      exerciseId: i,
      name: type,
      stravaExerciseType: type,
      supersetGroup: null,
      restS: 90,
      notes: '',
      sets,
    })),
  }
}

describe('segment types', () => {
  test.each([
    ['BARBELL_BENCH_PRESS', SEGMENT.BENCH_PRESS],
    ['BARBELL_BULGARIAN_SPLIT_SQUAT', SEGMENT.LUNGE],
    ['BARBELL_SQUAT_CLEAN', SEGMENT.WEIGHTLIFTING],
    ['BARBELL_BACK_SQUAT', SEGMENT.SQUAT],
    ['BARBELL_ROMANIAN_DEADLIFT', SEGMENT.DEADLIFT],
    ['BANDED_HAMSTRING_CURL', SEGMENT.LEG_CURL],
    ['CABLE_HAMMER_CURL', SEGMENT.ARM_CURL],
    ['DUMBBELL_WRIST_CURL', SEGMENT.WEIGHTLIFTING],
    ['BENT_OVER_DUMBBELL_ROW', SEGMENT.DUMBBELL_ROW],
    ['CABLE_UPRIGHT_ROW', SEGMENT.WEIGHTLIFTING],
    ['BARBELL_BEHIND_THE_HEAD_SHOULDER_PRESS', SEGMENT.BARBELL_SHOULDER_PRESS],
    ['ARNOLD_PRESS', SEGMENT.SHOULDER_PRESS],
    ['CABLE_LATERAL_RAISE', SEGMENT.LATERAL_RAISE],
    ['DUMBBELL_SINGLE_ARM_TRICEP_EXTENSION', SEGMENT.SINGLE_ARM_TRICEPS_EXTENSION],
    ['CABLE_LAT_PULLDOWN_CLOSE_GRIP', SEGMENT.LAT_PULL_DOWN],
    ['ASSISTED_CHIN_UP', SEGMENT.PULL_UP],
    ['PLANK_GENERIC', SEGMENT.PLANK],
  ])('%s', (type, expected) => {
    expect(segmentType(type, set(null))).toBe(expected)
  })

  test('falls back on whether the set was weighted', () => {
    expect(segmentType('FACE_PULL', set(null))).toBe(SEGMENT.WEIGHTLIFTING)
    expect(segmentType('FACE_PULL', set(null, { weightKg: null }))).toBe(SEGMENT.OTHER_WORKOUT)
  })
})

describe('Health Connect payload', () => {
  test('session, calories and heart rate in epoch ms', () => {
    const p = buildHealthWorkout(workout([]), [
      { t: 0, bpm: 90 },
      { t: 5, bpm: 100 },
    ])
    expect(p).toMatchObject({
      id: 7,
      title: 'Push',
      notes: 'Felt strong',
      startTime: T0,
      endTime: T0 + 2_700_000,
      utcOffsetS: 39600,
      calories: 310,
      heartRate: [
        { time: T0, bpm: 90 },
        { time: T0 + 5000, bpm: 100 },
      ],
    })
  })

  test('one segment per completed set, in order and never overlapping', () => {
    const p = buildHealthWorkout(
      workout([
        ['BARBELL_BENCH_PRESS', [set(T0 + 300_000), set(null)]],
        // Superset partner ticked 5s after the bench set: clipped to start where it ended.
        ['CABLE_HAMMER_CURL', [set(T0 + 305_000, { reps: 12 })]],
        ['PLANK_GENERIC', [set(T0 + 600_000, { weightKg: null, reps: null, durationS: 60 })]],
      ]),
      [],
    )
    expect(p.segments).toEqual([
      { startTime: T0 + 276_000, endTime: T0 + 300_000, type: SEGMENT.BENCH_PRESS, reps: 8 },
      { startTime: T0 + 300_000, endTime: T0 + 305_000, type: SEGMENT.ARM_CURL, reps: 12 },
      { startTime: T0 + 540_000, endTime: T0 + 600_000, type: SEGMENT.PLANK, reps: 0 },
    ])
  })

  test('drops sets that leave no room and heart rate after the end', () => {
    const w = workout([['BARBELL_BENCH_PRESS', [set(T0 + 10_000), set(T0 + 10_500)]]])
    const p = buildHealthWorkout(w, [{ t: 2700, bpm: 100 }, { t: 2701, bpm: 101 }])
    expect(p.segments).toHaveLength(1)
    expect(p.heartRate).toEqual([{ time: T0 + 2_700_000, bpm: 100 }])
  })
})
