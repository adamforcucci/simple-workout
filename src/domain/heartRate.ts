import type { HrSample } from '../db/repos/hr'

export const DEFAULT_MAX_HR = 190

export function maxHeartRate(override: number | null, age: number | null): number {
  return override ?? (age !== null ? 220 - age : DEFAULT_MAX_HR)
}

// Five zones by % of max HR: <60, 60–70, 70–80, 80–90, ≥90.
export function hrZone(bpm: number, maxHr: number): 1 | 2 | 3 | 4 | 5 {
  const pct = bpm / maxHr
  return pct < 0.6 ? 1 : pct < 0.7 ? 2 : pct < 0.8 ? 3 : pct < 0.9 ? 4 : 5
}

// Seconds spent in each zone, crediting each sample until the next one
// (gaps over 30 s are dropouts and aren't credited).
export function timeInZones(samples: HrSample[], maxHr: number): number[] {
  const out = [0, 0, 0, 0, 0]
  for (let i = 1; i < samples.length; i++) {
    const dt = samples[i].t - samples[i - 1].t
    if (dt > 0 && dt <= 30) out[hrZone(samples[i - 1].bpm, maxHr) - 1] += dt
  }
  return out
}

// Evenly thins a long series for charting, keeping the first and last points.
export function downsample<T>(xs: T[], max: number): T[] {
  if (xs.length <= max) return xs
  const step = (xs.length - 1) / (max - 1)
  return Array.from({ length: max }, (_, i) => xs[Math.round(i * step)])
}
