import { describe, expect, test } from 'vitest'
import type { LoggedSet } from '../db/repos/workouts'
import { ageOn, caloriesFromDuration, caloriesFromHr, estimateCalories, kcalPerMinute } from './calories'
import { buildCatalog, displayName } from './exerciseCatalog'
import { downsample, hrZone, maxHeartRate, timeInZones } from './heartRate'
import { bestOneRepMax, estimatedOneRepMax, heaviestSet, totalVolume } from './sets'
import { formatWeight, fromDisplayWeight, toDisplayWeight } from './units'
import { compact } from '../lib/format'

const set = (weightKg: number | null, reps: number | null, type: LoggedSet['type'] = 'normal'): LoggedSet => ({
  type,
  weightKg,
  reps,
  durationS: null,
  rpe: null,
  completedAt: null,
})

describe('units', () => {
  test('round-trips kg and lb', () => {
    expect(toDisplayWeight(100, 'lb')).toBe(220.5)
    expect(fromDisplayWeight(225, 'lb')).toBeCloseTo(102.06, 2)
    expect(toDisplayWeight(fromDisplayWeight(135, 'lb'), 'lb')).toBe(135)
    expect(formatWeight(62.5, 'kg')).toBe('62.5 kg')
    expect(formatWeight(null, 'kg')).toBe('–')
  })
})

describe('sets', () => {
  test('volume excludes warm-ups', () => {
    expect(totalVolume([set(20, 10, 'warmup'), set(60, 8), set(60, 7)])).toBe(900)
  })

  test('Epley 1RM', () => {
    expect(estimatedOneRepMax(100, 1)).toBe(100)
    expect(estimatedOneRepMax(100, 5)).toBeCloseTo(116.67, 2)
    expect(estimatedOneRepMax(100, 15)).toBeNull()
    expect(bestOneRepMax([set(100, 5), set(110, 2), set(150, 1, 'warmup')])).toBeCloseTo(117.33, 2)
  })

  test('heaviest set breaks ties on reps', () => {
    expect(heaviestSet([set(80, 5), set(80, 6), set(70, 10)])).toMatchObject({ weightKg: 80, reps: 6 })
  })
})

describe('calories', () => {
  const p = { sex: 'male' as const, ageYears: 35, weightKg: 80 }

  test('Keytel male at 130 bpm', () => {
    expect(kcalPerMinute(130, p)).toBeCloseTo(11.92, 2)
  })

  test('never negative at low HR', () => {
    expect(kcalPerMinute(40, { ...p, sex: 'female' })).toBe(0)
  })

  test('integrates samples and skips dropouts', () => {
    const samples = Array.from({ length: 61 }, (_, i) => ({ t: i, bpm: 130 }))
    expect(caloriesFromHr(samples, p)).toBe(12)
    expect(caloriesFromHr([{ t: 0, bpm: 130 }, { t: 600, bpm: 130 }], p)).toBe(0)
  })

  test('MET fallback', () => {
    expect(caloriesFromDuration(3600, 80)).toBe(280)
  })

  test('age', () => {
    expect(ageOn('1990-10-22', new Date(2026, 9, 21))).toBe(35)
    expect(ageOn('1990-10-21', new Date(2026, 9, 21))).toBe(36)
  })
})

describe('exercise catalog', () => {
  const catalog = buildCatalog()

  test('covers every Strava exercise once with unique names', () => {
    expect(catalog).toHaveLength(656)
    expect(new Set(catalog.map((e) => e.stravaExerciseType)).size).toBe(656)
    expect(new Set(catalog.map((e) => e.name)).size).toBe(656)
  })

  test('names and classification', () => {
    expect(displayName('BARBELL_BENCH_PRESS')).toBe('Barbell Bench Press')
    expect(displayName('SQUAT_GENERIC')).toBe('Squat (General)')
    const byId = new Map(catalog.map((e) => [e.stravaExerciseType, e]))
    expect(byId.get('BARBELL_BACK_SQUAT')).toMatchObject({ equipment: 'barbell', tracking: 'weight_reps' })
    expect(byId.get('PLANK_GENERIC')).toMatchObject({ tracking: 'duration' })
    expect(byId.get('DIAMOND_PUSH_UP')).toMatchObject({ equipment: 'bodyweight', tracking: 'reps' })
  })
})

describe('calorie estimate', () => {
  const at = new Date(2026, 9, 21)
  const minutes = (n: number, bpm = 130) => Array.from({ length: n * 60 + 1 }, (_, t) => ({ t, bpm }))
  const base = { durationS: 3600, weightKg: 80, sex: 'male' as const, dob: '1991-01-01', at }

  test('uses heart rate with 5+ minutes of samples and an age', () => {
    expect(estimateCalories({ ...base, samples: minutes(10) })).toEqual({ kcal: 119, method: 'heartRate' })
  })

  test('falls back to duration with too little HR or no date of birth', () => {
    expect(estimateCalories({ ...base, samples: minutes(2) })?.method).toBe('duration')
    expect(estimateCalories({ ...base, dob: null, samples: minutes(10) })).toEqual({ kcal: 280, method: 'duration' })
  })

  test('needs body weight', () => {
    expect(estimateCalories({ ...base, weightKg: null, samples: minutes(10) })).toBeNull()
  })
})

describe('heart rate zones', () => {
  test('zone boundaries by % of max', () => {
    expect([100, 114, 120, 140, 160, 171, 190].map((b) => hrZone(b, 190))).toEqual([1, 2, 2, 3, 4, 5, 5])
    expect(maxHeartRate(null, 35)).toBe(185)
    expect(maxHeartRate(178, 35)).toBe(178)
    expect(maxHeartRate(null, null)).toBe(190)
  })

  test('time in zones skips dropouts', () => {
    const samples = [
      { t: 0, bpm: 100 },
      { t: 10, bpm: 150 },
      { t: 20, bpm: 150 },
      { t: 120, bpm: 100 },
    ]
    expect(timeInZones(samples, 190)).toEqual([10, 0, 10, 0, 0])
  })

  test('downsample keeps ends and length', () => {
    const xs = Array.from({ length: 1000 }, (_, i) => i)
    const d = downsample(xs, 100)
    expect(d).toHaveLength(100)
    expect([d[0], d.at(-1)]).toEqual([0, 999])
    expect(downsample([1, 2], 100)).toEqual([1, 2])
  })
})

describe('axis labels', () => {
  test('adjacent ticks never collide', () => {
    expect([950, 1300, 1350, 1400, 18000, 24000, 12500].map(compact)).toEqual(['950', '1.3K', '1.35K', '1.4K', '18K', '24K', '12.5K'])
  })
})
