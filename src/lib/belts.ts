/** WTF kuşak sırası (yükseltme için) */
export const BELTS = [
  'Beyaz Kuşak (10. Gıp)',
  'Sarı Kuşak (8. Gıp)',
  'Sarı Yeşil Kuşak (7. Gıp)',
  'Yeşil Kuşak (6. Gıp)',
  'Yeşil Mavi Kuşak (5. Gıp)',
  'Mavi Kuşak (4. Gıp)',
  'Mavi Kırmızı Kuşak (3. Gıp)',
  'Kırmızı Kuşak (2. Gıp)',
  'Kırmızı Siyah Kuşak (1. Gıp)',
  'Kırmızı Siyah Kuşak (1. Pum)',
  'Kırmızı Siyah Kuşak (2. Pum)',
  'Kırmızı Siyah (3. Pum)',
  'Siyah Kuşak',
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
