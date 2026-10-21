export type WeightUnit = 'kg' | 'lb'

const LB_PER_KG = 2.2046226218

export function toDisplayWeight(kg: number, unit: WeightUnit): number {
  const v = unit === 'kg' ? kg : kg * LB_PER_KG
  return Math.round(v * 10) / 10
}

export function fromDisplayWeight(value: number, unit: WeightUnit): number {
  return unit === 'kg' ? value : value / LB_PER_KG
}

export function formatWeight(kg: number | null, unit: WeightUnit): string {
  if (kg === null) return '–'
  return `${toDisplayWeight(kg, unit)} ${unit}`
}

// Large totals (e.g. weekly volume) without decimals and with separators.
export function formatVolume(kg: number, unit: WeightUnit): string {
  return `${Math.round(unit === 'kg' ? kg : kg * LB_PER_KG).toLocaleString()} ${unit}`
}
