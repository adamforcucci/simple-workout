import { Play, Plus } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { getDb } from '../../db/client'
import { listRoutines, type RoutineSummary } from '../../db/repos/routines'
import { formatClock } from '../../lib/format'
import { useNow } from '../../lib/useNow'
import { useActiveWorkout } from '../../store/activeWorkout'

export function WorkoutHome() {
  const workout = useActiveWorkout((s) => s.workout)
  const navigate = useNavigate()
  const now = useNow(1000, !!workout)
  const [routines, setRoutines] = useState<RoutineSummary[] | null>(null)
  const [starting, setStarting] = useState(false)

  useEffect(() => {
    void getDb().then(listRoutines).then(setRoutines)
  }, [])

  const start = async (routineId?: number) => {
    if (workout) {
      if (confirm('You already have a workout in progress. Resume it?')) navigate('/workout')
      return
    }
    setStarting(true)
    try {
      const store = useActiveWorkout.getState()
      await (routineId === undefined ? store.startEmpty() : store.startFromRoutine(routineId))
      navigate('/workout')
    } finally {
      setStarting(false)
    }
  }

  return (
    <div className="space-y-6 p-4">
      <h1 className="text-2xl font-semibold">Workout</h1>

      {workout ? (
        <button
          onClick={() => navigate('/workout')}
          className="flex w-full items-center justify-between rounded-xl bg-emerald-500 px-4 py-4 text-left text-black"
        >
          <span>
            <span className="block font-semibold">
              {workout.editing ? 'Continue editing' : 'Resume'} {workout.name}
            </span>
            <span className="text-sm tabular-nums">
              {workout.editing ? 'Unsaved changes' : formatClock((now - workout.startedAt) / 1000)}
            </span>
          </span>
          <Play size={22} />
        </button>
      ) : (
        <button
          disabled={starting}
          onClick={() => void start()}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-accent py-4 font-semibold text-black disabled:opacity-50"
        >
          <Plus size={20} /> Start empty workout
        </button>
      )}

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Routines</h2>
          <Link to="/routines/new" className="flex items-center gap-1 text-sm text-accent-ink">
            <Plus size={16} /> New
          </Link>
        </div>

        {routines?.length === 0 && (
          <p className="rounded-xl border border-dashed border-line p-6 text-center text-sm text-subtle">
            Save the workouts you repeat as routines to start them in one tap.
          </p>
        )}

        {routines?.map((r) => (
          <div key={r.id} className="flex items-center gap-3 rounded-xl bg-surface p-4">
            <Link to={`/routines/${r.id}`} className="min-w-0 flex-1">
              <p className="font-semibold">{r.name}</p>
              <p className="truncate text-sm text-muted">{r.exerciseNames.join(', ') || 'No exercises'}</p>
            </Link>
            <button
              disabled={starting}
              onClick={() => void start(r.id)}
              className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-black disabled:opacity-50"
            >
              Start
            </button>
          </div>
        ))}
      </section>
    </div>
  )
}
