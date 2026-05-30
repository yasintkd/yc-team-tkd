import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { BELTS } from '../lib/belts'

type TrainingGroup = { id: string; name: string }

type Athlete = {
  id: string
  first_name: string
  last_name: string
  birth_date: string | null
  phone: string | null
  belt: string
  training_group_id: string | null
  is_active: boolean
  training_groups: { name: string } | { name: string }[] | null
}

export default function Athletes() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [rows, setRows] = useState<Athlete[]>([])
  const [groups, setGroups] = useState<TrainingGroup[]>([])
  const [beltFilter, setBeltFilter] = useState('')

  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [birthDate, setBirthDate] = useState('')
  const [phone, setPhone] = useState('')
  const [belt, setBelt] = useState<string>(BELTS[0])
  const [trainingGroupId, setTrainingGroupId] = useState('')

  const canSubmit = useMemo(() => {
    return firstName.trim().length > 0 && lastName.trim().length > 0
  }, [firstName, lastName])

  const filteredRows = useMemo(() => {
    if (!beltFilter) return rows
    return rows.filter((r) => r.belt === beltFilter)
  }, [rows, beltFilter])

  const loadGroups = async () => {
    const { data } = await supabase
      .from('training_groups')
      .select('id, name')
      .eq('is_active', true)
      .order('name')
    setGroups((data ?? []) as TrainingGroup[])
  }

  const loadAthletes = async () => {
    setLoading(true)
    setError(null)
    const { data, error: qErr } = await supabase
      .from('athletes')
      .select(
        'id, first_name, last_name, birth_date, phone, belt, training_group_id, is_active, training_groups ( name )',
      )
      .order('last_name', { ascending: true })

    if (qErr) {
      setError(qErr.message)
      setRows([])
    } else {
      setRows((data ?? []) as Athlete[])
    }
    setLoading(false)
  }

  useEffect(() => {
    void loadGroups()
    void loadAthletes()
  }, [])

  const groupName = (a: Athlete) => {
    const g = Array.isArray(a.training_groups) ? a.training_groups[0] : a.training_groups
    return g?.name ?? '—'
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!canSubmit) return

    setSaving(true)
    setError(null)

    const payload = {
      first_name: firstName.trim(),
      last_name: lastName.trim(),
      birth_date: birthDate ? birthDate : null,
      phone: phone.trim() ? phone.trim() : null,
      belt,
      branch: 'Taekwondo',
      training_group_id: trainingGroupId || null,
      is_active: true,
    }

    const { error: insErr } = await supabase.from('athletes').insert(payload)
    if (insErr) {
      setError(insErr.message)
      setSaving(false)
      return
    }

    setFirstName('')
    setLastName('')
    setBirthDate('')
    setPhone('')
    setBelt(BELTS[0])
    setTrainingGroupId('')

    await loadAthletes()
    setSaving(false)
  }

  return (
    <div className="space-y-6">
      <section className="glass-panel rounded-2xl p-4">
        <h2 className="text-sm font-semibold">Yeni Sporcu Kaydı</h2>
        <p className="mt-1 text-xs text-brand-muted">
          YÇ Team Taekwondo salonuna yeni öğrenci ekleyin.
        </p>

        {error && (
          <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
            {error}
          </div>
        )}

        <form className="mt-4 grid gap-4 sm:grid-cols-2" onSubmit={onSubmit}>
          <div className="space-y-1 text-xs">
            <label className="text-slate-600" htmlFor="firstName">
              Adı
            </label>
            <input
              id="firstName"
              className="input-field"
              placeholder="Örn: Ali"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
            />
          </div>
          <div className="space-y-1 text-xs">
            <label className="text-slate-600" htmlFor="lastName">
              Soyadı
            </label>
            <input
              id="lastName"
              className="input-field"
              placeholder="Örn: Yılmaz"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
            />
          </div>
          <div className="space-y-1 text-xs">
            <label className="text-slate-600" htmlFor="birthDate">
              Doğum Tarihi
            </label>
            <input
              id="birthDate"
              type="date"
              className="input-field"
              value={birthDate}
              onChange={(e) => setBirthDate(e.target.value)}
            />
          </div>
          <div className="space-y-1 text-xs">
            <label className="text-slate-600" htmlFor="phone">
              Telefon
            </label>
            <input
              id="phone"
              className="input-field"
              placeholder="Örn: 05xx xxx xx xx"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>
          <div className="space-y-1 text-xs">
            <label className="text-slate-600" htmlFor="belt">
              Kuşak
            </label>
            <select
              id="belt"
              className="input-field"
              value={belt}
              onChange={(e) => setBelt(e.target.value)}
            >
              {BELTS.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1 text-xs">
            <label className="text-slate-600" htmlFor="group">
              Antrenman Grubu
            </label>
            <select
              id="group"
              className="input-field"
              value={trainingGroupId}
              onChange={(e) => setTrainingGroupId(e.target.value)}
            >
              <option value="">Grup seçilmedi</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex sm:col-span-2 sm:justify-end">
            <button
              type="submit"
              disabled={!canSubmit || saving}
              className="btn-primary w-full sm:w-auto"
            >
              {saving ? 'Kaydediliyor...' : 'Sporcu Ekle'}
            </button>
          </div>
        </form>
      </section>

      <section className="glass-panel rounded-2xl p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-sm font-semibold">Kayıtlı Sporcular</h2>
          <div className="flex flex-wrap items-center gap-2">
            <select
              className="input-field w-auto min-w-[140px] text-xs"
              value={beltFilter}
              onChange={(e) => setBeltFilter(e.target.value)}
            >
              <option value="">Tüm kuşaklar</option>
              {BELTS.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => void loadAthletes()}
              className="rounded-lg border border-app-border px-3 py-1.5 text-[11px] text-slate-600 hover:bg-app-bg-soft"
            >
              Yenile
            </button>
          </div>
        </div>

        {loading ? (
          <p className="mt-3 text-xs text-brand-muted">Yükleniyor...</p>
        ) : filteredRows.length === 0 ? (
          <p className="mt-3 text-xs text-brand-muted">Sporcu bulunamadı.</p>
        ) : (
          <>
            <ul className="mt-3 space-y-2 md:hidden">
              {filteredRows.map((a) => (
                <li
                  key={a.id}
                  className="rounded-xl border border-app-border bg-white p-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-medium text-sm">
                      {a.first_name} {a.last_name}
                    </p>
                    {!a.is_active && (
                      <span className="shrink-0 rounded-full bg-slate-200 px-2 py-0.5 text-[10px] text-slate-600">
                        pasif
                      </span>
                    )}
                  </div>
                  <dl className="mt-2 space-y-1 text-xs text-brand-muted">
                    <div className="flex justify-between gap-2">
                      <dt>Kuşak</dt>
                      <dd className="text-right font-medium text-slate-800">{a.belt}</dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt>Grup</dt>
                      <dd className="text-right text-slate-800">{groupName(a)}</dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt>Telefon</dt>
                      <dd className="text-right text-slate-800">{a.phone ?? '-'}</dd>
                    </div>
                  </dl>
                </li>
              ))}
            </ul>

            <div className="mt-3 hidden overflow-x-auto rounded-xl border border-app-border bg-white md:block">
              <table className="w-full min-w-[560px] text-left text-xs">
                <thead className="bg-app-bg-soft text-brand-muted">
                  <tr>
                    <th className="px-3 py-2">Ad Soyad</th>
                    <th className="px-3 py-2">Kuşak</th>
                    <th className="px-3 py-2">Grup</th>
                    <th className="px-3 py-2">Telefon</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.map((a) => (
                    <tr key={a.id} className="border-t border-app-border">
                      <td className="px-3 py-2">
                        {a.first_name} {a.last_name}
                      </td>
                      <td className="px-3 py-2 font-medium">{a.belt}</td>
                      <td className="px-3 py-2">{groupName(a)}</td>
                      <td className="px-3 py-2">{a.phone ?? '-'}</td>
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
