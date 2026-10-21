import { Heart, HeartOff } from 'lucide-react'
import { ensureBluetooth } from '../../ble/scan'
import { hrZone } from '../../domain/heartRate'
import { useHeartRate } from '../../store/heartRate'
import { useMaxHr } from './useMaxHr'

// Live heart rate for the workout header. Tap to reconnect when dropped.
export function HrBadge() {
  const { device, state, bpm } = useHeartRate()
  const maxHr = useMaxHr()
  if (!device) return null

  if (state !== 'connected' || bpm === null) {
    return (
      <button
        onClick={() => void ensureBluetooth().then(() => useHeartRate.getState().connect())}
        aria-label="Reconnect heart rate monitor"
        className="flex items-center gap-1 rounded-md bg-raised px-2 py-1 text-xs text-muted"
      >
        {state === 'connecting' ? <Heart size={14} className="animate-pulse" /> : <HeartOff size={14} />}
        {state === 'connecting' ? '…' : 'HR'}
      </button>
    )
  }

  return (
    <span className="flex items-center gap-1 rounded-md bg-raised px-2 py-1 text-sm tabular-nums" aria-label={`Heart rate ${bpm}`}>
      <Heart size={14} className="fill-red-500 text-red-500" />
      {bpm}
      <span className="text-xs text-muted">Z{hrZone(bpm, maxHr)}</span>
    </span>
  )
}
