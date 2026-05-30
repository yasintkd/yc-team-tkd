/** WTF kuşak sırası (yükseltme için) */
export const BELTS = [
  'Beyaz (10. Gıp)',
  'Sarı (9. Gıp)',
  'Yeşil (7–6. Gıp)',
  'Mavi (5–4. Gıp)',
  'Kırmızı (3–2. Gıp)',
  'Siyah (1. Dan+)',
] as const

export type Belt = (typeof BELTS)[number]

export function getNextBelt(current: string): string | null {
  const index = BELTS.indexOf(current as Belt)
  if (index === -1 || index >= BELTS.length - 1) return null
  return BELTS[index + 1]
}

export function beltLabel(belt: string) {
  return belt
}
