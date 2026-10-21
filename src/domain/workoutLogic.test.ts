import { describe, expect, test } from 'vitest'
import type { LoggedSet } from '../db/repos/workouts'
import { findPrs } from './prs'
import { afterSetCompleted, linkWithNext, moveItem, normalizeSupersets, unlink } from './superset'

const items = (...groups: (number | null)[]) => groups.map((g, i) => ({ id: i, supersetGroup: g, restS: 90 + i }))
const groups = (xs: { supersetGroup: number | null }[]) => xs.map((x) => x.supersetGroup)

describe('supersets', () => {
  test('normalize renumbers and drops singletons', () => {
    expect(groups(normalizeSupersets(items(7, 7, null, 3, null, 9, 9, 9)))).toEqual([1, 1, null, null, null, 2, 2, 2])
  })

  test('link with next creates, extends and merges groups', () => {
    expect(groups(linkWithNext(items(null, null, null), 0))).toEqual([1, 1, null])
    expect(groups(linkWithNext(items(1, 1, null), 1))).toEqual([1, 1, 1])
    expect(groups(linkWithNext(items(1, 1, 2, 2), 1))).toEqual([1, 1, 1, 1])
    expect(groups(linkWithNext(items(null, 1, 1), 0))).toEqual([1, 1, 1])
  })

  test('unlink splits a superset', () => {
    expect(groups(unlink(items(1, 1, 1, 1), 1))).toEqual([null, null, 1, 1])
    expect(groups(unlink(items(1, 1, 1), 2))).toEqual([1, 1, null])
  })

  test('moving an item takes it out of its superset', () => {
    const moved = moveItem(items(1, 1, null), 0, 2)
    expect(moved.map((m) => m.id)).toEqual([1, 2, 0])
    expect(groups(moved)).toEqual([null, null, null])
  })

  test('rest only after the last exercise in the round', () => {
    const xs = items(1, 1, null)
    expect(afterSetCompleted(xs, 0)).toEqual({ kind: 'next', index: 1 })
    expect(afterSetCompleted(xs, 1)).toEqual({ kind: 'rest', restS: 91 })
    expect(afterSetCompleted(xs, 2)).toEqual({ kind: 'rest', restS: 92 })
  })
})

describe('PRs', () => {
  const s = (weightKg: number | null, reps: number, type: LoggedSet['type'] = 'normal'): LoggedSet => ({
    type,
    weightKg,
    reps,
    durationS: null,
    rpe: null,
    completedAt: null,
  })
  const session = (...sets: LoggedSet[]) => ({ workoutId: 1, startedAt: 0, sets })

  test('none on first session', () => {
    expect(findPrs([], [s(100, 5)])).toEqual([])
  })

  test('weight and estimated 1RM', () => {
    const prs = findPrs([session(s(100, 5))], [s(102.5, 5)])
    expect(prs.map((p) => p.kind)).toEqual(['weight', 'oneRepMax'])
  })

  test('more reps at same weight is a 1RM PR only', () => {
    expect(findPrs([session(s(100, 5))], [s(100, 6)]).map((p) => p.kind)).toEqual(['oneRepMax'])
  })

  test('warm-ups do not count', () => {
    expect(findPrs([session(s(100, 5))], [s(140, 1, 'warmup'), s(90, 5)])).toEqual([])
  })

  test('rep PR for bodyweight exercises', () => {
    expect(findPrs([session(s(null, 12))], [s(null, 15)])).toEqual([{ kind: 'reps', value: 15 }])
  })
})
