import { format } from 'date-fns'
import { ChevronLeft, Pencil } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { ChartCard, TrendChart } from '../../components/charts'
import { getDb } from '../../db/client'
import { getExercise, type Exercise } from '../../db/repos/exercises'
import { exerciseHistory, type ExerciseSession } from '../../db/repos/workouts'
import { bestOneRepMax, heaviestSet, isWorkingSet, totalVolume } from '../../domain/sets'
import { formatVolume, formatWeight, toDisplayWeight } from '../../domain/units'
import { formatClock, label } from '../../lib/format'
import { useSettings } from '../../store/settings'

function Tile({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <div className="rounded-xl bg-surface p-3">
      <p className="text-xs text-muted">{label}</p>
      <p className="text-lg font-semibold">{value}</p>
      {detail && <p className="text-xs text-subtle">{detail}</p>}
    </div>
  )
}

export function ExerciseDetail() {
  const id = Number(useParams().id)
  const navigate = useNavigate()
  const unit = useSettings((s) => s.unit)
  const [exercise, setExercise] = useState<Exercise | null>(null)
  const [history, setHistory] = useState<ExerciseSession[]>([])

  useEffect(() => {
    void (async () => {
      const db = await getDb()
      const e = await getExercise(db, id)
      if (!e) return navigate('/exercises', { replace: true })
      setExercise(e)
      setHistory(await exerciseHistory(db, id))
    })()
  }, [id, navigate])

  if (!exercise) return null

  const allSets = history.flatMap((h) => h.sets)
  const best1rm = bestOneRepMax(allSets)
  const heaviest = heaviestSet(allSets)
  const loaded = exercise.tracking === 'weight_reps' || allSets.some((s) => s.weightKg)
  const trend = history
    .map((h) => ({ label: format(h.startedAt, 'd MMM'), value: bestOneRepMax(h.sets) }))
    .filter((p): p is { label: string; value: number } => p.value !== null)
    .map((p) => ({ ...p, value: toDisplayWeight(p.value, unit) }))
  const volumeTrend = history.map((h) => ({ label: format(h.startedAt, 'd MMM'), value: toDisplayWeight(totalVolume(h.sets), unit) }))

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center gap-2 border-b border-line px-3 py-3">
        <button onClick={() => navigate(-1)} aria-label="Back" className="p-1 text-muted">
          <ChevronLeft size={24} />
        </button>
        <h1 className="flex-1 truncate font-semibold">{exercise.name}</h1>
        <Link to={`/exercises/${id}/edit`} aria-label="Edit exercise" className="p-1 text-muted">
          <Pencil size={20} />
        </Link>
      </header>

      <main className="flex-1 space-y-4 overflow-y-auto p-4">
        <p className="text-sm text-muted">
          {label(exercise.primaryMuscles.join(', '))}
          {exercise.secondaryMuscles.length > 0 && ` · also ${exercise.secondaryMuscles.map(label).join(', ').toLowerCase()}`}
          {' · '}
          {label(exercise.equipment)}
        </p>

        {history.length === 0 ? (
          <p className="rounded-xl border border-dashed border-line p-6 text-center text-sm text-subtle">
            No history yet for this exercise.
          </p>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-2">
              {loaded && best1rm !== null && <Tile label="Best est. 1RM" value={formatWeight(best1rm, unit)} />}
              {loaded && heaviest && (
                <Tile label="Heaviest set" value={formatWeight(heaviest.weightKg, unit)} detail={`× ${heaviest.reps} reps`} />
              )}
              <Tile label="Sessions" value={String(history.length)} />
              <Tile label="Working sets" value={String(allSets.filter(isWorkingSet).length)} />
            </div>

            {trend.length >= 2 && (
              <ChartCard
                title="Estimated 1RM"
                subtitle={`Best set each session, ${unit}`}
                data={trend}
                formatValue={(v) => `${v} ${unit}`}
              >
                <TrendChart data={trend} formatValue={(v) => `${v} ${unit}`} />
              </ChartCard>
            )}
            {loaded && volumeTrend.length >= 2 && (
              <ChartCard
                title="Volume"
                subtitle={`Per session, ${unit}`}
                data={volumeTrend}
                formatValue={(v) => `${Math.round(v).toLocaleString()} ${unit}`}
              >
                <TrendChart data={volumeTrend} formatValue={(v) => `${Math.round(v).toLocaleString()} ${unit}`} />
              </ChartCard>
            )}

            <section className="space-y-2">
              <h2 className="text-sm font-medium text-muted">History</h2>
              {[...history].reverse().map((h) => (
                <Link key={h.workoutId} to={`/history/${h.workoutId}`} className="block rounded-xl bg-surface p-3">
                  <p className="text-sm font-medium">{format(h.startedAt, 'EEE d MMM yyyy')}</p>
                  <p className="text-sm text-muted tabular-nums">
                    {h.sets
                      .map((s) =>
                        s.durationS
                          ? formatClock(s.durationS)
                          : s.weightKg
                            ? `${toDisplayWeight(s.weightKg, unit)}×${s.reps}`
                            : `${s.reps}`,
                      )
                      .join(', ')}
                  </p>
                  {loaded && <p className="text-xs text-subtle">{formatVolume(totalVolume(h.sets), unit)}</p>}
                </Link>
              ))}
            </section>
          </>
        )}
      </main>
    </div>
  )
}
