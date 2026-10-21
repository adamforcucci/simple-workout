import { format } from 'date-fns'
import { ChevronDown, Plus } from 'lucide-react'
import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router'
import { ExercisePicker } from '../../components/ExercisePicker'
import { formatClock } from '../../lib/format'
import { useNow } from '../../lib/useNow'
import { useActiveWorkout } from '../../store/activeWorkout'
import { HrBadge } from '../heartRate/HrBadge'
import { ExerciseCard } from './ExerciseCard'
import { RestTimerBar } from './RestTimer'

export function ActiveWorkout() {
  const workout = useActiveWorkout((s) => s.workout)
  const { rename, addExercises, discard } = useActiveWorkout.getState()
  const [picking, setPicking] = useState(false)
  const navigate = useNavigate()
  const now = useNow()

  if (!workout) return <Navigate to="/" replace />

  const focusExercise = (index: number) => {
    const key = workout.exercises[index]?.key
    if (key) document.getElementById(`ex-${key}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const completedSets = workout.exercises.reduce((n, e) => n + e.sets.filter((s) => s.completedAt !== null).length, 0)

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center gap-2 border-b border-line px-3 py-2">
        <button
          onClick={() => (workout.editing ? navigate(`/history/${workout.workoutId}`) : navigate('/'))}
          aria-label="Minimise workout"
          className="p-1 text-muted"
        >
          <ChevronDown size={24} />
        </button>
        <div className="min-w-0 flex-1">
          <input
            value={workout.name}
            onChange={(e) => rename(e.target.value)}
            className="w-full bg-transparent font-semibold outline-none"
          />
          <p className="text-xs text-muted tabular-nums">
            {workout.editing
              ? `Editing · ${format(workout.startedAt, 'EEE d MMM')}`
              : formatClock((now - workout.startedAt) / 1000)}{' '}
            · {completedSets} sets
          </p>
        </div>
        {!workout.editing && <HrBadge />}
        <button
          onClick={() => navigate('/workout/finish')}
          className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-black"
        >
          {workout.editing ? 'Save' : 'Finish'}
        </button>
      </header>

      <main className="flex-1 space-y-3 overflow-y-auto pb-6">
        {workout.exercises.map((e, i) => (
          <ExerciseCard
            key={e.key}
            exercise={e}
            isFirst={i === 0}
            isLast={i === workout.exercises.length - 1}
            linkedToNext={e.supersetGroup !== null && workout.exercises[i + 1]?.supersetGroup === e.supersetGroup}
            onFocusExercise={focusExercise}
          />
        ))}

        <div className="space-y-3 px-3 pt-2">
          <button
            onClick={() => setPicking(true)}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-accent/15 py-3 font-medium text-accent-ink"
          >
            <Plus size={18} /> Add exercise
          </button>
          <button
            onClick={async () => {
              const message = workout.editing ? 'Discard your changes?' : 'Discard this workout? Nothing will be saved.'
              if (!confirm(message)) return
              const id = workout.workoutId
              const editing = !!workout.editing
              await discard()
              navigate(editing ? `/history/${id}` : '/', { replace: true })
            }}
            className="w-full py-3 text-sm text-bad"
          >
            {workout.editing ? 'Cancel editing' : 'Discard workout'}
          </button>
        </div>
      </main>

      <RestTimerBar />

      <ExercisePicker open={picking} onClose={() => setPicking(false)} onSelect={(ids, ss) => void addExercises(ids, ss)} />
    </div>
  )
}
