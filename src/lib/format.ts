// 75 → "1:15", 3725 → "1:02:05"
export function formatClock(totalS: number): string {
  const s = Math.max(0, Math.round(totalS))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = String(s % 60).padStart(2, '0')
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`
}

// 3725 → "1h 2m", 300 → "5m"
export function formatDuration(totalS: number): string {
  const m = Math.round(totalS / 60)
  const h = Math.floor(m / 60)
  return h > 0 ? `${h}h ${m % 60}m` : `${m}m`
}

// "1:30" or "90" → 90
export function parseClock(text: string): number | null {
  const parts = text.trim().split(':').map(Number)
  if (parts.some((n) => !Number.isFinite(n) || n < 0)) return null
  return parts.reduce((acc, n) => acc * 60 + n, 0)
}

// 'upper_back' → 'Upper back'
export const label = (s: string) => s.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase())

// plural(1, 'workout') → '1 workout', plural(3, 'workout') → '3 workouts'
export const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`

// Axis ticks: 950 → "950", 1350 → "1.35K", 24000 → "24K". Enough precision that
// neighbouring ticks never round to the same label.
export const compact = (v: number) => {
  if (Math.abs(v) < 1000) return String(Math.round(v * 10) / 10)
  const k = v / 1000
  return `${Number(k.toFixed(Math.abs(k) >= 10 ? 1 : 2))}K`
}
