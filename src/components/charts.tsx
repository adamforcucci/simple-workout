import { useState, type ReactNode } from 'react'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipContentProps,
} from 'recharts'
import { compact } from '../lib/format'

// Single-series charts: one validated hue (--color-chart), no legend (the card
// title names the series), hairline recessive grid, tooltip on tap, and a
// table view so no value is tooltip-only. Colours are theme tokens.
const MARK = 'var(--color-chart)'
const SURFACE = 'var(--color-surface)' // the card the charts sit on
const GRID = 'var(--color-chart-grid)'
const TICK = { fill: 'var(--color-chart-tick)', fontSize: 11 }

export interface Point {
  label: string
  value: number
}

interface CardProps {
  title: string
  subtitle?: ReactNode
  data: Point[]
  formatValue: (v: number) => string
  children: ReactNode
}

export function ChartCard({ title, subtitle, data, formatValue, children }: CardProps) {
  const [table, setTable] = useState(false)
  return (
    <section className="rounded-xl bg-surface p-4">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div>
          <h3 className="font-semibold">{title}</h3>
          {subtitle && <p className="text-sm text-muted">{subtitle}</p>}
        </div>
        <button onClick={() => setTable((t) => !t)} className="text-xs text-muted underline-offset-2 active:underline">
          {table ? 'Chart' : 'Table'}
        </button>
      </div>
      {table ? (
        <table className="w-full text-sm">
          <tbody>
            {data.map((d, i) => (
              <tr key={i} className="border-t border-line">
                <td className="py-1.5 text-muted">{d.label}</td>
                <td className="py-1.5 text-right tabular-nums">{formatValue(d.value)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        children
      )}
    </section>
  )
}

function TooltipCard({ active, payload, label, format }: TooltipContentProps<number, string> & { format: (v: number) => string }) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-md bg-raised px-2.5 py-1.5 text-xs shadow-lg">
      <p className="text-muted">{label}</p>
      <p className="font-semibold text-fg tabular-nums">{format(payload[0].value as number)}</p>
    </div>
  )
}


interface ChartProps {
  data: Point[]
  formatValue: (v: number) => string
  height?: number
}

// Change over time: 2px line with a 10% wash, ringed markers when sparse.
export function TrendChart({ data, formatValue, height = 180 }: ChartProps) {
  const values = data.map((d) => d.value)
  const pad = Math.max(1, (Math.max(...values) - Math.min(...values)) * 0.15)
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
        <CartesianGrid vertical={false} stroke={GRID} strokeWidth={1} />
        <XAxis dataKey="label" tick={TICK} tickLine={false} axisLine={{ stroke: GRID }} minTickGap={24} />
        <YAxis
          tick={TICK}
          tickLine={false}
          axisLine={false}
          width={52}
          tickFormatter={compact}
          domain={[Math.floor(Math.min(...values) - pad), Math.ceil(Math.max(...values) + pad)]}
        />
        <Tooltip
          cursor={{ stroke: 'var(--color-chart-cursor)', strokeWidth: 1 }}
          content={(p) => <TooltipCard {...(p as TooltipContentProps<number, string>)} format={formatValue} />}
        />
        <Area
          type="monotone"
          dataKey="value"
          stroke={MARK}
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
          fill={MARK}
          fillOpacity={0.1}
          dot={data.length <= 24 ? { r: 4, fill: MARK, stroke: SURFACE, strokeWidth: 2 } : false}
          activeDot={{ r: 5, fill: MARK, stroke: SURFACE, strokeWidth: 2 }}
          isAnimationActive={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}

// Magnitude per period: ≤24px columns, 4px rounded tops, square at the baseline.
export function ColumnChart({ data, formatValue, height = 180 }: ChartProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -12 }} barCategoryGap={2}>
        <CartesianGrid vertical={false} stroke={GRID} strokeWidth={1} />
        <XAxis dataKey="label" tick={TICK} tickLine={false} axisLine={{ stroke: GRID }} minTickGap={16} />
        <YAxis tick={TICK} tickLine={false} axisLine={false} width={52} tickFormatter={compact} allowDecimals={false} />
        <Tooltip
          cursor={{ fill: 'var(--color-chart-band)', opacity: 0.6 }}
          content={(p) => <TooltipCard {...(p as TooltipContentProps<number, string>)} format={formatValue} />}
        />
        <Bar dataKey="value" fill={MARK} maxBarSize={24} radius={[4, 4, 0, 0]} isAnimationActive={false} />
      </BarChart>
    </ResponsiveContainer>
  )
}

// Ranked magnitudes: horizontal bars with the value at the tip.
export function BarList({ data, formatValue }: Omit<ChartProps, 'height'>) {
  const max = Math.max(1, ...data.map((d) => d.value))
  return (
    <ul className="space-y-2.5">
      {data.map((d) => (
        <li key={d.label} className="grid grid-cols-[6.5rem_1fr] items-center gap-3 text-sm">
          <span className="truncate text-muted">{d.label}</span>
          <span className="flex items-center gap-2">
            {/* Bars stop short of the edge so the value label always fits on one line. */}
            <span className="h-3 rounded-r-[4px]" style={{ width: `${(d.value / max) * 70}%`, background: MARK }} />
            <span className="text-xs whitespace-nowrap text-fg-soft tabular-nums">{formatValue(d.value)}</span>
          </span>
        </li>
      ))}
    </ul>
  )
}
