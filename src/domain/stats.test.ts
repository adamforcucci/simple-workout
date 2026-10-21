import { describe, expect, test } from 'vitest'
import type { WorkoutSummary } from '../db/repos/workouts'
import { bestLifts, muscleSplit, weekStreak, weeklySeries, type SetRecord } from './stats'

// Wednesday 21 Oct 2026, local time.
const NOW = new Date(2026, 9, 21, 12).getTime()
const day = (y: number, m: number, d: number) => new Date(y, m - 1, d, 9).getTime()

const w = (startedAt: number, volumeKg = 1000): WorkoutSummary => ({
  id: startedAt,
  name: 'W',
  notes: '',
  routineId: null,
  startedAt,
  endedAt: startedAt + 3_600_000,
  utcOffsetS: 0,
  avgHr: null,
  maxHr: null,
  calories: null,
  exerciseCount: 1,
  setCount: 3,
  volumeKg,
})

describe('weekly series', () => {
  test('buckets by Monday-start weeks ending this week', () => {
    const series = weeklySeries([w(day(2026, 10, 19)), w(day(2026, 10, 25), 500), w(day(2026, 10, 18), 200)], 2, NOW)
    expect(series.map((b) => b.label)).toEqual(['12 Oct', '19 Oct'])
    expect(series.map((b) => [b.workouts, b.volumeKg])).toEqual([
      [1, 200],
      [2, 1500],
    ])
    expect(series[1].durationS).toBe(7200)
  })

  test('ignores workouts before the window', () => {
    expect(weeklySeries([w(day(2026, 1, 1))], 4, NOW).every((b) => b.workouts === 0)).toBe(true)
  })
})

describe('streak', () => {
  test('counts consecutive weeks including this one', () => {
    expect(weekStreak([w(day(2026, 10, 20)), w(day(2026, 10, 13)), w(day(2026, 10, 6)), w(day(2026, 9, 22))], NOW)).toBe(3)
  })

  test('an empty current week does not break the streak yet', () => {
    expect(weekStreak([w(day(2026, 10, 13)), w(day(2026, 10, 6))], NOW)).toBe(2)
    expect(weekStreak([w(day(2026, 9, 29))], NOW)).toBe(0)
  })
})

describe('sets', () => {
  const s = (exerciseId: number, weightKg: number | null, reps: number, primaryMuscles: SetRecord['primaryMuscles']): SetRecord => ({
    workoutId: 1,
    startedAt: NOW,
    exerciseId,
    exerciseName: `E${exerciseId}`,
    primaryMuscles,
    weightKg,
    reps,
  })

  test('muscle split counts each primary muscle', () => {
    expect(muscleSplit([s(1, 60, 8, ['chest']), s(1, 60, 8, ['chest']), s(2, 100, 5, ['quads', 'glutes'])])).toEqual([
      { muscle: 'chest', sets: 2 },
      { muscle: 'quads', sets: 1 },
      { muscle: 'glutes', sets: 1 },
    ])
  })

  test('best lifts by estimated 1RM, skipping unloaded and high-rep sets', () => {
    const lifts = bestLifts([s(1, 100, 5, []), s(1, 110, 1, []), s(2, 140, 3, []), s(3, null, 20, []), s(1, 60, 20, [])])
    expect(lifts.map((l) => [l.exerciseId, l.weightKg, l.reps])).toEqual([
      [2, 140, 3],
      [1, 100, 5],
    ])
  })
})
