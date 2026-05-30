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
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-sm font-semibold">Bugün Yoklama</h2>
            <p className="text-xs text-brand-muted">
              Günlük antrenmana gelen öğrencileri işaretleyin.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void saveAll()}
            disabled={saving || loading}
            className="btn-primary w-full shrink-0 text-xs sm:w-auto"
          >
            {saving ? 'Kaydediliyor...' : 'Yoklamayı Kaydet'}
          </button>
        </div>

        <div className="mt-2 text-[11px] text-brand-muted">
          Tarih: {new Date(today).toLocaleDateString('tr-TR')} • Grup:{' '}
          {defaultGroup}
        </div>

        {error && (
          <div className="mt-3 rounded-xl border border-rose-900/40 bg-rose-950/40 px-3 py-2 text-xs text-rose-200">
            {error}
          </div>
        )}

        {loading ? (
          <p className="mt-4 text-xs text-brand-muted">Yükleniyor...</p>
        ) : rows.length === 0 ? (
          <p className="mt-4 text-xs text-brand-muted">Aktif sporcu bulunamadı.</p>
        ) : (
          <>
            <ul className="mt-4 space-y-2 md:hidden">
              {rows.map((row) => (
                <li
                  key={row.athlete_id}
                  className="rounded-xl border border-app-border bg-white p-3"
                >
                  <p className="text-sm font-medium">{row.name}</p>
                  <p className="mt-0.5 text-xs text-brand-muted">{row.belt}</p>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setStatusLocal(row.athlete_id, 'geldi')}
                      className={`min-h-[44px] rounded-xl text-sm font-medium transition active:scale-[0.98] ${
                        row.status === 'geldi'
                          ? 'bg-brand-cyan text-slate-950'
                          : 'border border-app-border bg-white text-slate-500'
                      }`}
                    >
                      Geldi
                    </button>
                    <button
                      type="button"
                      onClick={() => setStatusLocal(row.athlete_id, 'gelmedi')}
                      className={`min-h-[44px] rounded-xl text-sm font-medium transition active:scale-[0.98] ${
                        row.status === 'gelmedi'
                          ? 'bg-brand-red text-white'
                          : 'border border-app-border bg-white text-slate-500'
                      }`}
                    >
                      Gelmedi
                    </button>
                  </div>
                </li>
              ))}
            </ul>

            <div className="mt-4 hidden overflow-x-auto rounded-xl border border-app-border bg-white md:block">
              <table className="w-full min-w-[480px] text-left text-xs">
                <thead className="bg-app-bg-soft text-brand-muted">
                  <tr>
                    <th className="px-3 py-2">Sporcu</th>
                    <th className="px-3 py-2">Kuşak</th>
                    <th className="px-3 py-2">Grup</th>
                    <th className="px-3 py-2">Durum</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.athlete_id} className="border-t border-app-border">
                      <td className="px-3 py-2">{row.name}</td>
                      <td className="px-3 py-2">{row.belt}</td>
                      <td className="px-3 py-2">{row.group}</td>
                      <td className="px-3 py-2">
                        <div className="inline-flex gap-1 rounded-full bg-app-bg-soft p-0.5">
                          <button
                            type="button"
                            onClick={() => setStatusLocal(row.athlete_id, 'geldi')}
                            className={`rounded-full px-3 py-1 text-[11px] ${
                              row.status === 'geldi'
                                ? 'bg-brand-cyan text-slate-950'
                                : 'text-slate-500 hover:bg-white'
                            }`}
                          >
                            Geldi
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setStatusLocal(row.athlete_id, 'gelmedi')
                            }
                            className={`rounded-full px-3 py-1 text-[11px] ${
                              row.status === 'gelmedi'
                                ? 'bg-brand-red text-white'
                                : 'text-slate-500 hover:bg-white'
                            }`}
                          >
                            Gelmedi
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>
    </div>
  )
}
