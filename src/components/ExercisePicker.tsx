import { Check, Search, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { getDb } from '../db/client'
import { searchExercises, type Exercise } from '../db/repos/exercises'
import { EQUIPMENT, MUSCLES, type Equipment, type Muscle } from '../domain/exerciseCatalog'
import { label } from '../lib/format'

interface Props {
  open: boolean
  onClose: () => void
  onSelect: (ids: number[], asSuperset: boolean) => void
  allowSuperset?: boolean
  // Pick exactly one (e.g. swapping an exercise): tapping a row chooses it.
  single?: boolean
  title?: string
}

function Chips<T extends string>({
  options,
  value,
  onChange,
}: {
  options: readonly T[]
  value: T | undefined
  onChange: (v: T | undefined) => void
}) {
  return (
    <div className="flex gap-2 overflow-x-auto px-4 pb-2 [scrollbar-width:none]">
      {options.map((o) => (
        <button
          key={o}
          onClick={() => onChange(value === o ? undefined : o)}
          className={`shrink-0 rounded-full px-3 py-1 text-sm ${value === o ? 'bg-accent text-on-accent' : 'bg-raised text-fg-soft'}`}
        >
          {label(o)}
        </button>
      ))}
    </div>
  )
}

export function ExercisePicker({ open, onClose, onSelect, allowSuperset = true, single = false, title }: Props) {
  const [query, setQuery] = useState('')
  const [muscle, setMuscle] = useState<Muscle>()
  const [equipment, setEquipment] = useState<Equipment>()
  const [results, setResults] = useState<Exercise[]>([])
  const [selected, setSelected] = useState<number[]>([])

  useEffect(() => {
    if (!open) return
    let cancelled = false
    const t = setTimeout(async () => {
      const rows = await searchExercises(await getDb(), { query, muscle, equipment })
      if (!cancelled) setResults(rows)
    }, 120)
    return () => {
      cancelled = true
      clearTimeout(t)
    }
  }, [open, query, muscle, equipment])

  if (!open) return null

  const close = () => {
    setSelected([])
    setQuery('')
    onClose()
  }
  const done = (asSuperset: boolean) => {
    onSelect(selected, asSuperset)
    close()
  }
  const toggle = (id: number) => {
    if (single) {
      onSelect([id], false)
      close()
      return
    }
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]))
  }

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-app pt-[env(safe-area-inset-top)]">
      <div className="flex items-center gap-2 px-4 py-3">
        <button onClick={close} aria-label="Close" className="p-1 text-muted">
          <X size={22} />
        </button>
        <div className="flex flex-1 items-center gap-2 rounded-lg bg-raised px-3 py-2">
          <Search size={18} className="text-subtle" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={title ?? 'Search exercises'}
            className="flex-1 bg-transparent outline-none placeholder:text-subtle"
          />
        </div>
      </div>
      <Chips options={MUSCLES} value={muscle} onChange={setMuscle} />
      <Chips options={EQUIPMENT} value={equipment} onChange={setEquipment} />

      <ul className="flex-1 overflow-y-auto">
        {results.map((e) => {
          const order = selected.indexOf(e.id)
          return (
            <li key={e.id}>
              <button
                onClick={() => toggle(e.id)}
                className="flex w-full items-center gap-3 border-b border-line px-4 py-3 text-left active:bg-surface"
              >
                <div className="flex-1">
                  <p className={order >= 0 ? 'text-accent-ink' : ''}>{e.name}</p>
                  <p className="text-xs text-subtle">
                    {label(e.primaryMuscles.join(', '))} · {label(e.equipment)}
                  </p>
                </div>
                {order >= 0 && (
                  <span className="flex size-6 items-center justify-center rounded-full bg-accent text-xs font-semibold text-on-accent">
                    {selected.length > 1 ? order + 1 : <Check size={14} />}
                  </span>
                )}
              </button>
            </li>
          )
        })}
        {results.length === 0 && <li className="p-6 text-center text-subtle">No exercises found</li>}
      </ul>

      {selected.length > 0 && (
        <div className="flex gap-2 border-t border-line p-3 pb-[max(env(safe-area-inset-bottom),0.75rem)]">
          {allowSuperset && selected.length > 1 && (
            <button onClick={() => done(true)} className="flex-1 rounded-lg bg-raised py-3 font-medium">
              Add as superset
            </button>
          )}
          <button onClick={() => done(false)} className="flex-1 rounded-lg bg-accent py-3 font-medium text-on-accent">
            Add {selected.length}
          </button>
        </div>
      )}
    </div>
  )
}
