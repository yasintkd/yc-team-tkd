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

/**
 * Kuşak adını normalize eder: "Kuşak" kelimesini kaldırır, 
 * case-insensitive, Türkçe karakter normalize, fazla boşlukları temizler.
 */
function normalizeBelt(s: string): string {
  return s
    .toLowerCase()
    .replace('kuşak', '')
    .replace('kusak', '')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Verilen kuşak değerine en yakın BELTS indeksini bulur.
 * - Önce birebir eşleşme dener
 * - Olmazsa normalize edilmiş eşleşme dener
 * - Hâlâ olmazsa -1 döner
 */
export function findBeltIndex(belt: string): number {
  // 1) Birebir eşleşme
  const exact = BELTS.indexOf(belt.trim() as Belt)
  if (exact !== -1) return exact

  // 2) Normalize edilmiş eşleşme ("Kuşak" farkını kaldır)
  const normalized = normalizeBelt(belt)
  for (let i = 0; i < BELTS.length; i++) {
    if (normalizeBelt(BELTS[i]) === normalized) return i
  }

  return -1
}

/**
 * Sporcunun mevcut kuşağına göre geçebileceği hedef kuşakları döndürür.
 *
 * Kurallar:
 * - Beyaz → Sarı veya Sarı Yeşil (2 seçenek)
 * - Mavi Kırmızı → sadece Kırmızı (1 adım)
 * - Kırmızı Siyah (1. Gıp) ve üstü → sınava giremez (boş dizi)
 * - Diğer → BELTS sırasında 2 adım atla
 */
export function getPossibleTargetBelts(current: string): string[] {
  const index = findBeltIndex(current)
  if (index === -1) return []

  // Kırmızı Siyah (1. Gıp) ve üstü sınava giremez
  if (index >= 8) return []

  // Beyaz → 2 seçenek
  if (index === 0) return [BELTS[1], BELTS[2]]

  // Mavi Kırmızı → sadece Kırmızı
  if (index === 6) return [BELTS[7]]

  // Diğer: 2 adım atla
  const targetIdx = index + 2
  if (targetIdx >= BELTS.length) return []
  return [BELTS[targetIdx]]
}

/**
 * Debug: kuşak dağılımını göster (konsol)
 */
export function debugBeltDistribution(athletes: { belt: string }[]): void {
  const counts = new Map<string, number>()
  for (const a of athletes) {
    counts.set(a.belt, (counts.get(a.belt) ?? 0) + 1)
  }
  console.table(
    [...counts.entries()]
      .map(([belt, count]) => ({
        Kuşak: belt,
        Adet: count,
        'BELTS\'te var': BELTS.includes(belt as Belt) ? '✅' : '❌',
        'Sınava girebilir': getPossibleTargetBelts(belt).length > 0 ? '✅' : '❌',
      })),
  )
}

/** Kuşak rengine göre badge/dot CSS sınıfları döndürür */
export function beltStyle(belt: string): { badge: string; dot: string } {
  const b = belt.toLowerCase()

  // ── Ara kuşaklar ──
  if ((b.includes('sarı') || b.includes('sari')) && b.includes('yeşil'))
    return {
      badge: 'bg-yellow-100 text-emerald-700 border border-emerald-400',
      dot:   'bg-yellow-400',
    }
  if (b.includes('yeşil') && b.includes('mavi'))
    return {
      badge: 'bg-emerald-100 text-blue-700 border border-blue-400',
      dot:   'bg-emerald-500',
    }
  if (b.includes('mavi') && (b.includes('kırmızı') || b.includes('kirmizi')))
    return {
      badge: 'bg-blue-100 text-red-700 border border-red-400',
      dot:   'bg-blue-500',
    }
  if ((b.includes('kırmızı') || b.includes('kirmizi')) && b.includes('siyah'))
    return {
      badge: 'bg-red-100 text-slate-900 border border-slate-700',
      dot:   'bg-red-500',
    }

  // ── Ana kuşaklar ──
  if (b.includes('beyaz'))
    return {
      badge: 'bg-white text-slate-600 border border-slate-300 shadow-sm',
      dot:   'bg-slate-300',
    }
  if (b.includes('sarı') || b.includes('sari'))
    return {
      badge: 'bg-yellow-100 text-yellow-800 border border-yellow-300',
      dot:   'bg-yellow-400',
    }
  if (b.includes('yeşil'))
    return {
      badge: 'bg-emerald-100 text-emerald-800 border border-emerald-300',
      dot:   'bg-emerald-500',
    }
  if (b.includes('mavi'))
    return {
      badge: 'bg-blue-100 text-blue-800 border border-blue-300',
      dot:   'bg-blue-500',
    }
  if (b.includes('kırmızı') || b.includes('kirmizi'))
    return {
      badge: 'bg-red-100 text-red-800 border border-red-300',
      dot:   'bg-red-500',
    }
  if (b.includes('siyah'))
    return {
      badge: 'bg-slate-900 text-white border border-slate-700',
      dot:   'bg-white/80',
    }

  return {
    badge: 'bg-slate-100 text-slate-700 border border-slate-200',
    dot:   'bg-slate-400',
  }
}
