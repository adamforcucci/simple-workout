import { useState } from 'react'

interface Props {
  value: number | null
  onChange: (value: number | null) => void
  placeholder?: string
  decimal?: boolean
  className?: string
  'aria-label'?: string
}

const show = (v: number | null) => (v === null ? '' : String(v))

// Keeps the raw text while typing so "62." or "" survive, and only reports
// parsed numbers upward.
export function NumberField({ value, onChange, placeholder, decimal = false, className = '', ...rest }: Props) {
  const [text, setText] = useState(show(value))
  const [focused, setFocused] = useState(false)
  const [lastValue, setLastValue] = useState(value)

  // Follow external changes (e.g. auto-fill on tick) while not editing.
  if (value !== lastValue) {
    setLastValue(value)
    if (!focused) setText(show(value))
  }

  return (
    <input
      type="text"
      inputMode={decimal ? 'decimal' : 'numeric'}
      enterKeyHint="done"
      value={text}
      placeholder={placeholder}
      aria-label={rest['aria-label']}
      onFocus={(e) => {
        setFocused(true)
        e.currentTarget.select()
      }}
      onBlur={() => {
        setFocused(false)
        setText(show(value))
      }}
      onChange={(e) => {
        const t = e.target.value.replace(',', '.')
        if (!(decimal ? /^\d*\.?\d*$/ : /^\d*$/).test(t)) return
        setText(t)
        const n = t === '' || t === '.' ? null : Number(t)
        if (n === null || Number.isFinite(n)) onChange(n)
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur()
      }}
      className={`w-full rounded-md bg-raised px-2 py-1.5 text-center tabular-nums outline-none placeholder:text-subtle focus:ring-2 focus:ring-accent ${className}`}
    />
  )
}
