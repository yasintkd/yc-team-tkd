import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Search, UserPlus, Users, X } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { BELTS } from '../lib/belts'
import BeltBadge from '../components/BeltBadge'
import LoadingSkeleton from '../components/LoadingSkeleton'

// ─── Types ────────────────────────────────────────────────────────────────────

type TrainingGroup = { id: string; name: string }

type Athlete = {
  id: string
  first_name: string
  last_name: string
  birth_date: string | null
  phone: string | null
  belt: string
  gender: 'erkek' | 'kiz' | null
  tc_no: string | null
  mother_name: string | null
  father_name: string | null
  parent_name: string | null
  parent_phone: string | null
  parent_type: 'anne' | 'baba' | null
  training_group_id: string | null
  is_active: boolean
  training_groups: { name: string } | { name: string }[] | null
}

type FormData = {
  first_name: string
  last_name: string
  birth_date: string
  phone: string
  belt: string
  gender: 'erkek' | 'kiz' | ''
  tc_no: string
  mother_name: string
  father_name: string
  parent_name: string
  parent_phone: string
  parent_type: 'anne' | 'baba' | ''
  training_group_id: string
}

const EMPTY_FORM: FormData = {
  first_name: '',
  last_name: '',
  birth_date: '',
  phone: '',
  belt: BELTS[0],
  gender: '',
  tc_no: '',
  mother_name: '',
  father_name: '',
  parent_name: '',
  parent_phone: '',
  parent_type: '',
  training_group_id: '',
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Listede sadece doğum yılı göster */
function birthYear(birthDate: string | null): string {
  if (!birthDate) return '—'
  return String(new Date(birthDate).getFullYear())
}

function groupName(a: Athlete): string {
  const g = Array.isArray(a.training_groups) ? a.training_groups[0] : a.training_groups
  return g?.name ?? '—'
}

function genderLabel(g: string | null) {
  if (g === 'erkek') return 'Erkek'
  if (g === 'kiz') return 'Kız'
  return '—'
}

function genderBadgeClass(g: string | null) {
  if (g === 'erkek') return 'bg-sky-100 text-sky-700'
  if (g === 'kiz') return 'bg-pink-100 text-pink-700'
  return 'bg-slate-100 text-slate-500'
}

/** Kuşak rengine göre badge stilleri
 *  Ara kuşaklarda: 1. renk = arka plan, 2. renk = yazı & kenarlık
 *  Kontrol sırası ÖNEMLİ — özelden genele (ara kuşak → ana kuşak)
 */
// beltStyle() now imported from ../lib/belts

// ─── Sub-components ───────────────────────────────────────────────────────────

function Field({
  label,
  children,
  col2 = false,
}: {
  label: string
  children: React.ReactNode
  col2?: boolean
}) {
  return (
    <div className={`space-y-1 text-xs${col2 ? ' col-span-2' : ''}`}>
      <label className="font-medium text-slate-500">{label}</label>
      {children}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function Athletes() {
  // Data
  const [rows, setRows] = useState<Athlete[]>([])
  const [groups, setGroups] = useState<TrainingGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // UI state
  const [search, setSearch] = useState('')
  const [beltFilter, setBeltFilter] = useState('')
  const [groupFilter, setGroupFilter] = useState('')
  // 'active' | 'passive' | 'all'
  const [statusFilter, setStatusFilter] = useState<'active' | 'passive' | 'all'>('active')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<FormData>(EMPTY_FORM)
  const [editingId, setEditingId] = useState<string | null>(null)


  // ── Data loading ────────────────────────────────────────────────────────────

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
        'id, first_name, last_name, birth_date, phone, belt, gender, tc_no, mother_name, father_name, parent_name, parent_phone, parent_type, training_group_id, is_active, training_groups ( name )',
      )
      .order('last_name')

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

  // ── Filtered list ────────────────────────────────────────────────────────────

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return rows
      .filter((a) => {
        const nameMatch = q
          ? `${a.first_name} ${a.last_name}`.toLowerCase().includes(q) ||
          (a.phone && a.phone.replace(/\s/g, '').includes(q))
          : true
        const beltMatch = beltFilter ? a.belt === beltFilter : true
        const groupMatch = groupFilter ? a.training_group_id === groupFilter : true
        const statusMatch =
          statusFilter === 'active'
            ? a.is_active
            : statusFilter === 'passive'
              ? !a.is_active
              : true
        return nameMatch && beltMatch && groupMatch && statusMatch
      })
      .sort((a, b) =>
        `${a.first_name} ${a.last_name}`.localeCompare(
          `${b.first_name} ${b.last_name}`,
          'tr',
        ),
      )
  }, [rows, search, beltFilter, groupFilter, statusFilter])

  // ── Sayfalama ──────────────────────────────────────────────────────────────
  const PAGE_SIZE = 20
  const [page, setPage] = useState(1)
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const paged = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

  // Filtre değişince sayfa sıfırla
  useEffect(() => { setPage(1) }, [search, beltFilter, groupFilter, statusFilter])

  // Sayaçlar
  const activeCount = useMemo(() => rows.filter((r) => r.is_active).length, [rows])
  const passiveCount = useMemo(() => rows.filter((r) => !r.is_active).length, [rows])

  // ── Form helpers ─────────────────────────────────────────────────────────────

  const openNewForm = () => {
    setEditingId(null)
    setForm(EMPTY_FORM)
    setError(null)
    setShowForm(true)
  }

  const openEditForm = (a: Athlete) => {
    setEditingId(a.id)
    setForm({
      first_name: a.first_name,
      last_name: a.last_name,
      birth_date: a.birth_date ?? '',
      phone: a.phone ?? '',
      belt: a.belt,
      gender: (a.gender as 'erkek' | 'kiz' | '') ?? '',
      tc_no: a.tc_no ?? '',
      mother_name: a.mother_name ?? '',
      father_name: a.father_name ?? '',
      parent_name: a.parent_name ?? '',
      parent_phone: a.parent_phone ?? '',
      parent_type: (a.parent_type ?? '') as 'anne' | 'baba' | '',
      training_group_id: a.training_group_id ?? '',
    })
    setError(null)
    setShowForm(true)
  }

  const closeForm = () => {
    setShowForm(false)
    setEditingId(null)
    setError(null)
  }

  const set = (field: keyof FormData) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm((prev) => ({ ...prev, [field]: e.target.value }))

  // ── CRUD ─────────────────────────────────────────────────────────────────────

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.first_name.trim() || !form.last_name.trim()) return
    setSaving(true)
    setError(null)

    const payload = {
      first_name: form.first_name.trim(),
      last_name: form.last_name.trim(),
      birth_date: form.birth_date || null,
      phone: form.phone.trim() || null,
      belt: form.belt,
      gender: form.gender || null,
      tc_no: form.tc_no.trim() || null,
      mother_name: form.mother_name.trim() || null,
      father_name: form.father_name.trim() || null,
      parent_name: form.parent_name.trim() || null,
      parent_phone: form.parent_phone.trim() || null,
      parent_type: form.parent_type || null,
      training_group_id: form.training_group_id || null,
      branch: 'Taekwondo',
    }

    const { error: dbErr } = editingId
      ? await supabase.from('athletes').update(payload).eq('id', editingId)
      : await supabase.from('athletes').insert(payload)

    if (dbErr) {
      setError(dbErr.message)
      setSaving(false)
      return
    }

    closeForm()
    await loadAthletes()
    setSaving(false)
  }

  // ── Render helpers ────────────────────────────────────────────────────────────

  const canSubmit = form.first_name.trim().length > 0 && form.last_name.trim().length > 0

  return (
    <div className="space-y-4 md:space-y-6">

      {/* ── Üst araç çubuğu ── */}
      <section className="glass-panel rounded-2xl p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-sm font-semibold">Sporcular</h2>
            <p className="mt-0.5 text-xs text-brand-muted">
              {activeCount} aktif · {passiveCount} pasif
            </p>
          </div>
          <button
            type="button"
            onClick={openNewForm}
            className="btn-primary inline-flex items-center gap-1.5"
          >
            <UserPlus className="h-3.5 w-3.5" />
            Yeni Sporcu
          </button>
        </div>

        {/* Arama & filtreler */}
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <div className="flex items-center gap-2 rounded-lg border border-app-border bg-white px-3 focus-within:border-brand-cyan focus-within:ring-2 focus-within:ring-brand-cyan/25">
            <Search className="h-3.5 w-3.5 shrink-0 text-slate-400" />
            <input
              className="w-full bg-transparent py-2.5 text-sm text-slate-800 outline-none placeholder:text-slate-400"
              placeholder="Sporcu ara..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <select
            className="input-field text-sm"
            value={beltFilter}
            onChange={(e) => setBeltFilter(e.target.value)}
          >
            <option value="">Tüm kuşaklar</option>
            {BELTS.map((b) => <option key={b} value={b}>{b}</option>)}
          </select>
          <select
            className="input-field text-sm"
            value={groupFilter}
            onChange={(e) => setGroupFilter(e.target.value)}
          >
            <option value="">Tüm gruplar</option>
            {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
          {/* Aktif / Pasif filtresi */}
          <div className="flex rounded-lg border border-app-border bg-app-bg-soft/60 p-0.5 text-xs font-medium">
            {(
              [
                { key: 'active', label: 'Aktif' },
                { key: 'passive', label: 'Pasif' },
                { key: 'all', label: 'Tümü' },
              ] as const
            ).map(({ key, label }) => (
              <button
                key={key}
                type="button"
                onClick={() => setStatusFilter(key)}
                className={`flex-1 rounded-md py-1.5 transition ${statusFilter === key
                    ? 'bg-white text-slate-800 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                  }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* ── Hata ── */}
      {error && !showForm && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
          {error}
        </div>
      )}

      {/* ── Sporcu listesi ── */}
      {loading ? (
        <LoadingSkeleton variant="table-row" count={8} />
      ) : filtered.length === 0 ? (
        <div className="glass-panel flex flex-col items-center gap-2 rounded-2xl py-12 text-center">
          <Users className="h-8 w-8 text-slate-300" />
          <p className="text-sm font-medium text-slate-500">Sporcu bulunamadı</p>
          <p className="text-xs text-brand-muted">
            Filtrelerinizi değiştirin veya yeni sporcu ekleyin.
          </p>
        </div>
      ) : loading ? (
        <LoadingSkeleton variant="table-row" count={8} />
      ) : (
        <>
          {/* Mobil: kart listesi */}
          <ul className="space-y-2 md:hidden">
            {paged.map((a) => (
              <li key={a.id}>
                <div
                  className={`glass-panel block w-full rounded-xl p-3 text-left transition ${!a.is_active ? 'opacity-60' : ''
                    }`}
                >
                  <Link
                    to={`/sporcular/${a.id}`}
                    className="block transition active:scale-[0.99]"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <span className="block truncate text-sm font-semibold text-slate-800 hover:text-brand-red transition">
                          {a.first_name} {a.last_name}
                        </span>
                        <span className="mt-1 inline-flex items-center gap-1">
                          <BeltBadge belt={a.belt} size="sm" />
                        </span>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${genderBadgeClass(a.gender)}`}
                        >
                          {genderLabel(a.gender)}
                        </span>
                        {!a.is_active && (
                          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700">
                            Pasif
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-brand-muted">
                      <span>{birthYear(a.birth_date)}</span>
                      <span>{groupName(a)}</span>
                    </div>
                  </Link>
                  <div className="mt-3 flex justify-end border-t border-app-border/40 pt-2">
                    <button
                      type="button"
                      onClick={() => openEditForm(a)}
                      className="rounded-lg border border-app-border bg-white px-2.5 py-1 text-[11px] font-medium text-slate-600 hover:bg-app-bg-soft"
                    >
                      Düzenle
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>

          {/* Masaüstü: tablo */}
          <div className="glass-panel hidden overflow-x-auto rounded-2xl md:block">
            <table className="w-full min-w-[640px] text-left text-xs">
              <thead className="border-b border-app-border bg-app-bg-soft/60">
                <tr>
                  <th className="px-4 py-3 font-semibold text-slate-500">Ad Soyad</th>
                  <th className="px-4 py-3 font-semibold text-slate-500">Doğum Yılı</th>
                  <th className="px-4 py-3 font-semibold text-slate-500">Cinsiyet</th>
                  <th className="px-4 py-3 font-semibold text-slate-500">Kuşak</th>
                  <th className="px-4 py-3 font-semibold text-slate-500">Grup</th>
                  <th className="px-4 py-3 font-semibold text-slate-500">Durum</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-app-border">
                {paged.map((a) => (
                  <tr
                    key={a.id}
                    className={`transition hover:bg-app-bg-soft/60 ${!a.is_active ? 'opacity-60' : ''
                      }`}
                  >
                    <td className="px-4 py-3 font-medium text-slate-800">
                      <Link to={`/sporcular/${a.id}`} className="hover:text-brand-red transition">
                        {a.first_name} {a.last_name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{birthYear(a.birth_date)}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${genderBadgeClass(a.gender)}`}
                      >
                        {genderLabel(a.gender)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <BeltBadge belt={a.belt} size="md" />
                    </td>
                    <td className="px-4 py-3 text-slate-600">{groupName(a)}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${a.is_active
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-amber-100 text-amber-700'
                          }`}
                      >
                        {a.is_active ? 'Aktif' : 'Pasif'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          openEditForm(a)
                        }}
                        className="rounded-lg border border-app-border bg-white px-2.5 py-1 text-[11px] font-medium text-slate-600 hover:bg-app-bg-soft"
                      >
                        Düzenle
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Sayfalama */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 px-4 py-3 border-t border-app-border">
              <button
                type="button"
                disabled={safePage <= 1}
                onClick={() => setPage(safePage - 1)}
                className="rounded-lg border border-app-border bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-app-bg-soft disabled:opacity-40"
              >
                ← Önceki
              </button>
              <span className="text-xs text-brand-muted">
                {safePage} / {totalPages}
              </span>
              <button
                type="button"
                disabled={safePage >= totalPages}
                onClick={() => setPage(safePage + 1)}
                className="rounded-lg border border-app-border bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-app-bg-soft disabled:opacity-40"
              >
                Sonraki →
              </button>
            </div>
          )}
        </>
      )}



      {/* ════════════════════════════════════════════════════════
          MODAL — Yeni / Düzenle Formu
      ════════════════════════════════════════════════════════ */}
      {showForm && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-sm sm:items-center"
          onClick={closeForm}
        >
          <div
            className="w-full max-w-lg rounded-t-3xl bg-white p-5 shadow-2xl sm:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Başlık */}
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-slate-800">
                {editingId ? 'Sporcu Düzenle' : 'Yeni Sporcu Ekle'}
              </h3>
              <button
                type="button"
                onClick={closeForm}
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

            <form
              onSubmit={onSubmit}
              className="mt-4 grid max-h-[65vh] grid-cols-2 gap-3 overflow-y-auto pb-1"
            >
              {/* ─ Temel bilgiler ─ */}
              <Field label="Adı *">
                <input
                  className="input-field"
                  placeholder="Ali"
                  value={form.first_name}
                  onChange={set('first_name')}
                />
              </Field>
              <Field label="Soyadı *">
                <input
                  className="input-field"
                  placeholder="Yılmaz"
                  value={form.last_name}
                  onChange={set('last_name')}
                />
              </Field>

              <Field label="Doğum Tarihi">
                <input
                  type="date"
                  className="input-field"
                  value={form.birth_date}
                  onChange={set('birth_date')}
                />
              </Field>
              <Field label="Cinsiyet">
                <select className="input-field" value={form.gender} onChange={set('gender')}>
                  <option value="">Seçilmedi</option>
                  <option value="erkek">Erkek</option>
                  <option value="kiz">Kız</option>
                </select>
              </Field>

              <Field label="Telefon">
                <input
                  className="input-field"
                  placeholder="05xx xxx xx xx"
                  value={form.phone}
                  onChange={set('phone')}
                />
              </Field>
              <Field label="Kuşak">
                <select className="input-field" value={form.belt} onChange={set('belt')}>
                  {BELTS.map((b) => <option key={b} value={b}>{b}</option>)}
                </select>
              </Field>

              <Field label="Antrenman Grubu" col2>
                <select
                  className="input-field"
                  value={form.training_group_id}
                  onChange={set('training_group_id')}
                >
                  <option value="">Grup seçilmedi</option>
                  {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                </select>
              </Field>

              {/* ─ Kimlik bilgileri ─ */}
              <div className="col-span-2 mt-1 border-t border-app-border pt-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-brand-muted">
                  Kimlik Bilgileri (Lisans / Tescil)
                </p>
              </div>
              <Field label="TC Kimlik No" col2>
                <input
                  className="input-field"
                  placeholder="12345678901"
                  maxLength={11}
                  value={form.tc_no}
                  onChange={set('tc_no')}
                />
              </Field>
              <Field label="Anne Adı">
                <input
                  className="input-field"
                  placeholder="Fatma"
                  value={form.mother_name}
                  onChange={set('mother_name')}
                />
              </Field>
              <Field label="Baba Adı Soyadı">
                <input
                  className="input-field"
                  placeholder="Ahmet Arif"
                  value={form.father_name}
                  onChange={set('father_name')}
                />
              </Field>

              {/* ─ Veli irtibat ─ */}
              <div className="col-span-2 mt-1 border-t border-app-border pt-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-brand-muted">
                  Veli İrtibat
                </p>
              </div>
              <Field label="Veli Telefonu" col2>
                <input
                  className="input-field"
                  placeholder="05xx xxx xx xx"
                  value={form.parent_phone}
                  onChange={set('parent_phone')}
                />
              </Field>
              {/* Veli tipi: anne mi baba mı — sadece telefon girilmişse zorunlu değil */}
              <div className="col-span-2 flex gap-4 text-xs">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="parent_type"
                    value="anne"
                    checked={form.parent_type === 'anne'}
                    onChange={() => setForm((p) => ({ ...p, parent_type: 'anne' }))}
                    className="accent-brand-cyan"
                  />
                  Anne
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="parent_type"
                    value="baba"
                    checked={form.parent_type === 'baba'}
                    onChange={() => setForm((p) => ({ ...p, parent_type: 'baba' }))}
                    className="accent-brand-cyan"
                  />
                  Baba
                </label>
              </div>

              {/* ─ Kaydet ─ */}
              <div className="col-span-2 pt-2">
                <button
                  type="submit"
                  disabled={!canSubmit || saving}
                  className="btn-primary w-full"
                >
                  {saving
                    ? 'Kaydediliyor...'
                    : editingId
                      ? 'Değişiklikleri Kaydet'
                      : 'Sporcu Ekle'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
