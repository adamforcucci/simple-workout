import { format } from 'date-fns'
import { ChevronLeft, ClipboardList, MoreVertical, Pencil, Repeat, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { BarList, ChartCard, TrendChart } from '../../components/charts'
import { Sheet } from '../../components/Sheet'
import { getDb } from '../../db/client'
import { getHrSamples, type HrSample } from '../../db/repos/hr'
import { saveRoutine } from '../../db/repos/routines'
import { deleteWorkout, getWorkout, updateWorkoutMeta, type Workout } from '../../db/repos/workouts'
import { downsample, timeInZones } from '../../domain/heartRate'
import { estimatedOneRepMax, isWorkingSet, totalVolume } from '../../domain/sets'
import { formatVolume, formatWeight, toDisplayWeight } from '../../domain/units'
import { formatClock, formatDuration } from '../../lib/format'
import { useActiveWorkout } from '../../store/activeWorkout'
import { useSettings } from '../../store/settings'
import { useMaxHr } from '../heartRate/useMaxHr'
import { StravaWorkoutStatus } from '../strava/StravaPanels'
import { SUPERSET_COLORS } from '../workout/workoutUi'

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-surface p-3">
      <p className="text-xs text-muted">{label}</p>
      <p className="text-lg font-semibold">{value}</p>
    </div>
  )
}

const SET_LABEL = { warmup: 'W', drop: 'D', failure: 'F' } as const

function HeartRateSection({ samples, maxHr }: { samples: HrSample[]; maxHr: number }) {
  const points = downsample(samples, 150).map((s) => ({ label: formatClock(s.t), value: s.bpm }))
  const zones = timeInZones(samples, maxHr)
  const zoneRows = zones.map((sec, i) => ({ label: `Zone ${i + 1}`, value: Math.round(sec / 60) }))
  return (
    <>
      <ChartCard title="Heart rate" subtitle="bpm over the workout" data={points} formatValue={(v) => `${v} bpm`}>
        <TrendChart data={points} formatValue={(v) => `${v} bpm`} />
      </ChartCard>
      <ChartCard
        title="Time in zones"
        subtitle={`Minutes, by % of max heart rate (${maxHr} bpm)`}
        data={zoneRows}
        formatValue={(v) => `${v} min`}
      >
        <BarList data={zoneRows} formatValue={(v) => `${v} min`} />
      </ChartCard>
    </>
  )
}

