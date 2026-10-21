import { useState } from 'react'
import { ageOn } from '../../domain/calories'
import { maxHeartRate } from '../../domain/heartRate'
import { useProfile } from '../../store/profile'

export function useMaxHr(): number {
  const profile = useProfile((s) => s.profile)
  const [today] = useState(() => new Date())
  return maxHeartRate(profile?.maxHrOverride ?? null, profile?.dob ? ageOn(profile.dob, today) : null)
}
