import type { HrSample } from '../db/repos/hr'
import type { Sex } from '../db/repos/profile'

export interface CalorieInputs {
  sex: Sex | null
  ageYears: number
  weightKg: number
}

// Keytel et al. (2005) kcal/min from heart rate. With unknown sex, the two
// equations are averaged.
export function kcalPerMinute(bpm: number, p: CalorieInputs): number {
  const male = (-55.0969 + 0.6309 * bpm + 0.1988 * p.weightKg + 0.2017 * p.ageYears) / 4.184
  const female = (-20.4022 + 0.4472 * bpm - 0.1263 * p.weightKg + 0.074 * p.ageYears) / 4.184
  const v = p.sex === 'male' ? male : p.sex === 'female' ? female : (male + female) / 2
  return Math.max(0, v)
}

// Gaps longer than this (strap dropout) aren't credited from HR.
const MAX_SAMPLE_GAP_S = 30

export function caloriesFromHr(samples: HrSample[], p: CalorieInputs): number {
  let kcal = 0
  for (let i = 1; i < samples.length; i++) {
    const dt = samples[i].t - samples[i - 1].t
    if (dt <= 0 || dt > MAX_SAMPLE_GAP_S) continue
    kcal += kcalPerMinute(samples[i - 1].bpm, p) * (dt / 60)
  }
  return Math.round(kcal)
}

// Fallback when no HR was recorded: general weight training ≈ 3.5 MET.
const WEIGHT_TRAINING_MET = 3.5

export function caloriesFromDuration(durationS: number, weightKg: number): number {
  return Math.round(WEIGHT_TRAINING_MET * weightKg * (durationS / 3600))
}

// `dob` is YYYY-MM-DD.
export function ageOn(dob: string, at: Date): number {
  const [y, m, d] = dob.split('-').map(Number)
  let age = at.getFullYear() - y
  if (at.getMonth() + 1 < m || (at.getMonth() + 1 === m && at.getDate() < d)) age--
  return age
}

export interface CalorieEstimate {
  kcal: number
  method: 'heartRate' | 'duration'
}

// HR-based when there's at least 5 minutes of heart rate and the profile has
// an age; otherwise a duration estimate. Needs body weight either way.
export function estimateCalories(input: {
  samples: HrSample[]
  durationS: number
  weightKg: number | null
  sex: Sex | null
  dob: string | null
  at: Date
}): CalorieEstimate | null {
  if (!input.weightKg) return null
  const covered = input.samples.length > 1 ? input.samples.at(-1)!.t - input.samples[0].t : 0
  if (covered >= 300 && input.dob) {
    const kcal = caloriesFromHr(input.samples, { sex: input.sex, ageYears: ageOn(input.dob, input.at), weightKg: input.weightKg })
    return { kcal, method: 'heartRate' }
  }
  return { kcal: caloriesFromDuration(input.durationS, input.weightKg), method: 'duration' }
}
