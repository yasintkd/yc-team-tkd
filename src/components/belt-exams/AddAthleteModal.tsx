import { useEffect, useState, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import { getPossibleTargetBelts } from '../../lib/belts'
import { X } from 'lucide-react'

type Props = {
  examId: string
  existingAthleteIds: string[]
  onAdd: () => Promise<void>
  onClose: () => void
}

export default function AddAthleteModal({ examId, existingAthleteIds, onAdd, onClose }: Props) {
  const [athletes, setAthletes] = useState<{ id: string; first_name: string; last_name: string; belt: string }[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState<Set<string>>(new Set())
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from('athletes')
        .select('id, first_name, last_name, belt')
        .eq('is_active', true)
        .order('first_name')
      setAthletes((data ?? []) as any[])
      setLoading(false)
    }
    void load()
  }, [])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose])

  const filtered = athletes.filter((a) => {
    if (existingAthleteIds.includes(a.id)) return false
    if (getPossibleTargetBelts(a.belt).length === 0) return false
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return `${a.first_name} ${a.last_name}`.toLowerCase().includes(q)
  }).slice(0, 20)

  const add = async (athlete: typeof athletes[0]) => {
    setAdding((prev) => new Set(prev).add(athlete.id))
    const targets = getPossibleTargetBelts(athlete.belt)
    await supabase.from('belt_exam_participants').insert({
      exam_id: examId,
      athlete_id: athlete.id,
      belt_before: athlete.belt,
      target_belt: targets[0],
    })
    await onAdd()
    setAdding((prev) => { const next = new Set(prev); next.delete(athlete.id); return next })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div ref={ref} className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
        <div className="flex items-center justify-between border-b border-app-border/40 pb-3">
          <h3 className="text-sm font-semibold">Sporcu Ekle</h3>
          <button type="button" onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-xl border border-app-border text-slate-500 hover:bg-app-bg-soft">
            <X className="h-4 w-4" />
          </button>
        </div>

        <input className="input-field mt-3 text-sm" placeholder="Sporcu ara..." value={search}
          onChange={(e) => setSearch(e.target.value)} autoFocus />

        {loading ? (
          <div className="mt-3 space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-10 animate-pulse rounded-lg bg-slate-100" />
            ))}
          </div>
        ) : (
          <ul className="mt-3 max-h-64 space-y-1 overflow-y-auto">
            {filtered.map((a) => (
              <li key={a.id}>
                <button type="button" disabled={adding.has(a.id)} onClick={() => void add(a)}
                  className="w-full rounded-lg px-3 py-2 text-left text-xs hover:bg-brand-red/5 transition disabled:opacity-40">
                  <span className="font-medium text-slate-800">{a.first_name} {a.last_name}</span>
                  <span className="ml-2 text-brand-muted">{a.belt}</span>
                </button>
              </li>
            ))}
            {filtered.length === 0 && (
              <p className="py-4 text-center text-xs text-brand-muted">Eklenecek sporcu bulunamadı.</p>
            )}
          </ul>
        )}
      </div>
    </div>
  )
}