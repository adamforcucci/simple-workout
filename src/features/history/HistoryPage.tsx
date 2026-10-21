import { endOfMonth, format, parseISO, startOfMonth } from 'date-fns'
import { ChevronRight } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router'
import { MonthCalendar } from '../../components/MonthCalendar'
import { getDb } from '../../db/client'
import { listWorkouts, type WorkoutSummary } from '../../db/repos/workouts'
import { formatVolume } from '../../domain/units'
import { formatDuration, plural } from '../../lib/format'
import { useSettings } from '../../store/settings'

const dayKey = (ts: number) => format(ts, 'yyyy-MM-dd')

export function WorkoutListItem({ w }: { w: WorkoutSummary }) {
  const unit = useSettings((s) => s.unit)
  return (
    <Link to={`/history/${w.id}`} className="flex items-center gap-3 rounded-xl bg-surface p-4 active:bg-raised">
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold">{w.name}</p>
        <p className="text-sm text-muted">{format(w.startedAt, 'EEE d MMM · h:mm a')}</p>
        <p className="mt-1 text-sm text-fg-soft">
          {formatDuration(((w.endedAt ?? w.startedAt) - w.startedAt) / 1000)} · {formatVolume(w.volumeKg, unit)} ·{' '}
          {plural(w.setCount, 'set')}
        </p>
      </div>
      <ChevronRight size={18} className="text-faint" />
    </Link>
  )
}

export function HistoryPage() {
  const [month, setMonth] = useState(() => startOfMonth(new Date()))
  const [workouts, setWorkouts] = useState<WorkoutSummary[] | null>(null)
  const [selected, setSelected] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void getDb()
      .then((db) => listWorkouts(db, { from: month.getTime(), to: endOfMonth(month).getTime() + 1 }))
      .then((rows) => !cancelled && setWorkouts(rows))
    return () => {
      cancelled = true
    }
  }, [month])

  const counts = useMemo(() => {
    const m = new Map<string, number>()
    for (const w of workouts ?? []) m.set(dayKey(w.startedAt), (m.get(dayKey(w.startedAt)) ?? 0) + 1)
    return m
  }, [workouts])

  const shown = (workouts ?? []).filter((w) => !selected || dayKey(w.startedAt) === selected)

  return (
    <div className="space-y-4 p-4">
      <h1 className="text-2xl font-semibold">History</h1>
      <MonthCalendar
        month={month}
        counts={counts}
        selected={selected}
        onSelect={setSelected}
        onMonthChange={(m) => {
          setSelected(null)
          setMonth(m)
        }}
      />
      <p className="text-sm text-muted">
        {selected
          ? format(parseISO(selected), 'EEEE d MMMM')
          : `${plural(workouts?.length ?? 0, 'workout')} in ${format(month, 'MMMM')}`}
      </p>
      <div className="space-y-2">
        {shown.map((w) => (
          <WorkoutListItem key={w.id} w={w} />
        ))}
      </div>
    </div>
  )
}
