import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { weekdayLabel } from '../lib/days'
import { Calendar, Users, Save, Clock } from 'lucide-react'

type Group = { id: string; name: string }
type Schedule = { id: string; start_time: string; end_time: string; group_name: string }
type Athlete = { id: string; first_name: string; last_name: string; belt: string }

/** training_group sütununda saklanan bileşik değer — grup + saat ile aynı günde 2 seans ayırt edilir */
function trainingGroupValue(groupName: string, startTime: string): string {
  return `${groupName} — ${startTime}`
}

export default function AttendancePage() {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [groups, setGroups] = useState<Group[]>([])
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [athletes, setAthletes] = useState<Athlete[]>([])

  const [selectedGroupId, setSelectedGroupId] = useState('')
  const [selectedScheduleIdx, setSelectedScheduleIdx] = useState<number | null>(null)
  const [attendance, setAttendance] = useState<Map<string, 'geldi' | 'gelmedi'>>(new Map())
  const [recordIds, setRecordIds] = useState<Map<string, string>>(new Map())

  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  // Seçilen günün ISO hafta günü (Pzt=1 … Pazar=7)
  const dayOfWeek = useMemo(() => {
    const d = new Date(date + 'T12:00:00')
    const dow = d.getDay()
    return dow === 0 ? 7 : dow
  }, [date])

  // ── İlk yükleme: gruplar ──
  useEffect(() => {
    supabase
      .from('training_groups')
      .select('id, name')
      .eq('is_active', true)
      .order('name')
      .then(({ data }) => setGroups((data ?? []) as Group[]))
  }, [])

  // ── Grup değişince o güne ait programları yükle ──
  useEffect(() => {
    setSchedules([])
    setSelectedScheduleIdx(null)
    setAthletes([])
    setAttendance(new Map())
    setRecordIds(new Map())

    if (!selectedGroupId) return

    supabase
      .from('group_schedules')
      .select('id, start_time, end_time, training_groups!inner(name)')
      .eq('group_id', selectedGroupId)
      .eq('day_of_week', dayOfWeek)
      .order('start_time')
      .then(({ data }) => {
        const rows = (data ?? []) as Array<{
          id: string
          start_time: string
          end_time: string
          training_groups: { name: string } | { name: string }[] | null
        }>
        const group = groups.find((g) => g.id === selectedGroupId)
        const groupName = group?.name ?? ''
        const list: Schedule[] = rows.map((r) => {
          const g = Array.isArray(r.training_groups)
            ? r.training_groups[0]
            : r.training_groups
          return {
            id: r.id,
            start_time: r.start_time,
            end_time: r.end_time,
            group_name: g?.name ?? groupName,
          }
        })
        setSchedules(list)
      })
  }, [selectedGroupId, dayOfWeek])

  // ── Seans seçilince sporcuları & kayıtlı yoklamayı yükle ──
  useEffect(() => {
    setAthletes([])
    setAttendance(new Map())
    setRecordIds(new Map())
    if (selectedScheduleIdx === null || !selectedGroupId) return

    const sched = schedules[selectedScheduleIdx]
    if (!sched) return

    const groupVal = trainingGroupValue(sched.group_name, sched.start_time)

    setLoading(true)
    setError(null)
    Promise.all([
      supabase
        .from('athletes')
        .select('id, first_name, last_name, belt')
        .eq('training_group_id', selectedGroupId)
        .eq('is_active', true)
        .order('first_name'),
      supabase
        .from('attendance_records')
        .select('id, athlete_id, status')
        .eq('session_date', date)
        .eq('training_group', groupVal),
    ]).then(([athletesRes, attRes]) => {
      if (athletesRes.error) { setError(athletesRes.error.message) }
      else if (attRes.error) { setError(attRes.error.message) }
      else {
        const list = (athletesRes.data ?? []) as Athlete[]
        setAthletes(list)

        const attMap = new Map<string, 'geldi' | 'gelmedi'>()
        const idMap = new Map<string, string>()
        for (const r of attRes.data ?? []) {
          attMap.set(r.athlete_id, r.status as 'geldi' | 'gelmedi')
          idMap.set(r.athlete_id, r.id)
        }
        for (const a of list) {
          if (!attMap.has(a.id)) attMap.set(a.id, 'gelmedi')
        }
        setAttendance(attMap)
        setRecordIds(idMap)
      }
      setLoading(false)
    })
  }, [selectedScheduleIdx, selectedGroupId, date])

  const setStatus = (athleteId: string, status: 'geldi' | 'gelmedi') => {
    setAttendance((prev) => {
      const next = new Map(prev)
      next.set(athleteId, status)
      return next
    })
  }

  const save = async () => {
    if (selectedScheduleIdx === null) return
    const sched = schedules[selectedScheduleIdx]
    if (!sched) return

    setSaving(true)
    setError(null)
    setMessage(null)

    const groupVal = trainingGroupValue(sched.group_name, sched.start_time)

    const ops: Promise<{ error: any }>[] = []
    for (const [athleteId, status] of attendance) {
      const existingId = recordIds.get(athleteId)
      if (existingId) {
        ops.push(
          supabase
            .from('attendance_records')
            .update({ status, training_group: groupVal })
            .eq('id', existingId) as any,
        )
      } else {
        ops.push(
          supabase
            .from('attendance_records')
            .insert({
              athlete_id: athleteId,
              session_date: date,
              training_group: groupVal,
              status,
            }) as any,
        )
      }
    }

    const results = await Promise.all(ops)
    const errors = results.filter((r) => r.error)
    if (errors.length > 0) {
      setError(errors.map((e) => e.error?.message).join(', '))
    } else {
      setMessage('Yoklama kaydedildi.')
      // Kaydedilen ID'leri güncelle
      const [attRes] = await Promise.all([
        supabase
          .from('attendance_records')
          .select('id, athlete_id, status')
          .eq('session_date', date)
          .eq('training_group', groupVal),
      ])
      if (!attRes.error) {
        const idMap = new Map<string, string>()
        for (const r of attRes.data ?? []) {
          idMap.set(r.athlete_id, r.id)
        }
        setRecordIds(idMap)
      }
    }
    setSaving(false)
  }

  const selectedSchedule = selectedScheduleIdx !== null ? schedules[selectedScheduleIdx] : null
  const presentCount = [...attendance.values()].filter((s) => s === 'geldi').length

  return (
    <div className="space-y-4 md:space-y-6">
      {/* ── Kontroller ── */}
      <section className="glass-panel rounded-2xl p-4">
        <div className="flex flex-col gap-1">
          <h2 className="text-sm font-semibold">Yoklama</h2>
          <p className="text-xs text-brand-muted">
            {weekdayLabel(dayOfWeek)} —{' '}
            {new Date(date + 'T12:00:00').toLocaleDateString('tr-TR')}
          </p>
        </div>

        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          {/* Tarih */}
          <div className="space-y-1 text-xs">
            <label className="font-medium text-slate-500">Tarih</label>
            <div className="flex items-center gap-2 rounded-lg border border-app-border bg-white px-3 focus-within:border-brand-cyan focus-within:ring-2 focus-within:ring-brand-cyan/25">
              <Calendar className="h-3.5 w-3.5 shrink-0 text-slate-400" />
              <input
                type="date"
                className="w-full bg-transparent py-2.5 text-sm text-slate-800 outline-none"
                value={date}
                onChange={(e) => {
                  setDate(e.target.value)
                  setSelectedScheduleIdx(null)
                }}
              />
            </div>
          </div>
          {/* Grup */}
          <div className="space-y-1 text-xs">
            <label className="font-medium text-slate-500">Antrenman Grubu</label>
            <select
              className="input-field text-sm"
              value={selectedGroupId}
              onChange={(e) => {
                setSelectedGroupId(e.target.value)
                setSelectedScheduleIdx(null)
              }}
            >
              <option value="">Grup seçin</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          </div>
          {/* Seans */}
          <div className="space-y-1 text-xs">
            <label className="font-medium text-slate-500">Seans</label>
            <div className="flex items-center gap-2 rounded-lg border border-app-border bg-white px-3 focus-within:border-brand-cyan focus-within:ring-2 focus-within:ring-brand-cyan/25">
              <Clock className="h-3.5 w-3.5 shrink-0 text-slate-400" />
              <select
                className="w-full bg-transparent py-2.5 text-sm text-slate-800 outline-none"
                value={selectedScheduleIdx ?? ''}
                onChange={(e) =>
                  setSelectedScheduleIdx(
                    e.target.value ? Number(e.target.value) : null,
                  )
                }
                disabled={!selectedGroupId}
              >
                <option value="">
                  {schedules.length === 0
                    ? 'Program yok'
                    : 'Seans seçin'}
                </option>
                {schedules.map((s, i) => (
                  <option key={s.id} value={i}>
                    {s.start_time.slice(0, 5)} – {s.end_time.slice(0, 5)}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {selectedSchedule && athletes.length > 0 && (
          <div className="mt-3 flex items-center gap-1.5 text-xs text-brand-muted">
            <Users className="h-3.5 w-3.5" />
            <span>
              Mevcut:{' '}
              <strong className="text-emerald-600">{presentCount}</strong> /{' '}
              <strong>{athletes.length}</strong> sporcu
            </span>
          </div>
        )}
      </section>

      {/* ── Mesajlar ── */}
      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
          {error}
        </div>
      )}
      {message && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
          {message}
        </div>
      )}

      {/* ── Yoklama listesi ── */}
      {!selectedSchedule ? (
        <div className="glass-panel flex flex-col items-center gap-2 rounded-2xl py-12 text-center">
          <Users className="h-8 w-8 text-slate-300" />
          <p className="text-sm font-medium text-slate-500">Seans seçin</p>
          <p className="text-xs text-brand-muted">
            Tarih, grup ve seans seçerek yoklama almaya başlayın.
          </p>
        </div>
      ) : loading ? (
        <p className="text-xs text-brand-muted">Yükleniyor...</p>
      ) : athletes.length === 0 ? (
        <div className="glass-panel flex flex-col items-center gap-2 rounded-2xl py-12 text-center">
          <Users className="h-8 w-8 text-slate-300" />
          <p className="text-sm font-medium text-slate-500">Sporcu bulunamadı</p>
          <p className="text-xs text-brand-muted">
            Bu grupta aktif sporcu yok.
          </p>
        </div>
      ) : (
        <>
          {/* Mobil: kart listesi */}
          <ul className="space-y-2 md:hidden">
            {athletes.map((a) => {
              const durum = attendance.get(a.id) ?? 'gelmedi'
              return (
                <li key={a.id}>
                  <div
                    className={`glass-panel rounded-xl p-3 transition ${
                      durum === 'geldi' ? 'border-emerald-300/60' : ''
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-slate-800">
                          {a.first_name} {a.last_name}
                        </p>
                        <p className="text-[11px] text-brand-muted">{a.belt}</p>
                      </div>
                      <div className="flex shrink-0 gap-1.5">
                        <button
                          type="button"
                          onClick={() => setStatus(a.id, 'geldi')}
                          className={`min-w-[68px] rounded-lg border px-3 py-1.5 text-xs font-medium transition active:scale-95 ${
                            durum === 'geldi'
                              ? 'border-emerald-300 bg-emerald-100 text-emerald-800'
                              : 'border-app-border bg-white text-slate-500 hover:bg-emerald-50'
                          }`}
                        >
                          Geldi
                        </button>
                        <button
                          type="button"
                          onClick={() => setStatus(a.id, 'gelmedi')}
                          className={`min-w-[68px] rounded-lg border px-3 py-1.5 text-xs font-medium transition active:scale-95 ${
                            durum === 'gelmedi'
                              ? 'border-rose-300 bg-rose-100 text-rose-800'
                              : 'border-app-border bg-white text-slate-500 hover:bg-rose-50'
                          }`}
                        >
                          Gelmedi
                        </button>
                      </div>
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>

          {/* Masaüstü: tablo */}
          <div className="glass-panel hidden overflow-hidden rounded-2xl md:block">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-app-border bg-app-bg-soft/60">
                <tr>
                  <th className="px-4 py-3 font-semibold text-slate-500">Sporcu</th>
                  <th className="px-4 py-3 font-semibold text-slate-500">Kuşak</th>
                  <th className="px-4 py-3 font-semibold text-slate-500">Durum</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-app-border">
                {athletes.map((a) => {
                  const durum = attendance.get(a.id) ?? 'gelmedi'
                  return (
                    <tr key={a.id} className="transition hover:bg-app-bg-soft/40">
                      <td className="px-4 py-3 font-medium text-slate-800">
                        {a.first_name} {a.last_name}
                      </td>
                      <td className="px-4 py-3 text-slate-600">{a.belt}</td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1.5">
                          <button
                            type="button"
                            onClick={() => setStatus(a.id, 'geldi')}
                            className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition active:scale-95 ${
                              durum === 'geldi'
                                ? 'border-emerald-300 bg-emerald-100 text-emerald-800'
                                : 'border-app-border bg-white text-slate-500 hover:bg-emerald-50'
                            }`}
                          >
                            Geldi
                          </button>
                          <button
                            type="button"
                            onClick={() => setStatus(a.id, 'gelmedi')}
                            className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition active:scale-95 ${
                              durum === 'gelmedi'
                                ? 'border-rose-300 bg-rose-100 text-rose-800'
                                : 'border-app-border bg-white text-slate-500 hover:bg-rose-50'
                            }`}
                          >
                            Gelmedi
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Kaydet */}
          <div className="flex justify-end">
            <button
              type="button"
              disabled={saving}
              onClick={() => void save()}
              className="btn-primary inline-flex items-center gap-1.5"
            >
              <Save className="h-3.5 w-3.5" />
              {saving ? 'Kaydediliyor...' : 'Yoklamayı Kaydet'}
            </button>
          </div>
        </>
      )}
    </div>
  )
}
