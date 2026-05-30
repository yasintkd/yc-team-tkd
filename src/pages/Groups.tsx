import { useEffect, useMemo, useState } from 'react'
import { Download } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { weekdayLabel, formatTime } from '../lib/days'
import { downloadGroupListPdf } from '../lib/exportGroupPdf'

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
  training_group_id: string | null
}

export default function Groups() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [groups, setGroups] = useState<TrainingGroup[]>([])
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [athletes, setAthletes] = useState<AthleteLite[]>([])

  const [name, setName] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  const [scheduleGroupId, setScheduleGroupId] = useState('')
  const [dayOfWeek, setDayOfWeek] = useState(1)
  const [startTime, setStartTime] = useState('17:00')
  const [endTime, setEndTime] = useState('18:00')
  const [exportingGroupId, setExportingGroupId] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    setError(null)

    const [gRes, sRes, aRes] = await Promise.all([
      supabase
        .from('training_groups')
        .select('id, name, notes, is_active')
        .order('name'),
      supabase
        .from('group_schedules')
        .select('id, group_id, day_of_week, start_time, end_time'),
      supabase
        .from('athletes')
        .select('id, first_name, last_name, belt, training_group_id')
        .eq('is_active', true)
        .order('last_name'),
    ])

    if (gRes.error) {
      setError(gRes.error.message)
      setLoading(false)
      return
    }

    setGroups((gRes.data ?? []) as TrainingGroup[])
    setSchedules((sRes.data ?? []) as Schedule[])
    setAthletes((aRes.data ?? []) as AthleteLite[])
    setLoading(false)
  }

  useEffect(() => {
    void load()
  }, [])

  const athletesByGroup = useMemo(() => {
    const map = new Map<string, AthleteLite[]>()
    for (const g of groups) map.set(g.id, [])
    for (const a of athletes) {
      if (a.training_group_id && map.has(a.training_group_id)) {
        map.get(a.training_group_id)!.push(a)
      }
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
    for (const [, list] of map) {
      list.sort((a, b) => a.day_of_week - b.day_of_week || a.start_time.localeCompare(b.start_time))
    }
    return map
  }, [schedules])

  const createGroup = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    setSaving(true)
    setError(null)
    const { error: insErr } = await supabase.from('training_groups').insert({
      name: name.trim(),
      notes: notes.trim() || null,
    })
    if (insErr) setError(insErr.message)
    else {
      setName('')
      setNotes('')
      await load()
    }
    setSaving(false)
  }

  const addSchedule = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!scheduleGroupId) return
    setSaving(true)
    setError(null)
    const { error: insErr } = await supabase.from('group_schedules').insert({
      group_id: scheduleGroupId,
      day_of_week: dayOfWeek,
      start_time: startTime,
      end_time: endTime,
    })
    if (insErr) setError(insErr.message)
    else await load()
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
      .from('athletes')
      .update({ training_group_id: groupId })
      .eq('id', athleteId)
    if (upErr) setError(upErr.message)
    else await load()
  }

  const removeGroup = async (group: TrainingGroup) => {
    const memberCount = (athletesByGroup.get(group.id) ?? []).length
    const msg =
      memberCount > 0
        ? `"${group.name}" grubunu silmek istediğinize emin misiniz? ${memberCount} sporcu grupsuz kalacak.`
        : `"${group.name}" grubunu silmek istediğinize emin misiniz?`
    if (!window.confirm(msg)) return

    setSaving(true)
    setError(null)
    const { error: delErr } = await supabase
      .from('training_groups')
      .delete()
      .eq('id', group.id)
    if (delErr) setError(delErr.message)
    else {
      if (scheduleGroupId === group.id) setScheduleGroupId('')
      await load()
    }
    setSaving(false)
  }

  const unassignAthlete = async (athleteId: string) => {
    await assignAthlete(athleteId, null)
  }

  const exportGroupPdf = async (group: TrainingGroup) => {
    setExportingGroupId(group.id)
    setError(null)
    try {
      const groupAthletes = [...(athletesByGroup.get(group.id) ?? [])].sort((a, b) =>
        `${a.last_name} ${a.first_name}`.localeCompare(`${b.last_name} ${b.first_name}`, 'tr'),
      )
      const groupSchedules = (schedulesByGroup.get(group.id) ?? []).map((s) => ({
        dayLabel: weekdayLabel(s.day_of_week),
        timeRange: `${formatTime(s.start_time)} – ${formatTime(s.end_time)}`,
      }))

      await downloadGroupListPdf({
        groupName: group.name,
        groupNotes: group.notes,
        schedules: groupSchedules,
        athletes: groupAthletes.map((a) => ({
          firstName: a.first_name,
          lastName: a.last_name,
        })),
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'PDF oluşturulamadı.')
    } finally {
      setExportingGroupId(null)
    }
  }

  return (
    <div className="space-y-6">
      <section className="glass-panel rounded-2xl p-4">
        <h2 className="text-sm font-semibold">Yeni Antrenman Grubu</h2>
        <p className="mt-1 text-xs text-brand-muted">
          Sporcularınızı gruplara ayırın; gün ve saat programını aşağıdan ekleyin.
        </p>
        {error && (
          <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
            {error}
          </div>
        )}
        <form className="mt-4 grid gap-3 sm:grid-cols-2" onSubmit={createGroup}>
          <div className="space-y-1 text-xs">
            <label className="text-slate-600" htmlFor="groupName">
              Grup adı
            </label>
            <input
              id="groupName"
              className="input-field"
              placeholder="Örn: Minikler, Gençler A"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="space-y-1 text-xs">
            <label className="text-slate-600" htmlFor="groupNotes">
              Not (isteğe bağlı)
            </label>
            <input
              id="groupNotes"
              className="input-field"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
          <div className="sm:col-span-2">
            <button type="submit" disabled={saving || !name.trim()} className="btn-primary">
              {saving ? 'Kaydediliyor...' : 'Grup Oluştur'}
            </button>
          </div>
        </form>
      </section>

      <section className="glass-panel rounded-2xl p-4">
        <h2 className="text-sm font-semibold">Gruba Program Ekle</h2>
        <form className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5" onSubmit={addSchedule}>
          <div className="space-y-1 text-xs lg:col-span-2">
            <label className="text-slate-600">Grup</label>
            <select
              className="input-field"
              value={scheduleGroupId}
              onChange={(e) => setScheduleGroupId(e.target.value)}
            >
              <option value="">Seçin</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1 text-xs">
            <label className="text-slate-600">Gün</label>
            <select
              className="input-field"
              value={dayOfWeek}
              onChange={(e) => setDayOfWeek(Number(e.target.value))}
            >
              {[1, 2, 3, 4, 5, 6, 7].map((d) => (
                <option key={d} value={d}>
                  {weekdayLabel(d)}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1 text-xs">
            <label className="text-slate-600">Başlangıç</label>
            <input
              type="time"
              className="input-field"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
            />
          </div>
          <div className="space-y-1 text-xs">
            <label className="text-slate-600">Bitiş</label>
            <input
              type="time"
              className="input-field"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
            />
          </div>
          <div className="sm:col-span-2 lg:col-span-5">
            <button
              type="submit"
              disabled={saving || !scheduleGroupId}
              className="btn-primary w-full sm:w-auto"
            >
              Program Ekle
            </button>
          </div>
        </form>
      </section>

      <section className="space-y-4">
        {loading ? (
          <p className="text-xs text-brand-muted">Yükleniyor...</p>
        ) : groups.length === 0 ? (
          <p className="text-xs text-brand-muted">Henüz grup yok.</p>
        ) : (
          groups.map((g) => (
            <article key={g.id} className="glass-panel rounded-2xl p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h3 className="text-sm font-semibold">{g.name}</h3>
                  {g.notes && <p className="mt-0.5 text-xs text-brand-muted">{g.notes}</p>}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-app-bg-soft px-2 py-0.5 text-[11px] text-slate-600">
                    {(athletesByGroup.get(g.id) ?? []).length} sporcu
                  </span>
                  <button
                    type="button"
                    disabled={saving || exportingGroupId === g.id}
                    onClick={() => void exportGroupPdf(g)}
                    className="inline-flex items-center gap-1 rounded-lg border border-app-border bg-white px-2.5 py-1 text-[11px] font-medium text-slate-700 hover:bg-app-bg-soft disabled:opacity-60"
                  >
                    <Download className="h-3.5 w-3.5" />
                    {exportingGroupId === g.id ? 'PDF...' : 'PDF İndir'}
                  </button>
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => void removeGroup(g)}
                    className="rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1 text-[11px] font-medium text-rose-700 hover:bg-rose-100 disabled:opacity-60"
                  >
                    Grubu Sil
                  </button>
                </div>
              </div>

              <div className="mt-3">
                <p className="text-xs font-medium text-slate-600">Antrenman saatleri</p>
                {(schedulesByGroup.get(g.id) ?? []).length === 0 ? (
                  <p className="mt-1 text-xs text-brand-muted">Program eklenmemiş.</p>
                ) : (
                  <ul className="mt-2 space-y-1 text-xs text-slate-700">
                    {(schedulesByGroup.get(g.id) ?? []).map((s) => (
                      <li
                        key={s.id}
                        className="flex items-center justify-between rounded-lg border border-app-border bg-white px-3 py-2"
                      >
                        <span>
                          {weekdayLabel(s.day_of_week)} • {formatTime(s.start_time)} –{' '}
                          {formatTime(s.end_time)}
                        </span>
                        <button
                          type="button"
                          onClick={() => void removeSchedule(s.id)}
                          className="text-[11px] text-rose-600 hover:underline"
                        >
                          Sil
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="mt-4">
                <p className="text-xs font-medium text-slate-600">Gruptaki sporcular</p>
                {(athletesByGroup.get(g.id) ?? []).length === 0 ? (
                  <p className="mt-1 text-xs text-brand-muted">
                    Sporcu atamak için aşağıdaki listeden seçin.
                  </p>
                ) : (
                  <ul className="mt-2 flex flex-wrap gap-2">
                    {(athletesByGroup.get(g.id) ?? []).map((a) => (
                      <li
                        key={a.id}
                        className="flex items-center gap-1 rounded-full border border-app-border bg-white pl-2.5 pr-1 py-1 text-[11px]"
                      >
                        <span>
                          {a.first_name} {a.last_name}{' '}
                          <span className="text-brand-muted">({a.belt})</span>
                        </span>
                        <button
                          type="button"
                          onClick={() => void unassignAthlete(a.id)}
                          className="rounded-full px-1.5 py-0.5 text-rose-600 hover:bg-rose-50"
                          title="Gruptan çıkar"
                          aria-label={`${a.first_name} ${a.last_name} gruptan çıkar`}
                        >
                          ×
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </article>
          ))
        )}
      </section>

      {!loading && athletes.length > 0 && groups.length > 0 && (
        <section className="glass-panel rounded-2xl p-4">
          <h2 className="text-sm font-semibold">Grupsuz Sporcuları Ata</h2>
          <ul className="mt-3 space-y-2">
            {athletes
              .filter((a) => !a.training_group_id)
              .map((a) => (
                <li
                  key={a.id}
                  className="flex flex-col gap-2 rounded-xl border border-app-border bg-white p-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <span className="text-sm">
                    {a.first_name} {a.last_name}{' '}
                    <span className="text-xs text-brand-muted">({a.belt})</span>
                  </span>
                  <select
                    className="input-field max-w-xs text-xs"
                    defaultValue=""
                    onChange={(e) => {
                      if (e.target.value) void assignAthlete(a.id, e.target.value)
                    }}
                  >
                    <option value="">Gruba ata...</option>
                    {groups.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.name}
                      </option>
                    ))}
                  </select>
                </li>
              ))}
          </ul>
          {athletes.every((a) => a.training_group_id) && (
            <p className="mt-2 text-xs text-brand-muted">Tüm aktif sporcular bir gruba atanmış.</p>
          )}
        </section>
      )}
    </div>
  )
}
