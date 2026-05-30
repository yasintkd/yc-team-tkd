/** Pazartesi = 1 … Pazar = 7 (ISO 8601) */
export const WEEKDAYS = [
  { value: 1, label: 'Pazartesi' },
  { value: 2, label: 'Salı' },
  { value: 3, label: 'Çarşamba' },
  { value: 4, label: 'Perşembe' },
  { value: 5, label: 'Cuma' },
  { value: 6, label: 'Cumartesi' },
  { value: 7, label: 'Pazar' },
] as const

export function weekdayLabel(day: number) {
  return WEEKDAYS.find((d) => d.value === day)?.label ?? `Gün ${day}`
}

export function formatTime(t: string) {
  return t.slice(0, 5)
}

export function todayIsoWeekday(): number {
  const d = new Date().getDay()
  return d === 0 ? 7 : d
}
