import { useEffect, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { ShieldAlert, ShieldCheck, ArrowLeft, Check } from 'lucide-react'
import { supabase } from '../lib/supabase'
import BeltBadge from '../components/BeltBadge'
import LoadingSkeleton from '../components/LoadingSkeleton'
import type { AthleteLicenseRow } from '../lib/database.types'

type AthleteWithLicense = {
  id: string
  first_name: string
  last_name: string
  belt: string
  gender: string | null
  birth_date: string | null
  training_groups: { name: string } | { name: string }[] | null
  licenses: AthleteLicenseRow[]
}

const CURRENT_YEAR = new Date().getFullYear()

function groupName(a: AthleteWithLicense): string {
  const g = Array.isArray(a.training_groups) ? a.training_groups[0] : a.training_groups
  return g?.name ?? '—'
}

export default function UnlicensedAthletes() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [athletes, setAthletes] = useState<AthleteWithLicense[]>([])
  const [vizing, setVizing] = useState<Set<string>>(new Set())

  const load = async () => {
    setLoading(true)
    // Tüm aktif sporcuları çek
    const { data: athletesData } = await supabase
      .from('athletes')
      .select('id, first_name, last_name, belt, gender, birth_date, training_groups ( name )')
      .eq('is_active', true)
      .order('first_name')

    if (!athletesData) {
      setLoading(false)
      return
    }

    const athleteIds = athletesData.map((a: any) => a.id)

    // Bu yıla ait lisans kayıtlarını çek
    const { data: licenseData } = await supabase
      .from('athlete_licenses')
      .select('id, athlete_id, year')
      .in('athlete_id', athleteIds)
      .eq('year', CURRENT_YEAR)

    const licensedIds = new Set((licenseData ?? []).map((l: any) => l.athlete_id))

    const result: AthleteWithLicense[] = []
    for (const a of athletesData as any[]) {
      if (!licensedIds.has(a.id)) {
        result.push({
          id: a.id,
          first_name: a.first_name,
          last_name: a.last_name,
          belt: a.belt,
          gender: a.gender,
          birth_date: a.birth_date,
          training_groups: a.training_groups,
          licenses: [],
        })
      }
    }

    setAthletes(result)
    setLoading(false)
  }

  useEffect(() => { void load() }, [])

  const handleVizele = async (athleteId: string) => {
    setVizing((prev) => new Set(prev).add(athleteId))
    const { error } = await supabase
      .from('athlete_licenses')
      .insert({ athlete_id: athleteId, year: CURRENT_YEAR })
    if (!error) {
      setAthletes((prev) => prev.filter((a) => a.id !== athleteId))
    }
    setVizing((prev) => {
      const next = new Set(prev)
      next.delete(athleteId)
      return next
    })
  }

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Başlık */}
      <section className="glass-panel rounded-2xl p-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="rounded-lg border border-app-border p-2 text-slate-500 hover:bg-app-bg-soft"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <h2 className="text-sm font-semibold">Vizesiz Sporcular</h2>
            <p className="mt-0.5 text-xs text-brand-muted">
              {CURRENT_YEAR} yılı için lisans vizesi bulunmayan sporcular
            </p>
          </div>
        </div>
        {athletes.length > 0 && (
          <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            <span className="font-semibold">{athletes.length}</span> sporcunun bu yıl lisans vizesi yok.
            Etkinliklere katılabilmeleri için vizelemeleri gerekiyor.
          </div>
        )}
      </section>

      {/* Liste */}
      {loading ? (
        <LoadingSkeleton variant="table-row" count={8} />
      ) : athletes.length === 0 ? (
        <section className="glass-panel flex flex-col items-center gap-2 rounded-2xl py-12 text-center">
          <ShieldCheck className="h-8 w-8 text-emerald-400" />
          <p className="text-sm font-medium text-slate-600">
            Tüm sporcuların {CURRENT_YEAR} yılı vizesi tamam.
          </p>
        </section>
      ) : (
        <>
          {/* Mobil kart */}
          <ul className="space-y-2 md:hidden">
            {athletes.map((a) => (
              <li key={a.id} className="glass-panel rounded-xl p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <Link
                      to={`/sporcular/${a.id}`}
                      className="text-sm font-semibold text-slate-800 hover:text-brand-red transition"
                    >
                      {a.first_name} {a.last_name}
                    </Link>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      <BeltBadge belt={a.belt} size="sm" />
                      <span className="text-[11px] text-brand-muted">{groupName(a)}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] font-medium text-amber-700">
                    <ShieldAlert className="h-3 w-3" />
                    Vizesiz
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => void handleVizele(a.id)}
                  disabled={vizing.has(a.id)}
                  className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
                >
                  <Check className="h-3.5 w-3.5" />
                  {vizing.has(a.id) ? 'Vizeleniyor...' : 'Vizele'}
                </button>
              </li>
            ))}
          </ul>

          {/* Masaüstü tablo */}
          <div className="glass-panel hidden overflow-x-auto rounded-2xl md:block">
            <table className="w-full min-w-[600px] text-left text-xs">
              <thead className="border-b border-app-border bg-app-bg-soft/60">
                <tr>
                  <th className="px-4 py-3 font-semibold text-slate-500">Sporcu</th>
                  <th className="px-4 py-3 font-semibold text-slate-500">Kuşak</th>
                  <th className="px-4 py-3 font-semibold text-slate-500">Grup</th>
                  <th className="px-4 py-3 font-semibold text-slate-500">Durum</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-app-border">
                {athletes.map((a) => (
                  <tr key={a.id} className="transition hover:bg-app-bg-soft/60">
                    <td className="px-4 py-3 font-medium text-slate-800">
                      <Link to={`/sporcular/${a.id}`} className="hover:text-brand-red transition">
                        {a.first_name} {a.last_name}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <BeltBadge belt={a.belt} size="sm" />
                    </td>
                    <td className="px-4 py-3 text-slate-600">{groupName(a)}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700">
                        <ShieldAlert className="h-3 w-3" />
                        Vizesiz
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => void handleVizele(a.id)}
                        disabled={vizing.has(a.id)}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
                      >
                        <Check className="h-3 w-3" />
                        {vizing.has(a.id) ? 'Vizeleniyor...' : 'Vizele'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}