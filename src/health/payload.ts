import type { HrSample } from '../db/repos/hr'
import type { LoggedSet, Workout } from '../db/repos/workouts'
import { estimatedSetStart } from '../domain/sets'

// What the native HealthConnect plugin writes: one strength-training session
// with a segment per set, plus heart rate and total calories.
export interface HealthWorkout {
  id: number
  title: string
  notes: string
  startTime: number
  endTime: number
  utcOffsetS: number
  calories?: number
  heartRate: { time: number; bpm: number }[]
  segments: HealthSegment[]
}

export interface HealthSegment {
  startTime: number
  endTime: number
  type: number
  reps: number
}

// Health Connect's ExerciseSegment types that fit a strength session.
export const SEGMENT = {
  ARM_CURL: 1,
  BACK_EXTENSION: 2,
  BALL_SLAM: 3,
  BARBELL_SHOULDER_PRESS: 4,
  BENCH_PRESS: 5,
  BURPEE: 9,
  CRUNCH: 10,
  DEADLIFT: 11,
  DOUBLE_ARM_TRICEPS_EXTENSION: 12,
  DUMBBELL_FRONT_RAISE: 15,
  DUMBBELL_LATERAL_RAISE: 16,
  DUMBBELL_ROW: 17,
  FRONT_RAISE: 23,
  HIP_THRUST: 25,
  JUMPING_JACK: 27,
  JUMP_ROPE: 28,
  KETTLEBELL_SWING: 29,
  LATERAL_RAISE: 30,
  LAT_PULL_DOWN: 31,
  LEG_CURL: 32,
  LEG_EXTENSION: 33,
  LEG_PRESS: 34,
  LEG_RAISE: 35,
  LUNGE: 36,
  MOUNTAIN_CLIMBER: 37,
  OTHER_WORKOUT: 38,
  PLANK: 41,
  PULL_UP: 42,
  PUNCH: 43,
  SHOULDER_PRESS: 48,
  SINGLE_ARM_TRICEPS_EXTENSION: 49,
  SIT_UP: 50,
  SQUAT: 51,
  UPPER_TWIST: 63,
  WEIGHTLIFTING: 65,
} as const

// First match wins, so specific patterns come before general ones
// (leg curl before curl, split squat before squat, squat clean before squat).
const RULES: [RegExp, number][] = [
  [/CLEAN|SNATCH|JERK/, SEGMENT.WEIGHTLIFTING],
  [/LEG_PRESS/, SEGMENT.LEG_PRESS],
  [/LEG_CURL|HAMSTRING_CURL/, SEGMENT.LEG_CURL],
  [/LEG_EXTENSION|QUAD_EXTENSION/, SEGMENT.LEG_EXTENSION],
  [/(^|_)(LEG|KNEE)_RAISE/, SEGMENT.LEG_RAISE],
  [/LUNGE|SPLIT_SQUAT/, SEGMENT.LUNGE],
  [/HIP_THRUST|GLUTE_BRIDGE/, SEGMENT.HIP_THRUST],
  [/DEADLIFT/, SEGMENT.DEADLIFT],
  [/SQUAT/, SEGMENT.SQUAT],
  [/BENCH_PRESS|CHEST_PRESS|FLOOR_PRESS/, SEGMENT.BENCH_PRESS],
  [/PULL_?UP|CHIN_UP/, SEGMENT.PULL_UP],
  [/PULL_?DOWN/, SEGMENT.LAT_PULL_DOWN],
  [/DUMBBELL.*(?<!UPRIGHT_)ROW/, SEGMENT.DUMBBELL_ROW],
  [/BARBELL.*(SHOULDER|OVERHEAD|MILITARY)_PRESS/, SEGMENT.BARBELL_SHOULDER_PRESS],
  [/(SHOULDER|OVERHEAD|MILITARY|ARNOLD)_PRESS/, SEGMENT.SHOULDER_PRESS],
  [/DUMBBELL.*LATERAL_RAISE/, SEGMENT.DUMBBELL_LATERAL_RAISE],
  [/LATERAL_RAISE/, SEGMENT.LATERAL_RAISE],
  [/DUMBBELL.*FRONT_RAISE/, SEGMENT.DUMBBELL_FRONT_RAISE],
  [/FRONT_RAISE/, SEGMENT.FRONT_RAISE],
  [/SINGLE_ARM.*TRICEPS?_EXTENSION/, SEGMENT.SINGLE_ARM_TRICEPS_EXTENSION],
  [/TRICEPS?_EXTENSION|SKULL_?CRUSHER/, SEGMENT.DOUBLE_ARM_TRICEPS_EXTENSION],
  [/WRIST_CURL/, SEGMENT.WEIGHTLIFTING],
  [/CURL/, SEGMENT.ARM_CURL],
  [/BACK_EXTENSION|HYPEREXTENSION/, SEGMENT.BACK_EXTENSION],
  [/CRUNCH/, SEGMENT.CRUNCH],
  [/SIT_UP/, SEGMENT.SIT_UP],
  [/PLANK/, SEGMENT.PLANK],
  [/BURPEE/, SEGMENT.BURPEE],
  [/KETTLEBELL_SWING/, SEGMENT.KETTLEBELL_SWING],
  [/MOUNTAIN_CLIMBER/, SEGMENT.MOUNTAIN_CLIMBER],
  [/JUMPING_JACK/, SEGMENT.JUMPING_JACK],
  [/JUMP_ROPE|SKIPPING/, SEGMENT.JUMP_ROPE],
  [/BALL_SLAM/, SEGMENT.BALL_SLAM],
  [/TWIST/, SEGMENT.UPPER_TWIST],
  [/PUNCH/, SEGMENT.PUNCH],
]

export function segmentType(stravaExerciseType: string, s: LoggedSet): number {
  for (const [pattern, type] of RULES) if (pattern.test(stravaExerciseType)) return type
  return s.weightKg ? SEGMENT.WEIGHTLIFTING : SEGMENT.OTHER_WORKOUT
}

export function buildHealthWorkout(w: Workout, hr: HrSample[]): HealthWorkout {
  const startTime = w.startedAt
  const endTime = Math.max(w.endedAt ?? startTime, startTime + 1000)

  // Health Connect rejects overlapping segments or ones outside the session,
  // so estimated set windows are clipped to follow each other in order.
  const sets = w.exercises
    .flatMap((e) => e.sets.map((s) => ({ s, type: segmentType(e.stravaExerciseType, s) })))
    .filter(({ s }) => s.completedAt)
    .sort((a, b) => a.s.completedAt! - b.s.completedAt!)
  const segments: HealthSegment[] = []
  let cursor = startTime
  for (const { s, type } of sets) {
    const start = Math.max(cursor, estimatedSetStart(s, startTime)!)
    const end = Math.min(endTime, s.completedAt!)
    if (end - start < 1000) continue
    segments.push({ startTime: start, endTime: end, type, reps: s.reps ?? 0 })
    cursor = end
  }

  const heartRate = hr
    .map((x) => ({ time: startTime + x.t * 1000, bpm: x.bpm }))
    .filter((x) => x.time <= endTime && x.bpm >= 1 && x.bpm <= 300)

  const out: HealthWorkout = {
    id: w.id,
    title: w.name,
    notes: w.notes,
    startTime,
    endTime,
    utcOffsetS: w.utcOffsetS,
    heartRate,
    segments,
  }
  if (w.calories) out.calories = w.calories
  return out
}
