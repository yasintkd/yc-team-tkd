import { useEffect, useMemo, useState } from 'react'
import {
  Plus, X, Download, Trash2, ChevronDown, ChevronUp,
  Users, Calendar, AlertTriangle, UserPlus, UserMinus, Clock,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { weekdayLabel, formatTime } from '../lib/days'
import { downloadGroupListPdf } from '../lib/exportGroupPdf'
import LoadingSkeleton from '../components/LoadingSkeleton'
import ConfirmDialog from '../components/ConfirmDialog'
import BeltBadge from '../components/BeltBadge'

// ─── Types ────────────────────────────────────────────────────────────────────

type TrainingGroup = {
  id: string
  name: string
  notes: string | null
  is_active: boolean
}

type Schedule = {
  id: string
  group_id: string
  day_of_week: number
  start_time: string
  end_time: string
}

type AthleteLite = {
  id: string
  first_name: string
  last_name: string
  belt: string
  birth_date: string | null
  training_group_id: string | null
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const DAY_OPTIONS = [1, 2, 3, 4, 5, 6, 7]

const birthYear = (bd: string | null) => bd ? bd.slice(0, 4) : null
const age = (bd: string | null) => {
  if (!bd) return null
  const thisYear = new Date().getFullYear()
  const y = Number(bd.slice(0, 4))
  if (!y) return null
  const m = Number(bd.slice(5, 7))
  const d = Number(bd.slice(8, 10))
  const now = new Date()
  let a = thisYear - y
  if (now.getMonth() + 1 < m || (now.getMonth() + 1 === m && now.getDate() < d)) a--
  return a
}

export default function Groups() {
  // Data
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [groups, setGroups] = useState<TrainingGroup[]>([])
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [athletes, setAthletes] = useState<AthleteLite[]>([])
  const [saving, setSaving] = useState(false)
  const [exportingGroupId, setExportingGroupId] = useState<string | null>(null)
  const [removingAllAthletes, setRemovingAllAthletes] = useState(false)
  const [confirmDeleteGroup, setConfirmDeleteGroup] = useState<TrainingGroup | null>(null)
  const [confirmRemoveAllFromGroup, setConfirmRemoveAllFromGroup] = useState<TrainingGroup | null>(null)

  // Hangi grup kartı açık
  const [expandedGroupId, setExpandedGroupId] = useState<string | null>(null)

  // Modal state
  const [modal, setModal] = useState<
    | { type: 'newGroup' }
    | { type: 'addSchedule'; groupId: string; groupName: string }
    | null
  >(null)

  // Yeni grup formu
  const [groupName, setGroupName] = useState('')
  const [groupNotes, setGroupNotes] = useState('')

  // Program ekleme formu
  const [dayOfWeek, setDayOfWeek] = useState(1)
  const [startTime, setStartTime] = useState('17:00')
  const [endTime, setEndTime] = useState('18:00')

  // ── Load ────────────────────────────────────────────────────────────────────

  const load = async () => {
    setLoading(true)
    setError(null)
    const [gRes, sRes, aRes] = await Promise.all([
      supabase.from('training_groups').select('id, name, notes, is_active').order('name'),
      supabase.from('group_schedules').select('id, group_id, day_of_week, start_time, end_time'),
      supabase
        .from('athletes')
        .select('id, first_name, last_name, belt, birth_date, training_group_id')
        .eq('is_active', true)
        .order('first_name'),
    ])
    if (gRes.error) { setError(gRes.error.message); setLoading(false); return }
    setGroups((gRes.data ?? []) as TrainingGroup[])
    setSchedules((sRes.data ?? []) as Schedule[])
    setAthletes((aRes.data ?? []) as AthleteLite[])
    setLoading(false)
  }

  useEffect(() => { void load() }, [])

  // ── Derived ─────────────────────────────────────────────────────────────────

  const athletesByGroup = useMemo(() => {
    const map = new Map<string, AthleteLite[]>()
    for (const g of groups) map.set(g.id, [])
    for (const a of athletes) {
      if (a.training_group_id && map.has(a.training_group_id))
        map.get(a.training_group_id)!.push(a)
    }
    return map
  }, [groups, athletes])

  const schedulesByGroup = useMemo(() => {
    const map = new Map<string, Schedule[]>()
    for (const s of schedules) {
      const list = map.get(s.group_id) ?? []
      list.push(s)
      map.set(s.group_id, list)
    }
    for (const [, list] of map)
      list.sort((a, b) => a.day_of_week - b.day_of_week || a.start_time.localeCompare(b.start_time))
    return map
  }, [schedules])

  const ungroupedAthletes = useMemo(
    () => athletes.filter((a) => !a.training_group_id)
      .sort((a, b) => (a.first_name + ' ' + a.last_name).localeCompare(b.first_name + ' ' + b.last_name, 'tr')),
    [athletes],
  )

  // ── CRUD ────────────────────────────────────────────────────────────────────

  const createGroup = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!groupName.trim()) return
    setSaving(true)
    setError(null)
    const { error: insErr } = await supabase
      .from('training_groups')
      .insert({ name: groupName.trim(), notes: groupNotes.trim() || null })
    if (insErr) { setError(insErr.message) }
    else { setGroupName(''); setGroupNotes(''); setModal(null); await load() }
    setSaving(false)
  }

  const addSchedule = async (e: React.FormEvent) => {
    e.preventDefault()
    if (modal?.type !== 'addSchedule') return
    setSaving(true)
    setError(null)
    const { error: insErr } = await supabase
      .from('group_schedules')
      .insert({ group_id: modal.groupId, day_of_week: dayOfWeek, start_time: startTime, end_time: endTime })
    if (insErr) { setError(insErr.message) }
    else { setModal(null); await load() }
    setSaving(false)
  }

  const removeSchedule = async (id: string) => {
    setError(null)
    const { error: delErr } = await supabase.from('group_schedules').delete().eq('id', id)
    if (delErr) setError(delErr.message)
    else await load()
  }

  const assignAthlete = async (athleteId: string, groupId: string | null) => {
    setError(null)
    const { error: upErr } = await supabase
      .from('athletes').update({ training_group_id: groupId }).eq('id', athleteId)
    if (upErr) setError(upErr.message)
    else await load()
  }

  const removeGroup = async (group: TrainingGroup) => {
    setConfirmDeleteGroup(group)
  }

  const removeAllAthletesFromGroup = async (groupId: string) => {
    setRemovingAllAthletes(true)
    setError(null)
    const { error: upErr } = await supabase
      .from('athletes').update({ training_group_id: null }).eq('training_group_id', groupId)
    if (upErr) setError(upErr.message)
    else await load()
    setRemovingAllAthletes(false)
    setConfirmRemoveAllFromGroup(null)
  }

  const exportGroupPdf = async (group: TrainingGroup) => {
    setExportingGroupId(group.id)
    setError(null)
    try {
      const groupAthletes = [...(athletesByGroup.get(group.id) ?? [])].sort((a, b) =>
        (a.first_name + ' ' + a.last_name).localeCompare(b.first_name + ' ' + b.last_name, 'tr'),
      )
      const groupSchedules = (schedulesByGroup.get(group.id) ?? []).map((s) => ({
        dayLabel: weekdayLabel(s.day_of_week),
        timeRange: formatTime(s.start_time) + ' – ' + formatTime(s.end_time),
      }))
      await downloadGroupListPdf({
        groupName: group.name,
        groupNotes: group.notes,
        schedules: groupSchedules,
        athletes: groupAthletes.map((a) => ({ firstName: a.first_name, lastName: a.last_name })),
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'PDF oluşturulamadı.')
    } finally {
      setExportingGroupId(null)
    }
  }

  const closeModal = () => { setModal(null); setError(null) }
  const toggleExpand = (id: string) =>
    setExpandedGroupId((prev) => (prev === id ? null : id))

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4 md:space-y-5">

      {/* ── Üst başlık + buton ── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-sm font-semibold">Antrenman Grupları</h2>
          <p className="mt-0.5 text-xs text-brand-muted">
            {groups.length} grup · {athletes.filter((a) => a.training_group_id).length} atanmış sporcu
          </p>
        </div>
        <button
          type="button"
          onClick={() => { setGroupName(''); setGroupNotes(''); setModal({ type: 'newGroup' }) }}
          className="btn-primary inline-flex items-center gap-1.5"
        >
          <Plus className="h-3.5 w-3.5" />
          Yeni Grup
        </button>
      </div>

      {/* ── Global hata ── */}
      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
          {error}
        </div>
      )}

      {/* ── Grupsuz sporcu uyarısı ── */}
      {ungroupedAthletes.length > 0 && (
        <div className="glass-panel rounded-2xl border-l-4 border-l-amber-400 p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-amber-800">
                {ungroupedAthletes.length} sporcu henüz bir gruba atanmamış
              </p>
              <p className="mt-0.5 text-xs text-amber-700">
                Grupsuz sporcular yoklamada görünmez.
              </p>
              {/* Sporcu listesi + atama */}
              <ul className="mt-3 space-y-2">
                {ungroupedAthletes.map((a) => (
                  <li
                    key={a.id}
                    className="flex flex-col gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-xs font-medium text-slate-800">
                        {a.first_name} {a.last_name}
                      </span>
                      <BeltBadge belt={a.belt} size="sm" />
                      {birthYear(a.birth_date) && (
                        <span className="text-[11px] text-brand-muted">
                          {birthYear(a.birth_date)} · {age(a.birth_date)} yaş
                        </span>
                      )}
                    </div>
                    <select
                      className="input-field max-w-[200px] py-1.5 text-xs"
                      defaultValue=""
                      onChange={(e) => { if (e.target.value) void assignAthlete(a.id, e.target.value) }}
                    >
                      <option value="">Gruba ata...</option>
                      {groups.map((g) => (
                        <option key={g.id} value={g.id}>{g.name}</option>
                      ))}
                    </select>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* ── Grup kartları ── */}
      {loading ? (
        <LoadingSkeleton variant="card" count={3} />
      ) : groups.length === 0 ? (
        <div className="glass-panel flex flex-col items-center gap-2 rounded-2xl py-12 text-center">
          <Users className="h-8 w-8 text-slate-300" />
          <p className="text-sm font-medium text-slate-500">Henüz grup yok</p>
          <p className="text-xs text-brand-muted">Yeni Grup butonuyla başlayın.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {groups.map((g) => {
            const members = athletesByGroup.get(g.id) ?? []
            const scheds = schedulesByGroup.get(g.id) ?? []
            const isOpen = expandedGroupId === g.id

            return (
              <article key={g.id} className="glass-panel overflow-hidden rounded-2xl">

                {/* ── Kart başlığı (her zaman görünür) ── */}
                <button
                  type="button"
                  onClick={() => toggleExpand(g.id)}
                  className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition hover:bg-app-bg-soft/40"
                >
                  {/* Sol: isim & notlar */}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-800">{g.name}</p>
                    {g.notes && (
                      <p className="mt-0.5 truncate text-xs text-brand-muted">{g.notes}</p>
                    )}
                  </div>

                  {/* Özet rozetler */}
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="hidden items-center gap-1 rounded-full border border-app-border bg-white px-2.5 py-1 text-[11px] font-medium text-slate-600 sm:flex">
                      <Users className="h-3 w-3 text-brand-muted" />
                      {members.length} sporcu
                    </span>
                    <span className="hidden items-center gap-1 rounded-full border border-app-border bg-white px-2.5 py-1 text-[11px] font-medium text-slate-600 sm:flex">
                      <Clock className="h-3 w-3 text-brand-muted" />
                      {scheds.length > 0
                        ? scheds.map((s) => { return weekdayLabel(s.day_of_week) + ' ' + formatTime(s.start_time) }).join(', ')
                        : 'Program yok'}
                    </span>
                    {/* Mobil: sadece sayılar */}
                    <span className="flex items-center gap-1 text-[11px] text-brand-muted sm:hidden">
                      {members.length} sporcu · {scheds.length} seans
                    </span>
                    {isOpen
                      ? <ChevronUp className="h-4 w-4 shrink-0 text-slate-400" />
                      : <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" />}
                  </div>
                </button>

                {/* ── Detay paneli (açılır) ── */}
                {isOpen && (
                  <div className="border-t border-app-border px-4 pb-4 pt-4 space-y-5">

                    {/* Antrenman programı */}
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-semibold text-slate-600">Antrenman Programı</p>
                        <button
                          type="button"
                          onClick={() => {
                            setDayOfWeek(1); setStartTime('17:00'); setEndTime('18:00')
                            setModal({ type: 'addSchedule', groupId: g.id, groupName: g.name })
                          }}
                          className="inline-flex items-center gap-1 rounded-lg border border-app-border bg-white px-2.5 py-1 text-[11px] font-medium text-slate-600 hover:bg-app-bg-soft"
                        >
                          <Plus className="h-3 w-3" />
                          Seans Ekle
                        </button>
                      </div>

                      {scheds.length === 0 ? (
                        <p className="mt-2 text-xs text-brand-muted">Henüz program eklenmemiş.</p>
                      ) : (
                        <ul className="mt-2 space-y-1.5">
                          {scheds.map((s) => (
                            <li
                              key={s.id}
                              className="flex items-center justify-between rounded-xl border border-app-border bg-white px-3 py-2 text-xs"
                            >
                              <div className="flex items-center gap-2">
                                <Calendar className="h-3.5 w-3.5 shrink-0 text-brand-muted" />
                                <span className="font-medium text-slate-700">
                                  {weekdayLabel(s.day_of_week)}
                                </span>
                                <span className="text-brand-muted">
                                  {formatTime(s.start_time)} – {formatTime(s.end_time)}
                                </span>
                              </div>
                              <button
                                type="button"
                                onClick={() => void removeSchedule(s.id)}
                                className="rounded-md px-2 py-0.5 text-[11px] text-rose-500 hover:bg-rose-50 hover:text-rose-700"
                              >
                                Sil
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>

                    {/* Sporcular */}
                    <div>
                      <p className="text-xs font-semibold text-slate-600">
                        Sporcular ({members.length})
                      </p>
                      {members.length === 0 ? (
                        <p className="mt-2 text-xs text-brand-muted">
                          Bu grupta henüz sporcu yok.
                        </p>
                      ) : (
                        <ul className="mt-2 flex flex-wrap gap-1.5">
                          {members
                            .sort((a, b) =>
                              (a.first_name + ' ' + a.last_name).localeCompare(
                                b.first_name + ' ' + b.last_name, 'tr',
                              ),
                            )
                            .map((a) => (
                              <li
                                key={a.id}
                                className="flex items-center gap-1 rounded-full border border-app-border bg-white py-1 pl-2.5 pr-1 text-[11px]"
                              >
                                <div className="flex items-center gap-1.5">
                                  <span className="text-slate-700 text-[11px] font-medium">
                                    {a.first_name} {a.last_name}
                                  </span>
                                  <BeltBadge belt={a.belt} size="sm" />
                                  {birthYear(a.birth_date) && (
                                    <span className="text-[10px] text-brand-muted whitespace-nowrap">
                                      {birthYear(a.birth_date)} · {age(a.birth_date)} yaş
                                    </span>
                                  )}
                                </div>
                                <button
                                  type="button"
                                  onClick={() => void assignAthlete(a.id, null)}
                                  className="ml-0.5 flex h-4 w-4 items-center justify-center rounded-full text-slate-400 hover:bg-rose-100 hover:text-rose-600"
                                  title="Gruptan çıkar"
                                >
                                  <X className="h-3 w-3" />
                                </button>
                              </li>
                            ))}
                        </ul>
                      )}

                      {/* Bu gruba ata — sadece grupsuz sporcu varsa */}
                      {ungroupedAthletes.length > 0 && (
                        <div className="mt-3 flex items-center gap-2">
                          <UserPlus className="h-3.5 w-3.5 shrink-0 text-brand-muted" />
                          <select
                            className="input-field flex-1 py-1.5 text-xs"
                            defaultValue=""
                            key={members.length} // reset on change
                            onChange={(e) => {
                              if (e.target.value) void assignAthlete(e.target.value, g.id)
                            }}
                          >
                            <option value="">Bu gruba sporcu ekle...</option>
                            {ungroupedAthletes.map((a) => (
                              <option key={a.id} value={a.id}>
                                {a.first_name} {a.last_name} ({a.belt})
                              </option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>

                    {/* Alt aksiyonlar */}
                    <div className="flex flex-wrap items-center gap-2 border-t border-app-border pt-3">
                      <button
                        type="button"
                        disabled={saving || exportingGroupId === g.id}
                        onClick={() => void exportGroupPdf(g)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-app-border bg-white px-3 py-1.5 text-[11px] font-medium text-slate-700 hover:bg-app-bg-soft disabled:opacity-60"
                      >
                        <Download className="h-3.5 w-3.5" />
                        {exportingGroupId === g.id ? 'PDF hazırlanıyor...' : 'PDF İndir'}
                      </button>
                      <button
                        type="button"
                        disabled={removingAllAthletes || members.length === 0}
                        onClick={() => setConfirmRemoveAllFromGroup(g)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-[11px] font-medium text-amber-700 hover:bg-amber-100 disabled:opacity-60"
                      >
                        <UserMinus className="h-3.5 w-3.5" />
                        Tüm Öğrencileri Çıkar
                      </button>
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => void removeGroup(g)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-[11px] font-medium text-rose-700 hover:bg-rose-100 disabled:opacity-60"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Grubu Sil
                      </button>
                    </div>
                  </div>
                )}
              </article>
            )
          })}
        </div>
      )}

      {/* ════════════════════════════════════════════════════════
          MODAL — Yeni Grup
      ════════════════════════════════════════════════════════ */}
      {modal?.type === 'newGroup' && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-sm sm:items-center"
          onClick={closeModal}
        >
          <div
            className="w-full max-w-md rounded-t-3xl bg-white p-5 shadow-2xl sm:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold">Yeni Antrenman Grubu</h3>
              <button
                type="button"
                onClick={closeModal}
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-app-border text-slate-500 hover:bg-app-bg-soft"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {error && (
              <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                {error}
              </div>
            )}

            <form onSubmit={createGroup} className="mt-4 space-y-3">
              <div className="space-y-1 text-xs">
                <label className="font-medium text-slate-500">Grup adı *</label>
                <input
                  className="input-field"
                  placeholder="Örn: Minikler, Gençler A"
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  autoFocus
                />
              </div>
              <div className="space-y-1 text-xs">
                <label className="font-medium text-slate-500">Not (isteğe bağlı)</label>
                <input
                  className="input-field"
                  placeholder="Yaş aralığı, seviye..."
                  value={groupNotes}
                  onChange={(e) => setGroupNotes(e.target.value)}
                />
              </div>
              <button
                type="submit"
                disabled={saving || !groupName.trim()}
                className="btn-primary w-full"
              >
                {saving ? 'Oluşturuluyor...' : 'Grubu Oluştur'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL — Seans Ekle */}
      {modal?.type === 'addSchedule' && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-sm sm:items-center"
          onClick={closeModal}
        >
          <div
            className="w-full max-w-md rounded-t-3xl bg-white p-5 shadow-2xl sm:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold">Seans Ekle</h3>
                <p className="mt-0.5 text-xs text-brand-muted">{modal.groupName}</p>
              </div>
              <button
                type="button"
                onClick={closeModal}
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-app-border text-slate-500 hover:bg-app-bg-soft"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {error && (
              <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                {error}
              </div>
            )}

            <form onSubmit={addSchedule} className="mt-4 space-y-3">
              <div className="space-y-1 text-xs">
                <label className="font-medium text-slate-500">Gün</label>
                <select
                  className="input-field"
                  value={dayOfWeek}
                  onChange={(e) => setDayOfWeek(Number(e.target.value))}
                >
                  {DAY_OPTIONS.map((d) => (
                    <option key={d} value={d}>{weekdayLabel(d)}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1 text-xs">
                  <label className="font-medium text-slate-500">Başlangıç</label>
                  <input
                    type="time"
                    className="input-field"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                  />
                </div>
                <div className="space-y-1 text-xs">
                  <label className="font-medium text-slate-500">Bitiş</label>
                  <input
                    type="time"
                    className="input-field"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    />
                  </div>
                </div>
              <button
                type="submit"
                disabled={saving}
                className="btn-primary w-full"
              >
                {saving ? 'Ekleniyor...' : 'Seansı Ekle'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ConfirmDialog — grup silme */}
      <ConfirmDialog
        open={!!confirmDeleteGroup}
        title={'"' + (confirmDeleteGroup?.name ?? '') + '" silinsin mi?'}
        message={(() => {
          if (!confirmDeleteGroup) return ''
          const count = (athletesByGroup.get(confirmDeleteGroup.id) ?? []).length
          return count > 0
            ? (count + ' sporcu bu gruba kayıtlı. Silince grupsuz kalacaklar.')
            : 'Bu işlem geri alınamaz.'
        })()}
        confirmLabel="Evet, Sil"
        danger
        saving={saving}
        onConfirm={async () => {
          if (!confirmDeleteGroup) return
          setSaving(true)
          setError(null)
          const { error: delErr } = await supabase.from('training_groups').delete().eq('id', confirmDeleteGroup.id)
          if (delErr) setError(delErr.message)
          else {
            if (expandedGroupId === confirmDeleteGroup.id) setExpandedGroupId(null)
            await load()
          }
          setConfirmDeleteGroup(null)
          setSaving(false)
        }}
        onCancel={() => setConfirmDeleteGroup(null)}
      />

      {/* ConfirmDialog — tüm öğrencileri gruptan çıkar */}
      <ConfirmDialog
        open={!!confirmRemoveAllFromGroup}
        title={'Tüm öğrenciler çıkarılsın mı?'}
        message={
          confirmRemoveAllFromGroup
            ? (athletesByGroup.get(confirmRemoveAllFromGroup.id)?.length ?? 0) +
              ' sporcunun grup ataması kaldırılacak. Sporcu kayıtları silinmez.'
            : ''
        }
        confirmLabel="Evet, Tümünü Çıkar"
        danger
        saving={removingAllAthletes}
        onConfirm={() => {
          if (!confirmRemoveAllFromGroup) return
          void removeAllAthletesFromGroup(confirmRemoveAllFromGroup.id)
        }}
        onCancel={() => setConfirmRemoveAllFromGroup(null)}
      />
    </div>
  )
}