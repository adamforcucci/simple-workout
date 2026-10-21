import { Capacitor } from '@capacitor/core'
import { useEffect, useRef } from 'react'
import { formatClock } from '../../lib/format'
import { useNow } from '../../lib/useNow'
import { useActiveWorkout } from '../../store/activeWorkout'
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

export function RestTimerBar() {
  const rest = useActiveWorkout((s) => s.workout?.rest)
  const { adjustRest, skipRest } = useActiveWorkout.getState()
  const now = useNow(250, !!rest)
  if (!rest) return null

  const total = rest.endsAt - rest.startedAt
  const remaining = Math.min(total, Math.max(0, rest.endsAt - now))

  return (
    <div className="border-t border-line bg-surface">
      <div className="h-1 bg-raised">
        <div className="h-full bg-sky-500 transition-[width] duration-200" style={{ width: `${(remaining / total) * 100}%` }} />
      </div>
      <div className="flex items-center gap-3 px-4 py-3">
        <button onClick={() => adjustRest(-15)} className="rounded-md bg-raised px-3 py-2 text-sm">
          −15
        </button>
        <p className="flex-1 text-center text-3xl font-semibold tabular-nums">{formatClock(remaining / 1000)}</p>
        <button onClick={() => adjustRest(15)} className="rounded-md bg-raised px-3 py-2 text-sm">
          +15
        </button>
        <button onClick={skipRest} className="rounded-md bg-sky-600 px-4 py-2 text-sm font-medium text-white">
          Skip
        </button>
      </div>
    </div>
  )
}
