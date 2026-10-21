import { Capacitor } from '@capacitor/core'
import { useEffect, useRef } from 'react'
import { formatClock } from '../../lib/format'
import { useNow } from '../../lib/useNow'
import { useActiveWorkout, type ActiveWorkout } from '../../store/activeWorkout'
import { useSettings } from '../../store/settings'
import { restFinishedAlert } from './restAlert'

// Mounted once at the app root; clears finished rests on any screen. On the
// phone the alert itself comes from the native service (screen-off safe);
// in the browser it's played here.
export function RestWatcher() {
  const rest = useActiveWorkout((s) => s.workout?.rest)
  const skipRest = useActiveWorkout((s) => s.skipRest)
  const sound = useSettings((s) => s.restSound)
  const now = useNow(250, !!rest)
  const alerted = useRef<number | null>(null)

  useEffect(() => {
    if (!rest || now < rest.endsAt || alerted.current === rest.endsAt) return
    alerted.current = rest.endsAt
    if (!Capacitor.isNativePlatform()) void restFinishedAlert(sound)
    skipRest()
  }, [rest, now, sound, skipRest])

  return null
}

// The next set still to do, in workout order, for the "Next" line.
function nextUp(w: ActiveWorkout | null): string | null {
  for (const e of w?.exercises ?? []) {
    const i = e.sets.findIndex((s) => s.completedAt === null)
    if (i >= 0) return `${e.name} · set ${i + 1}`
  }
  return null
}

// Prominent but not modal: the workout above keeps scrolling and taking taps.
export function RestTimerBar() {
  const workout = useActiveWorkout((s) => s.workout)
  const rest = workout?.rest
  const { adjustRest, skipRest } = useActiveWorkout.getState()
  const now = useNow(250, !!rest)
  if (!rest) return null

  const total = rest.endsAt - rest.startedAt
  const remaining = Math.min(total, Math.max(0, rest.endsAt - now))
  const next = nextUp(workout)
  const button = 'h-11 rounded-xl bg-white/20 px-4 text-sm font-semibold active:bg-white/30'

  return (
    <div className="px-3 pt-2 pb-3">
      <div className="rounded-2xl bg-sky-600 p-4 text-white shadow-lg" role="timer" aria-label="Rest timer">
        <div className="flex items-baseline justify-between gap-3">
          <p className="text-sm font-semibold tracking-wide uppercase opacity-90">Rest</p>
          {next && <p className="min-w-0 truncate text-sm opacity-90">Next: {next}</p>}
        </div>
        <p className="text-center text-6xl font-bold tracking-tight tabular-nums">{formatClock(remaining / 1000)}</p>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/25">
          <div className="h-full rounded-full bg-white transition-[width] duration-200" style={{ width: `${(remaining / total) * 100}%` }} />
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2">
          <button onClick={() => adjustRest(-15)} className={button}>
            −15s
          </button>
          <button onClick={() => adjustRest(15)} className={button}>
            +15s
          </button>
          <button onClick={skipRest} className="h-11 rounded-xl bg-white px-4 text-sm font-semibold text-sky-700 active:bg-white/90">
            Skip
          </button>
        </div>
      </div>
    </div>
  )
}
