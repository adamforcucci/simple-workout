import { format, startOfMonth, startOfWeek, subDays } from 'date-fns'
import { ChevronRight, Dumbbell } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { BarList, ChartCard, ColumnChart } from '../../components/charts'
import { getDb } from '../../db/client'
import { workingSets } from '../../db/repos/stats'
import { listWorkouts, type WorkoutSummary } from '../../db/repos/workouts'
import { bestLifts, muscleSplit, weekStreak, weeklySeries, type BestLift } from '../../domain/stats'
import { formatVolume, formatWeight, toDisplayWeight } from '../../domain/units'
import { label, plural } from '../../lib/format'
import { useSettings } from '../../store/settings'

const WEEKS = 12

function Tile({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <div className="rounded-xl bg-surface p-3">
      <p className="text-xs text-muted">{label}</p>
      <p className="text-xl font-semibold">{value}</p>
      {detail && <p className="text-xs text-subtle">{detail}</p>}
    </div>
  )
}

interface Data {
  now: number
  workouts: WorkoutSummary[]
  split: { muscle: string; sets: number }[]
  lifts: BestLift[]
}

export function StatsPage() {
  const unit = useSettings((s) => s.unit)
  const [data, setData] = useState<Data | null>(null)

  useEffect(() => {
    void (async () => {
      const db = await getDb()
      const [workouts, recentSets, allSets] = await Promise.all([
        listWorkouts(db),
        workingSets(db, subDays(new Date(), 30).getTime()),
        workingSets(db),
      ])
      setData({ now: Date.now(), workouts, split: muscleSplit(recentSets), lifts: bestLifts(allSets) })
    })()
  }, [])

  if (!data) return null
  const { now, workouts, split, lifts } = data

  const weekStart = startOfWeek(now, { weekStartsOn: 1 }).getTime()
  const monthStart = startOfMonth(now).getTime()
  const thisWeek = workouts.filter((w) => w.startedAt >= weekStart)
  const thisMonth = workouts.filter((w) => w.startedAt >= monthStart)
  const sum = (ws: WorkoutSummary[]) => ws.reduce((n, w) => n + w.volumeKg, 0)
  const series = weeklySeries(workouts, WEEKS, now)
  const kgToUnit = (kg: number) => toDisplayWeight(kg, unit)

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Stats</h1>
        <Link to="/exercises" className="flex items-center gap-1.5 text-sm text-accent-ink">
          <Dumbbell size={16} /> Exercises
        </Link>
      </div>

      {workouts.length === 0 ? (
        <p className="rounded-xl border border-dashed border-line p-6 text-center text-sm text-subtle">
          Your stats will appear here after your first workout.
        </p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2">
            <Tile label="This week" value={plural(thisWeek.length, 'workout')} detail={formatVolume(sum(thisWeek), unit)} />
            <Tile label="This month" value={plural(thisMonth.length, 'workout')} detail={formatVolume(sum(thisMonth), unit)} />
            <Tile label="Weekly streak" value={plural(weekStreak(workouts, now), 'week')} />
            <Tile label="All time" value={formatVolume(sum(workouts), unit)} detail={plural(workouts.length, 'workout')} />
          </div>

          <ChartCard
            title="Volume per week"
            subtitle={`Last ${WEEKS} weeks, ${unit}`}
            data={series.map((b) => ({ label: b.label, value: kgToUnit(b.volumeKg) }))}
            formatValue={(v) => `${Math.round(v).toLocaleString()} ${unit}`}
          >
            <ColumnChart
              data={series.map((b) => ({ label: b.label, value: kgToUnit(b.volumeKg) }))}
              formatValue={(v) => `${Math.round(v).toLocaleString()} ${unit}`}
            />
          </ChartCard>

          <ChartCard
            title="Workouts per week"
            subtitle={`Last ${WEEKS} weeks`}
            data={series.map((b) => ({ label: b.label, value: b.workouts }))}
            formatValue={(v) => plural(v, 'workout')}
          >
            <ColumnChart
              data={series.map((b) => ({ label: b.label, value: b.workouts }))}
              formatValue={(v) => plural(v, 'workout')}
            />
          </ChartCard>

          {split.length > 0 && (
            <ChartCard
              title="Sets per muscle"
              subtitle="Working sets, last 30 days"
              data={split.map((s) => ({ label: label(s.muscle), value: s.sets }))}
              formatValue={(v) => plural(v, 'set')}
            >
              <BarList data={split.map((s) => ({ label: label(s.muscle), value: s.sets }))} formatValue={String} />
            </ChartCard>
          )}

          {lifts.length > 0 && (
            <section className="rounded-xl bg-surface p-4">
              <h3 className="font-semibold">Best lifts</h3>
              <p className="mb-2 text-sm text-muted">By estimated one-rep max</p>
              <ul>
                {lifts.slice(0, 10).map((l) => (
                  <li key={l.exerciseId} className="border-t border-line">
                    <Link to={`/exercises/${l.exerciseId}`} className="flex items-center gap-2 py-2.5">
                      <span className="min-w-0 flex-1">
                        <span className="block truncate">{l.name}</span>
                        <span className="text-xs text-subtle">
                          {formatWeight(l.weightKg, unit)} × {l.reps} · {format(l.startedAt, 'd MMM yyyy')}
                        </span>
                      </span>
                      <span className="font-semibold tabular-nums">{formatWeight(l.oneRepMax, unit)}</span>
                      <ChevronRight size={16} className="text-faint" />
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  )
}
