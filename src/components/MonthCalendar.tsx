import {
  addDays,
  addMonths,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
} from 'date-fns'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useState } from 'react'

const WEEK = { weekStartsOn: 1 } as const

interface Props {
  month: Date
  // yyyy-MM-dd → number of workouts that day
  counts: Map<string, number>
  selected: string | null
  onSelect: (day: string | null) => void
  onMonthChange: (month: Date) => void
}

export function MonthCalendar({ month, counts, selected, onSelect, onMonthChange }: Props) {
  const days: Date[] = []
  for (let d = startOfWeek(startOfMonth(month), WEEK); d <= endOfWeek(endOfMonth(month), WEEK); d = addDays(d, 1)) days.push(d)
  const [today] = useState(() => new Date())
  const atCurrentMonth = isSameMonth(month, today)

  return (
    <section className="rounded-xl bg-surface p-3">
      <div className="mb-2 flex items-center justify-between">
        <button onClick={() => onMonthChange(addMonths(month, -1))} aria-label="Previous month" className="p-2 text-muted">
          <ChevronLeft size={20} />
        </button>
        <p className="font-semibold">{format(month, 'MMMM yyyy')}</p>
        <button
          onClick={() => onMonthChange(addMonths(month, 1))}
          disabled={atCurrentMonth}
          aria-label="Next month"
          className="p-2 text-muted disabled:opacity-30"
        >
          <ChevronRight size={20} />
        </button>
      </div>
      <div className="grid grid-cols-7 text-center text-xs text-subtle">
        {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
          <span key={i} className="pb-1">
            {d}
          </span>
        ))}
        {days.map((d) => {
          const key = format(d, 'yyyy-MM-dd')
          const count = counts.get(key) ?? 0
          const inMonth = isSameMonth(d, month)
          const isSelected = selected === key
          return (
            <button
              key={key}
              disabled={!inMonth || count === 0}
              onClick={() => onSelect(isSelected ? null : key)}
              aria-label={`${format(d, 'd MMMM')}${count ? `, ${count} workout${count > 1 ? 's' : ''}` : ''}`}
              className="flex aspect-square items-center justify-center"
            >
              <span
                className={`flex size-9 items-center justify-center rounded-full text-sm tabular-nums ${
                  !inMonth
                    ? 'text-faint'
                    : count
                      ? isSelected
                        ? 'bg-fg font-semibold text-app'
                        : 'bg-accent font-semibold text-black'
                      : 'text-fg-soft'
                } ${isToday(d) && !count ? 'ring-1 ring-subtle' : ''}`}
              >
                {format(d, 'd')}
              </span>
            </button>
          )
        })}
      </div>
    </section>
  )
}
