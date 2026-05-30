import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'

type Athlete = {
  id: string
  first_name: string
  last_name: string
  birth_date: string | null
  phone: string | null
  belt: string
  branch: string
  is_active: boolean
}

const beltOptions = [
  'Beyaz (10. Gıp)',
  'Sarı (9. Gıp)',
  'Yeşil (7–6. Gıp)',
  'Mavi (5–4. Gıp)',
  'Kırmızı (3–2. Gıp)',
  'Siyah (1. Dan+)',
]

const branchOptions = [
  'Taekwondo - Poomsae',
  'Taekwondo - Kyorugi',
  'Diğer (Demo, Trick vb.)',
]

export default function Athletes() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [rows, setRows] = useState<Athlete[]>([])

  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [birthDate, setBirthDate] = useState('')
  const [phone, setPhone] = useState('')
  const [belt, setBelt] = useState(beltOptions[0])
  const [branch, setBranch] = useState(branchOptions[0])

  const canSubmit = useMemo(() => {
    return firstName.trim().length > 0 && lastName.trim().length > 0
  }, [firstName, lastName])

  const loadAthletes = async () => {
    setLoading(true)
    setError(null)
    const { data, error: qErr } = await supabase
      .from('athletes')
      .select(
        'id, first_name, last_name, birth_date, phone, belt, branch, is_active',
      )
      .order('created_at', { ascending: false })

    if (qErr) {
      setError(qErr.message)
      setRows([])
    } else {
      setRows((data ?? []) as Athlete[])
    }
    setLoading(false)
  }

  useEffect(() => {
    void loadAthletes()
  }, [])

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
      branch,
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
    setBelt(beltOptions[0])
    setBranch(branchOptions[0])

    await loadAthletes()
    setSaving(false)
  }

  return (
    <div className="space-y-6">
      <section className="glass-panel rounded-2xl p-4">
        <h2 className="text-sm font-semibold">Yeni Sporcu Kaydı</h2>
        <p className="mt-1 text-xs text-brand-muted">
          Temel bilgileri doldurarak hızlıca yeni sporcu ekleyin.
        </p>

        {error && (
          <div className="mt-3 rounded-xl border border-rose-900/40 bg-rose-950/40 px-3 py-2 text-xs text-rose-200">
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
              Kuşak Derecesi (Gıp / Dan)
            </label>
            <select
              id="belt"
              className="input-field"
              value={belt}
              onChange={(e) => setBelt(e.target.value)}
            >
              {beltOptions.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1 text-xs">
            <label className="text-slate-600" htmlFor="branch">
              Branş
            </label>
            <select
              id="branch"
              className="input-field"
              value={branch}
              onChange={(e) => setBranch(e.target.value)}
            >
              {branchOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
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
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">Kayıtlı Sporcular</h2>
          <button
            type="button"
            onClick={() => void loadAthletes()}
            className="rounded-lg border border-app-border px-3 py-1.5 text-[11px] text-slate-600 hover:bg-app-bg-soft"
          >
            Yenile
          </button>
        </div>

        {loading ? (
          <p className="mt-3 text-xs text-brand-muted">Yükleniyor...</p>
        ) : rows.length === 0 ? (
          <p className="mt-3 text-xs text-brand-muted">Henüz sporcu yok.</p>
        ) : (
          <>
            <ul className="mt-3 space-y-2 md:hidden">
              {rows.map((a) => (
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
                      <dd className="text-right text-slate-800">{a.belt}</dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt>Branş</dt>
                      <dd className="text-right text-slate-800">{a.branch}</dd>
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
              <table className="w-full min-w-[520px] text-left text-xs">
                <thead className="bg-app-bg-soft text-brand-muted">
                  <tr>
                    <th className="px-3 py-2">Ad Soyad</th>
                    <th className="px-3 py-2">Kuşak</th>
                    <th className="px-3 py-2">Branş</th>
                    <th className="px-3 py-2">Telefon</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((a) => (
                    <tr key={a.id} className="border-t border-app-border">
                      <td className="px-3 py-2">
                        {a.first_name} {a.last_name}
                        {!a.is_active && (
                          <span className="ml-2 rounded-full bg-slate-200 px-2 py-0.5 text-[10px] text-slate-600">
                            pasif
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2">{a.belt}</td>
                      <td className="px-3 py-2">{a.branch}</td>
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
