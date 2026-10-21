import { format } from 'date-fns'
import { ChevronLeft, Trophy } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Navigate, useNavigate } from 'react-router'
import { getDb } from '../../db/client'
import { getHrSamples, type HrSample } from '../../db/repos/hr'
import { bodyWeightOn } from '../../db/repos/profile'
import { getRoutine } from '../../db/repos/routines'
import { exerciseHistory } from '../../db/repos/workouts'
import { estimateCalories } from '../../domain/calories'
import { findPrs, type PersonalRecord } from '../../domain/prs'
import { totalVolume } from '../../domain/sets'
import { formatVolume, formatWeight } from '../../domain/units'
import { formatDuration } from '../../lib/format'
import { routineChanged, routineFromWorkout, useActiveWorkout } from '../../store/activeWorkout'
import { useProfile } from '../../store/profile'
import { useSettings } from '../../store/settings'
import { useStrava } from '../../store/strava'
import { flushHeartRate } from './workoutSession'

const PR_LABEL: Record<PersonalRecord['kind'], string> = { weight: 'Heaviest weight', oneRepMax: 'Best est. 1RM', reps: 'Most reps' }

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-surface p-3">
      <p className="text-xs text-muted">{label}</p>
      <p className="text-lg font-semibold tabular-nums">{value}</p>
    </div>
  )
}

