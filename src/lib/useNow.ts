import { useEffect, useState } from 'react'

// Re-renders every `intervalMs` with the current time. Timers derive what they
// show from timestamps, so throttled intervals only delay a repaint.
export function useNow(intervalMs = 1000, enabled = true): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!enabled) return
    const id = setInterval(() => setNow(Date.now()), intervalMs)
    return () => clearInterval(id)
  }, [intervalMs, enabled])
  return now
}
