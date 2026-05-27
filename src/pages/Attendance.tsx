import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'

type AttendanceStatus = 'geldi' | 'gelmedi'

type AthleteLite = {
  id: string
  first_name: string
  last_name: string
  belt: string
  is_active: boolean
}

type AttendanceRow = {
  athlete_id: string
  name: string
  belt: string
  group: string
  status: AttendanceStatus
  record_id?: string
}

function todayIsoDate() {
  const d = new Date()
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

const defaultGroup = 'Genel'

export default function Attendance() {
  const today = useMemo(() => todayIsoDate(), [])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [rows, setRows] = useState<AttendanceRow[]>([])

  const load = async () => {
    setLoading(true)
    setError(null)

    const { data: athletes, error: aErr } = await supabase
      .from('athletes')
      .select('id, first_name, last_name, belt, is_active')
      .eq('is_active', true)
      .order('last_name', { ascending: true })

    if (aErr) {
      setError(aErr.message)
      setRows([])
      setLoading(false)
      return
    }

    const { data: attendance, error: attErr } = await supabase
      .from('attendance_records')
      .select('id, athlete_id, training_group, status')
      .eq('session_date', today)
      .eq('training_group', defaultGroup)

    if (attErr) {
      setError(attErr.message)
      setRows([])
      setLoading(false)
      return
    }

    const map = new Map<
      string,
      { id: string; status: AttendanceStatus; training_group: string | null }
    >()
    for (const r of (attendance ?? []) as Array<{
      id: string
      athlete_id: string
      training_group: string | null
      status: AttendanceStatus
    }>) {
      map.set(r.athlete_id, r)
    }

    const merged = ((athletes ?? []) as AthleteLite[]).map((a) => {
      const existing = map.get(a.id)
      return {
        athlete_id: a.id,
        name: `${a.first_name} ${a.last_name}`,
        belt: a.belt,
        group: defaultGroup,
        status: existing?.status ?? 'gelmedi',
        record_id: existing?.id,
      } satisfies AttendanceRow
    })

    setRows(merged)
    setLoading(false)
  }

  useEffect(() => {
    void load()
  }, [])

  const setStatusLocal = (athleteId: string, status: AttendanceStatus) => {
    setRows((prev) =>
      prev.map((row) =>
        row.athlete_id === athleteId ? { ...row, status } : row,
      ),
    )
  }

  const saveAll = async () => {
    setSaving(true)
    setError(null)

    const payload = rows.map((r) => ({
      athlete_id: r.athlete_id,
      session_date: today,
      training_group: defaultGroup,
      status: r.status,
    }))

    const { error: upErr } = await supabase
      .from('attendance_records')
      .upsert(payload, { onConflict: 'athlete_id,session_date,training_group' })

    if (upErr) {
      setError(upErr.message)
      setSaving(false)
      return
    }

    await load()
    setSaving(false)
  }

  return (
    <div className="space-y-6">
      <section className="glass-panel rounded-2xl p-4">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold">Bugün Yoklama</h2>
            <p className="text-xs text-slate-500">
              Günlük antrenmana gelen öğrencileri işaretleyin.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void saveAll()}
            disabled={saving || loading}
            className="rounded-lg bg-emerald-500 px-4 py-2 text-xs font-semibold text-slate-950 hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? 'Kaydediliyor...' : 'Yoklamayı Kaydet'}
          </button>
        </div>

        <div className="mt-2 text-[11px] text-slate-500">
          Tarih: {new Date(today).toLocaleDateString('tr-TR')} • Grup:{' '}
          {defaultGroup}
        </div>

        {error && (
          <div className="mt-3 rounded-xl border border-rose-900/40 bg-rose-950/40 px-3 py-2 text-xs text-rose-200">
            {error}
          </div>
        )}

        <div className="mt-4 overflow-hidden rounded-xl border border-slate-800/80 bg-slate-900/60">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-900/80 text-slate-400">
              <tr>
                <th className="px-3 py-2">Sporcu</th>
                <th className="px-3 py-2">Kuşak</th>
                <th className="px-3 py-2">Grup</th>
                <th className="px-3 py-2">Durum</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr className="border-t border-slate-800/80">
                  <td className="px-3 py-4 text-slate-400" colSpan={4}>
                    Yükleniyor...
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr className="border-t border-slate-800/80">
                  <td className="px-3 py-4 text-slate-400" colSpan={4}>
                    Aktif sporcu bulunamadı.
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr
                    key={row.athlete_id}
                    className="border-t border-slate-800/80"
                  >
                    <td className="px-3 py-2">{row.name}</td>
                    <td className="px-3 py-2">{row.belt}</td>
                    <td className="px-3 py-2">{row.group}</td>
                    <td className="px-3 py-2">
                      <div className="inline-flex gap-1 rounded-full bg-slate-900 px-1 py-0.5">
                        <button
                          type="button"
                          onClick={() => setStatusLocal(row.athlete_id, 'geldi')}
                          className={`rounded-full px-2 py-0.5 text-[11px] ${
                            row.status === 'geldi'
                              ? 'bg-emerald-500 text-slate-950'
                              : 'text-slate-400 hover:bg-slate-800'
                          }`}
                        >
                          Geldi
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setStatusLocal(row.athlete_id, 'gelmedi')
                          }
                          className={`rounded-full px-2 py-0.5 text-[11px] ${
                            row.status === 'gelmedi'
                              ? 'bg-rose-500 text-slate-950'
                              : 'text-slate-400 hover:bg-slate-800'
                          }`}
                        >
                          Gelmedi
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