export function FinishWorkout() {
  const workout = useActiveWorkout((s) => s.workout)
  const unit = useSettings((s) => s.unit)
  const navigate = useNavigate()
  const [name, setName] = useState(workout?.name ?? '')
  const [notes, setNotes] = useState(workout?.editing?.notes ?? '')
  const [saving, setSaving] = useState(false)
  const [bodyWeight, setBodyWeight] = useState<number | null>(null)
  const [prs, setPrs] = useState<{ name: string; pr: PersonalRecord }[]>([])
  const [hr, setHr] = useState<HrSample[]>([])
  const profile = useProfile((s) => s.profile)
  // Offered when the session was started from a routine and differs from it.
  const [routineUpdate, setRoutineUpdate] = useState<{ name: string; changed: boolean } | null>(null)
  const [updateRoutine, setUpdateRoutine] = useState(false)
  const [endedAt] = useState(() => workout?.editing?.endedAt ?? Date.now())

  useEffect(() => {
    if (!workout) return
    let cancelled = false
    void (async () => {
      if (!workout.editing) await flushHeartRate()
      const db = await getDb()
      const weight = await bodyWeightOn(db, format(workout.startedAt, 'yyyy-MM-dd'))
      const samples = await getHrSamples(db, workout.workoutId)
      const routine = workout.routineId !== null && !workout.editing ? await getRoutine(db, workout.routineId) : undefined
      const changed = routine ? routineChanged(routine, routineFromWorkout(workout, routine)) : false
      const found: { name: string; pr: PersonalRecord }[] = []
      for (const e of workout.exercises) {
        const done = e.sets.filter((s) => s.completedAt !== null)
        if (done.length === 0) continue
        // Only earlier sessions count, so editing an old workout judges it as of that day.
        const before = (await exerciseHistory(db, e.exerciseId)).filter((h) => h.startedAt < workout.startedAt)
        for (const pr of findPrs(before, done)) found.push({ name: e.name, pr })
      }
      if (!cancelled) {
        setBodyWeight(weight)
        setHr(samples)
        setRoutineUpdate(routine ? { name: routine.name, changed } : null)
        setUpdateRoutine(changed)
        setPrs(found)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [workout])

  if (!workout) return <Navigate to="/" replace />

  const done = workout.exercises.flatMap((e) => e.sets.filter((s) => s.completedAt !== null))
  const incomplete = workout.exercises.reduce((n, e) => n + e.sets.filter((s) => s.completedAt === null).length, 0)
  const durationS = (endedAt - workout.startedAt) / 1000
  const estimate = estimateCalories({
    samples: hr,
    durationS,
    weightKg: bodyWeight,
    sex: profile?.sex ?? null,
    dob: profile?.dob ?? null,
    at: new Date(workout.startedAt),
  })
  const calories = estimate?.kcal ?? null
  const avgHr = hr.length ? Math.round(hr.reduce((n, s) => n + s.bpm, 0) / hr.length) : null
  const maxHr = hr.length ? Math.max(...hr.map((s) => s.bpm)) : null

  const save = async () => {
    setSaving(true)
    try {
      const id = await useActiveWorkout.getState().finish({
        name,
        notes,
        calories,
        avgHr: avgHr ?? workout.editing?.avgHr ?? null,
        maxHr: maxHr ?? workout.editing?.maxHr ?? null,
        endedAt,
        updateRoutine,
      })
      // Fire and forget: the workout page shows progress.
      if (!workout.editing && useSettings.getState().stravaAutoUpload && useStrava.getState().auth)
        void useStrava.getState().upload(id)
      navigate(`/history/${id}`, { replace: true })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center gap-2 border-b border-line px-3 py-3">
        <button onClick={() => navigate('/workout')} aria-label="Back to workout" className="p-1 text-muted">
          <ChevronLeft size={24} />
        </button>
        <h1 className="flex-1 font-semibold">{workout.editing ? 'Save changes' : 'Finish workout'}</h1>
      </header>

      <main className="flex-1 space-y-4 overflow-y-auto p-4">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full rounded-lg bg-surface px-3 py-3 text-lg font-semibold outline-none"
        />
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="How did it go?"
          rows={3}
          className="w-full rounded-lg bg-surface px-3 py-2 outline-none placeholder:text-subtle"
        />

        <div className="grid grid-cols-2 gap-2">
          <Stat label="Duration" value={formatDuration(durationS)} />
          <Stat label="Volume" value={formatVolume(totalVolume(done), unit)} />
          <Stat label="Sets" value={String(done.filter((s) => s.type !== 'warmup').length)} />
          <Stat label="Calories" value={calories !== null ? `${calories} kcal` : '–'} />
          {avgHr !== null && <Stat label="Avg heart rate" value={`${avgHr} bpm`} />}
          {maxHr !== null && <Stat label="Max heart rate" value={`${maxHr} bpm`} />}
        </div>
        {calories === null && <p className="text-sm text-subtle">Log your body weight in Profile to estimate calories.</p>}
        {estimate?.method === 'duration' && hr.length > 0 && !profile?.dob && (
          <p className="text-sm text-subtle">Add your date of birth in Profile to estimate calories from heart rate.</p>
        )}

        {prs.length > 0 && (
          <div className="rounded-lg bg-warn-soft p-3">
            <p className="mb-2 flex items-center gap-2 font-semibold text-warn">
              <Trophy size={18} /> Personal records
            </p>
            <ul className="space-y-1 text-sm">
              {prs.map(({ name, pr }, i) => (
                <li key={i}>
                  {name} — {PR_LABEL[pr.kind]}: {pr.kind === 'reps' ? `${pr.value} reps` : formatWeight(pr.value, unit)}
                </li>
              ))}
            </ul>
          </div>
        )}

        {routineUpdate?.changed && (
          <label className="flex items-start gap-3 rounded-lg bg-surface p-3">
            <input
              type="checkbox"
              checked={updateRoutine}
              onChange={(e) => setUpdateRoutine(e.target.checked)}
              className="mt-0.5 size-5 accent-[var(--color-accent)]"
            />
            <span>
              <span className="block font-medium">Update “{routineUpdate.name}”</span>
              <span className="text-sm text-muted">
                Save today's exercises, sets, weights, reps and rest as the routine for next time.
              </span>
            </span>
          </label>
        )}

        {incomplete > 0 && done.length > 0 && (
          <p className="text-sm text-warn">
            {incomplete} incomplete {incomplete === 1 ? 'set' : 'sets'} won't be saved.
          </p>
        )}
        {done.length === 0 && <p className="text-sm text-warn">Complete at least one set to save this workout.</p>}
      </main>

      <div className="border-t border-line p-3">
        <button
          disabled={saving || done.length === 0}
          onClick={save}
          className="w-full rounded-lg bg-emerald-500 py-3 font-semibold text-black disabled:opacity-40"
        >
          {workout.editing ? 'Save changes' : 'Save workout'}
        </button>
      </div>
    </div>
  )
}