export function WorkoutDetail() {
  const id = Number(useParams().id)
  const navigate = useNavigate()
  const unit = useSettings((s) => s.unit)
  const active = useActiveWorkout((s) => s.workout)
  const [workout, setWorkout] = useState<Workout | null>(null)
  const [menu, setMenu] = useState(false)
  const [hr, setHr] = useState<HrSample[]>([])
  const maxHr = useMaxHr()

  useEffect(() => {
    void (async () => {
      const db = await getDb()
      const w = await getWorkout(db, id)
      if (!w) return navigate('/history', { replace: true })
      setWorkout(w)
      setHr(await getHrSamples(db, id))
    })()
  }, [id, navigate])

  if (!workout) return null

  const sets = workout.exercises.flatMap((e) => e.sets)
  const durationS = ((workout.endedAt ?? workout.startedAt) - workout.startedAt) / 1000

  const blockedByActive = () => {
    if (!active) return false
    alert('Finish or discard the workout in progress first.')
    return true
  }

  const actions = [
    {
      label: 'Edit workout',
      icon: <Pencil size={18} />,
      onSelect: async () => {
        if (blockedByActive()) return
        await useActiveWorkout.getState().editFinished(workout.id)
        navigate('/workout')
      },
    },
    {
      label: 'Repeat workout',
      icon: <Repeat size={18} />,
      onSelect: async () => {
        if (blockedByActive()) return
        await useActiveWorkout.getState().repeatWorkout(workout.id)
        navigate('/workout')
      },
    },
    {
      label: 'Save as routine',
      icon: <ClipboardList size={18} />,
      onSelect: async () => {
        const routineId = await saveRoutine(await getDb(), {
          name: workout.name,
          notes: '',
          items: workout.exercises.map((e) => ({
            exerciseId: e.exerciseId,
            supersetGroup: e.supersetGroup,
            targetSets: Math.max(1, e.sets.filter(isWorkingSet).length),
            targetReps: e.sets.findLast(isWorkingSet)?.reps ?? null,
            targetWeightKg: e.sets.findLast(isWorkingSet)?.weightKg ?? null,
            targetDurationS: e.sets.findLast(isWorkingSet)?.durationS ?? null,
            restS: e.restS,
          })),
        })
        navigate(`/routines/${routineId}`)
      },
    },
    {
      label: 'Delete workout',
      icon: <Trash2 size={18} />,
      destructive: true,
      onSelect: async () => {
        if (!confirm(`Delete "${workout.name}"? This can't be undone.`)) return
        await deleteWorkout(await getDb(), workout.id)
        navigate('/history', { replace: true })
      },
    },
  ]

  const saveMeta = (patch: Partial<Pick<Workout, 'name' | 'notes'>>) => {
    const next = { ...workout, ...patch }
    setWorkout(next)
    void getDb().then((db) => updateWorkoutMeta(db, workout.id, { name: next.name, notes: next.notes }))
  }

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center gap-2 border-b border-line px-3 py-3">
        <button onClick={() => navigate(-1)} aria-label="Back" className="p-1 text-muted">
          <ChevronLeft size={24} />
        </button>
        <h1 className="flex-1 truncate font-semibold">{format(workout.startedAt, 'EEEE d MMMM yyyy')}</h1>
        <button onClick={() => setMenu(true)} aria-label="Workout options" className="p-1 text-muted">
          <MoreVertical size={22} />
        </button>
      </header>

      <main className="flex-1 space-y-4 overflow-y-auto p-4">
        <div>
          <input
            defaultValue={workout.name}
            onBlur={(e) => e.target.value.trim() && e.target.value !== workout.name && saveMeta({ name: e.target.value.trim() })}
            className="w-full bg-transparent text-xl font-semibold outline-none"
          />
          <p className="text-sm text-muted">
            {format(workout.startedAt, 'h:mm a')} – {format(workout.endedAt ?? workout.startedAt, 'h:mm a')}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Stat label="Duration" value={formatDuration(durationS)} />
          <Stat label="Volume" value={formatVolume(totalVolume(sets), unit)} />
          <Stat label="Sets" value={String(sets.filter(isWorkingSet).length)} />
          <Stat label="Calories" value={workout.calories !== null ? `${workout.calories} kcal` : '–'} />
          {workout.avgHr !== null && <Stat label="Avg heart rate" value={`${workout.avgHr} bpm`} />}
          {workout.maxHr !== null && <Stat label="Max heart rate" value={`${workout.maxHr} bpm`} />}
        </div>

        <StravaWorkoutStatus workoutId={workout.id} />

        {hr.length > 1 && <HeartRateSection samples={hr} maxHr={maxHr} />}

        <textarea
          defaultValue={workout.notes}
          onBlur={(e) => e.target.value !== workout.notes && saveMeta({ notes: e.target.value })}
          placeholder="Add notes"
          rows={2}
          className="w-full rounded-lg bg-surface px-3 py-2 text-sm outline-none placeholder:text-faint"
        />

        {workout.exercises.map((e, i) => (
          <section
            key={i}
            className={`rounded-r-xl border-l-4 bg-surface p-3 ${e.supersetGroup ? SUPERSET_COLORS[(e.supersetGroup - 1) % SUPERSET_COLORS.length] : 'rounded-l-xl border-transparent'}`}
          >
            {e.supersetGroup && <p className="text-xs font-medium tracking-wide text-muted uppercase">Superset</p>}
            <Link to={`/exercises/${e.exerciseId}`} className="font-semibold text-accent-ink">
              {e.name}
            </Link>
            {e.notes && <p className="text-sm text-muted">{e.notes}</p>}
            <table className="mt-2 w-full text-sm">
              <thead className="text-xs text-subtle uppercase">
                <tr>
                  <th className="w-10 text-left font-medium">Set</th>
                  <th className="text-left font-medium">Weight & reps</th>
                  <th className="text-right font-medium">Est. 1RM</th>
                </tr>
              </thead>
              <tbody className="tabular-nums">
                {(() => {
                  let n = 0
                  return e.sets.map((s, si) => {
                    if (s.type !== 'warmup') n++
                    const e1rm = s.weightKg && s.reps ? estimatedOneRepMax(s.weightKg, s.reps) : null
                    const badge = s.type === 'normal' ? null : SET_LABEL[s.type]
                    return (
                      <tr key={si} className="border-t border-line">
                        <td className={`py-1.5 ${badge ? 'text-warn' : ''}`}>{badge ?? n}</td>
                        <td className="py-1.5">
                          {s.durationS
                            ? formatClock(s.durationS)
                            : s.weightKg
                              ? `${toDisplayWeight(s.weightKg, unit)} ${unit} × ${s.reps}`
                              : `${s.reps} reps`}
                        </td>
                        <td className="py-1.5 text-right text-muted">{e1rm && isWorkingSet(s) ? formatWeight(e1rm, unit) : ''}</td>
                      </tr>
                    )
                  })
                })()}
              </tbody>
            </table>
          </section>
        ))}
      </main>

      <Sheet open={menu} onClose={() => setMenu(false)} actions={actions} />
    </div>
  )
}
