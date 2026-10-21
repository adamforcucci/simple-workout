import { ChevronLeft } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { useNavigate, useParams } from 'react-router'
import { getDb } from '../../db/client'
import {
  createCustomExercise,
  getExercise,
  setExerciseArchived,
  updateExercise,
  type Exercise,
  type ExerciseInput,
} from '../../db/repos/exercises'
import { displayName, EQUIPMENT, MUSCLES, type Muscle, type Tracking } from '../../domain/exerciseCatalog'
import { formatClock, label } from '../../lib/format'
import { STRAVA_EXERCISE_GROUPS, type StravaExerciseGroup } from '../../strava/exerciseIds'
import { REST_PRESETS } from '../workout/workoutUi'

const TRACKING: { value: Tracking; label: string }[] = [
  { value: 'weight_reps', label: 'Weight × reps' },
  { value: 'reps', label: 'Reps (bodyweight)' },
  { value: 'duration', label: 'Time' },
]

const groupOf = (stravaId: string) =>
  (Object.entries(STRAVA_EXERCISE_GROUPS) as [StravaExerciseGroup, readonly string[]][]).find(([, ids]) =>
    ids.includes(stravaId),
  )?.[0] ?? 'Total Body'

const BLANK: ExerciseInput = {
  name: '',
  stravaExerciseType: 'TOTAL_BODY_GENERIC',
  category: 'Total Body',
  primaryMuscles: [],
  secondaryMuscles: [],
  equipment: 'barbell',
  tracking: 'weight_reps',
  defaultRestS: 0,
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <p className="text-sm text-muted">{label}</p>
      {children}
    </div>
  )
}

function MuscleChips({ value, onChange }: { value: Muscle[]; onChange: (v: Muscle[]) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {MUSCLES.map((m) => {
        const on = value.includes(m)
        return (
          <button
            key={m}
            type="button"
            onClick={() => onChange(on ? value.filter((x) => x !== m) : [...value, m])}
            className={`rounded-full px-3 py-1 text-sm ${on ? 'bg-accent text-on-accent' : 'bg-raised text-fg-soft'}`}
          >
            {label(m)}
          </button>
        )
      })}
    </div>
  )
}

export function ExerciseForm() {
  const { id } = useParams()
  const editingId = id === undefined ? undefined : Number(id)
  const navigate = useNavigate()
  const [original, setOriginal] = useState<Exercise | null>(null)
  const [form, setForm] = useState<ExerciseInput>(BLANK)
  const [loaded, setLoaded] = useState(editingId === undefined)

  useEffect(() => {
    if (editingId === undefined) return
    void (async () => {
      const e = await getExercise(await getDb(), editingId)
      if (!e) return navigate('/exercises', { replace: true })
      setOriginal(e)
      setForm(e)
      setLoaded(true)
    })()
  }, [editingId, navigate])

  if (!loaded) return null
  const set = (patch: Partial<ExerciseInput>) => setForm((f) => ({ ...f, ...patch }))
  const builtIn = original !== null && !original.isCustom
  const input = 'w-full rounded-md bg-raised px-3 py-2 outline-none'

  const save = async () => {
    const db = await getDb()
    const data = { ...form, name: form.name.trim(), category: groupOf(form.stravaExerciseType) }
    if (editingId === undefined) {
      const newId = await createCustomExercise(db, data)
      navigate(`/exercises/${newId}`, { replace: true })
    } else {
      await updateExercise(db, editingId, data)
      navigate(-1)
    }
  }

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center gap-2 border-b border-line px-3 py-3">
        <button onClick={() => navigate(-1)} aria-label="Back" className="p-1 text-muted">
          <ChevronLeft size={24} />
        </button>
        <h1 className="flex-1 font-semibold">{editingId === undefined ? 'New exercise' : 'Edit exercise'}</h1>
        <button
          disabled={!form.name.trim() || form.primaryMuscles.length === 0}
          onClick={() => void save()}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-on-accent disabled:opacity-40"
        >
          Save
        </button>
      </header>

      <main className="flex-1 space-y-5 overflow-y-auto p-4">
        <Row label="Name">
          <input value={form.name} onChange={(e) => set({ name: e.target.value })} className={input} />
        </Row>

        <Row label="Shows on Strava as">
          <select
            value={form.stravaExerciseType}
            disabled={builtIn}
            onChange={(e) => set({ stravaExerciseType: e.target.value })}
            className={`${input} disabled:opacity-60`}
          >
            {Object.entries(STRAVA_EXERCISE_GROUPS).map(([group, ids]) => (
              <optgroup key={group} label={group}>
                {ids.map((sid) => (
                  <option key={sid} value={sid}>
                    {displayName(sid)}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
          <p className="text-xs text-subtle">
            {builtIn
              ? 'Built-in exercises always map to their own Strava exercise.'
              : 'Pick the closest Strava exercise so it shows on Strava’s muscle map.'}
          </p>
        </Row>

        <Row label="Logged as">
          <select value={form.tracking} onChange={(e) => set({ tracking: e.target.value as Tracking })} className={input}>
            {TRACKING.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </Row>

        <Row label="Equipment">
          <select
            value={form.equipment}
            onChange={(e) => set({ equipment: e.target.value as ExerciseInput['equipment'] })}
            className={input}
          >
            {EQUIPMENT.map((m) => (
              <option key={m} value={m}>
                {label(m)}
              </option>
            ))}
          </select>
        </Row>

        <Row label="Default rest">
          <select value={form.defaultRestS} onChange={(e) => set({ defaultRestS: Number(e.target.value) })} className={input}>
            {REST_PRESETS.map((s) => (
              <option key={s} value={s}>
                {s ? formatClock(s) : 'Off'}
              </option>
            ))}
          </select>
        </Row>

        <Row label="Primary muscles">
          <MuscleChips value={form.primaryMuscles} onChange={(primaryMuscles) => set({ primaryMuscles })} />
        </Row>
        <Row label="Secondary muscles">
          <MuscleChips value={form.secondaryMuscles} onChange={(secondaryMuscles) => set({ secondaryMuscles })} />
        </Row>

        {editingId !== undefined && original?.isCustom && (
          <button
            onClick={async () => {
              if (!confirm(`Remove "${original.name}" from the library? Past workouts keep it.`)) return
              await setExerciseArchived(await getDb(), editingId, true)
              navigate('/exercises', { replace: true })
            }}
            className="w-full py-3 text-sm text-bad"
          >
            Remove exercise
          </button>
        )}
      </main>
    </div>
  )
}
