import { ChevronLeft, Plus, Search } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { getDb } from '../../db/client'
import { searchExercises, type Exercise } from '../../db/repos/exercises'
import { EQUIPMENT, MUSCLES, type Equipment, type Muscle } from '../../domain/exerciseCatalog'
import { label } from '../../lib/format'

export function ExerciseLibrary() {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [muscle, setMuscle] = useState<Muscle | ''>('')
  const [equipment, setEquipment] = useState<Equipment | ''>('')
  const [results, setResults] = useState<Exercise[]>([])

  useEffect(() => {
    let cancelled = false
    const t = setTimeout(async () => {
      const rows = await searchExercises(await getDb(), {
        query,
        muscle: muscle || undefined,
        equipment: equipment || undefined,
      })
      if (!cancelled) setResults(rows)
    }, 120)
    return () => {
      cancelled = true
      clearTimeout(t)
    }
  }, [query, muscle, equipment])

  const select = 'flex-1 rounded-md bg-raised px-2 py-2 text-sm outline-none'

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center gap-2 border-b border-line px-3 py-3">
        <button onClick={() => navigate(-1)} aria-label="Back" className="p-1 text-muted">
          <ChevronLeft size={24} />
        </button>
        <h1 className="flex-1 font-semibold">Exercises</h1>
        <Link to="/exercises/new" className="flex items-center gap-1 text-sm text-accent-ink">
          <Plus size={16} /> Custom
        </Link>
      </header>
      <div className="space-y-2 p-3">
        <div className="flex items-center gap-2 rounded-lg bg-raised px-3 py-2">
          <Search size={18} className="text-subtle" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`Search exercises`}
            className="flex-1 bg-transparent outline-none placeholder:text-subtle"
          />
        </div>
        <div className="flex gap-2">
          <select value={muscle} onChange={(e) => setMuscle(e.target.value as Muscle | '')} className={select}>
            <option value="">All muscles</option>
            {MUSCLES.map((m) => (
              <option key={m} value={m}>
                {label(m)}
              </option>
            ))}
          </select>
          <select value={equipment} onChange={(e) => setEquipment(e.target.value as Equipment | '')} className={select}>
            <option value="">All equipment</option>
            {EQUIPMENT.map((m) => (
              <option key={m} value={m}>
                {label(m)}
              </option>
            ))}
          </select>
        </div>
      </div>
      <ul className="flex-1 overflow-y-auto">
        {results.map((e) => (
          <li key={e.id}>
            <Link to={`/exercises/${e.id}`} className="block border-b border-line px-4 py-3 active:bg-surface">
              <p>
                {e.name}
                {e.isCustom && <span className="ml-2 rounded bg-raised px-1.5 py-0.5 text-xs text-muted">Custom</span>}
              </p>
              <p className="text-xs text-subtle">
                {label(e.primaryMuscles.join(', '))} · {label(e.equipment)}
              </p>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
