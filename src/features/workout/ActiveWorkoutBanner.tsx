import { ChevronUp } from 'lucide-react'
import { Link } from 'react-router'
import { formatClock } from '../../lib/format'
import { useNow } from '../../lib/useNow'
import { useActiveWorkout } from '../../store/activeWorkout'
import { useHeartRate } from '../../store/heartRate'

// Shown above the tab bar while a workout is running and its screen is closed.
export function ActiveWorkoutBanner() {
  const workout = useActiveWorkout((s) => s.workout)
  const now = useNow(1000, !!workout)
  const bpm = useHeartRate((s) => (s.state === 'connected' ? s.bpm : null))
  if (!workout) return null
  const restLeft = workout.rest ? Math.max(0, workout.rest.endsAt - now) / 1000 : null

  return (
    <Link to="/workout" className="flex items-center gap-3 border-t border-line bg-surface px-4 py-2.5">
      <ChevronUp size={18} className="text-muted" />
      <span className="flex-1 truncate text-sm font-medium">{workout.name}</span>
      {restLeft !== null && <span className="text-sm text-info tabular-nums">Rest {formatClock(restLeft)}</span>}
      {bpm !== null && !workout.editing && <span className="text-sm text-bad tabular-nums">♥ {bpm}</span>}
      <span className="text-sm text-muted tabular-nums">
        {workout.editing ? 'Editing' : formatClock((now - workout.startedAt) / 1000)}
      </span>
    </Link>
  )
}
