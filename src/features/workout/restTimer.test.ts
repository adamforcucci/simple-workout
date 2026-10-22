import { describe, expect, test } from 'vitest'
import type { DraftExercise, DraftSet } from '../../store/activeWorkout'
import { nextUp } from './workoutUi'

const set = (type: DraftSet['type'], done: boolean): DraftSet => ({
  key: Math.random().toString(),
  type,
  weightKg: null,
  reps: null,
  durationS: null,
  rpe: null,
  completedAt: done ? 1 : null,
})
const ex = (name: string, sets: DraftSet[]) => ({ name, sets }) as DraftExercise

describe('rest timer "Next" line', () => {
  test('numbers working sets like the rows (warm-ups excluded)', () => {
    const w = { exercises: [ex('Bench', [set('warmup', true), set('normal', true), set('normal', false)])] }
    expect(nextUp(w)).toBe('Bench · set 2')
  })

  test('names a pending warm-up and moves on to the next exercise when one is done', () => {
    expect(nextUp({ exercises: [ex('Squat', [set('warmup', false), set('normal', false)])] })).toBe('Squat · warm-up')
    expect(nextUp({ exercises: [ex('A', [set('normal', true)]), ex('B', [set('drop', false)])] })).toBe('B · set 1')
    expect(nextUp({ exercises: [ex('A', [set('normal', true)])] })).toBeNull()
  })
})
