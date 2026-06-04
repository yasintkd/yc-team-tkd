import { useEffect, useMemo, useState } from 'react'
import { X, Search, UserPlus, Pencil, Trash2, Users, PauseCircle, PlayCircle, MessageCircle, Phone, Copy, Check, FileText } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { BELTS } from '../lib/belts'

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
  training_group_id: '',
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Listede sadece doğum yılı göster */
function birthYear(birthDate: string | null): string {
  if (!birthDate) return '—'
  return String(new Date(birthDate).getFullYear())
}

/** Detayda tam bilgi: "2012 (13 yaş)" */
function birthDetail(birthDate: string | null): string {
  if (!birthDate) return '—'
  const d = new Date(birthDate)
  const year = d.getFullYear()
  const age = Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24 * 365.25))
  return `${year} (${age} yaş)`
}

// Veli için sabit karşılama mesajı (WhatsApp grup davet linki dahil)
const WELCOME_MESSAGE = `Merhaba,
Suluova Gençlik Merkezi Taekwondo kursu için resmi iletişim grubuna katılmak için aşağıdaki linki tıklayınız. Tüm resmi duyurularımızı bu kanal üzerinden gerçekleştireceğiz.

https://chat.whatsapp.com/JzhZoyn2HHU0gkbamHnikg?mode=gi_t

Yasin Çeken
Milli Sporcu ve Antrenör
05515508132`

function welcomeMessage(_a: Athlete): string {
  return WELCOME_MESSAGE
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
function beltStyle(belt: string): { badge: string; dot: string } {
  const b = belt.toLowerCase()

  // ── Ara kuşaklar (önce kontrol et) ──────────────────────────────────────────

  // Sarı-Yeşil  → sarı fon, yeşil yazı & kenarlık
  if ((b.includes('sarı') || b.includes('sari')) && b.includes('yeşil'))
    return {
      badge: 'bg-yellow-100 text-emerald-700 border border-emerald-400',
      dot:   'bg-yellow-400',
    }

  // Yeşil-Mavi  → yeşil fon, mavi yazı & kenarlık
  if (b.includes('yeşil') && b.includes('mavi'))
    return {
      badge: 'bg-emerald-100 text-blue-700 border border-blue-400',
      dot:   'bg-emerald-500',
    }

  // Mavi-Kırmızı → mavi fon, kırmızı yazı & kenarlık
  if (b.includes('mavi') && (b.includes('kırmızı') || b.includes('kirmizi')))
    return {
      badge: 'bg-blue-100 text-red-700 border border-red-400',
      dot:   'bg-blue-500',
    }

  // Kırmızı-Siyah → kırmızı fon, siyah yazı & kenarlık
  if ((b.includes('kırmızı') || b.includes('kirmizi')) && b.includes('siyah'))
    return {
      badge: 'bg-red-100 text-slate-900 border border-slate-700',
      dot:   'bg-red-500',
    }

  // ── Ana kuşaklar ─────────────────────────────────────────────────────────────

  if (b.includes('beyaz'))
    return {
      badge: 'bg-white text-slate-600 border border-slate-300 shadow-sm',
      dot:   'bg-slate-300',
    }
  if (b.includes('sarı') || b.includes('sari'))
    return {
      badge: 'bg-yellow-100 text-yellow-800 border border-yellow-300',
      dot:   'bg-yellow-400',
    }
  if (b.includes('yeşil'))
    return {
      badge: 'bg-emerald-100 text-emerald-800 border border-emerald-300',
      dot:   'bg-emerald-500',
    }
  if (b.includes('mavi'))
    return {
      badge: 'bg-blue-100 text-blue-800 border border-blue-300',
      dot:   'bg-blue-500',
    }
  if (b.includes('kırmızı') || b.includes('kirmizi'))
    return {
      badge: 'bg-red-100 text-red-800 border border-red-300',
      dot:   'bg-red-500',
    }
  if (b.includes('siyah'))
    return {
      badge: 'bg-slate-900 text-white border border-slate-700',
      dot:   'bg-white/80',
    }

  // Varsayılan
  return {
    badge: 'bg-slate-100 text-slate-700 border border-slate-200',
    dot:   'bg-slate-400',
  }
}

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
  const [selectedAthlete, setSelectedAthlete] = useState<Athlete | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

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
        'id, first_name, last_name, birth_date, phone, belt, gender, tc_no, mother_name, father_name, parent_name, parent_phone, training_group_id, is_active, training_groups ( name )',
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
          ? `${a.first_name} ${a.last_name}`.toLowerCase().includes(q)
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
      training_group_id: a.training_group_id ?? '',
    })
    setError(null)
    setShowForm(true)
    setSelectedAthlete(null)
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

  /** Tescil Fişi PDF indir */
  const downloadTescil = async (a: Athlete) => {
    try {
      const res = await fetch('/api/tescil', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tc_no:       a.tc_no ?? '',
          first_name:  a.first_name,
          last_name:   a.last_name,
          birth_date:  a.birth_date ?? '',
          mother_name: a.mother_name ?? '',
          father_name: a.father_name ?? '',
        }),
      })
      if (!res.ok) throw new Error('PDF alınamadı')
      const blob = await res.blob()
      const url  = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href  = url
      link.download = `${a.first_name}_${a.last_name}_tescil.pdf`
      link.click()
      URL.revokeObjectURL(url)
    } catch {
      setError('Tescil fişi oluşturulamadı. Sunucu hatası.')
    }
  }

  /** Pasife / aktife al */
  const onToggleActive = async (athlete: Athlete) => {
    setSaving(true)
    setError(null)
    const { error: dbErr } = await supabase
      .from('athletes')
      .update({ is_active: !athlete.is_active })
      .eq('id', athlete.id)
    if (dbErr) {
      setError(dbErr.message)
    } else {
      // Modal içindeki veriyi güncelle
      setSelectedAthlete((prev) =>
        prev?.id === athlete.id ? { ...prev, is_active: !athlete.is_active } : prev,
      )
      await loadAthletes()
    }
    setSaving(false)
  }

  /** Kalıcı sil */
  const onDelete = async (id: string) => {
    setSaving(true)
    setError(null)
    const { error: dbErr } = await supabase.from('athletes').delete().eq('id', id)
    if (dbErr) {
      setError(dbErr.message)
    } else {
      setConfirmDeleteId(null)
      setSelectedAthlete(null)
      await loadAthletes()
    }
    setSaving(false)
  }

  // ── Render helpers ────────────────────────────────────────────────────────────

  const canSubmit = form.first_name.trim().length > 0 && form.last_name.trim().length > 0

  const detailAthlete = selectedAthlete
    ? (rows.find((r) => r.id === selectedAthlete.id) ?? selectedAthlete)
    : null

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
                className={`flex-1 rounded-md py-1.5 transition ${
                  statusFilter === key
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
        <p className="text-xs text-brand-muted">Yükleniyor...</p>
      ) : filtered.length === 0 ? (
        <div className="glass-panel flex flex-col items-center gap-2 rounded-2xl py-12 text-center">
          <Users className="h-8 w-8 text-slate-300" />
          <p className="text-sm font-medium text-slate-500">Sporcu bulunamadı</p>
          <p className="text-xs text-brand-muted">
            Filtrelerinizi değiştirin veya yeni sporcu ekleyin.
          </p>
        </div>
      ) : (
        <>
          {/* Mobil: kart listesi */}
          <ul className="space-y-2 md:hidden">
            {filtered.map((a) => (
              <li key={a.id}>
                <button
                  type="button"
                  onClick={() => setSelectedAthlete(a)}
                  className={`glass-panel w-full rounded-xl p-3 text-left transition active:scale-[0.99] ${
                    !a.is_active ? 'opacity-60' : ''
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-800">
                        {a.first_name} {a.last_name}
                      </p>
                      <span
                        className={`mt-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${beltStyle(a.belt).badge}`}
                      >
                        <span className={`h-1.5 w-1.5 rounded-full ${beltStyle(a.belt).dot}`} />
                        {a.belt}
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
                </button>
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
                {filtered.map((a) => (
                  <tr
                    key={a.id}
                    className={`cursor-pointer transition hover:bg-app-bg-soft/60 ${
                      !a.is_active ? 'opacity-60' : ''
                    }`}
                    onClick={() => setSelectedAthlete(a)}
                  >
                    <td className="px-4 py-3 font-medium text-slate-800">
                      {a.first_name} {a.last_name}
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
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${beltStyle(a.belt).badge}`}
                        >
                          <span className={`h-2 w-2 shrink-0 rounded-full ${beltStyle(a.belt).dot}`} />
                          {a.belt}
                        </span>
                      </td>
                    <td className="px-4 py-3 text-slate-600">{groupName(a)}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                          a.is_active
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
        </>
      )}

      {/* ════════════════════════════════════════════════════════
          MODAL — Sporcu Detay
      ════════════════════════════════════════════════════════ */}
      {detailAthlete && !showForm && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-sm sm:items-center"
          onClick={() => { setSelectedAthlete(null); setConfirmDeleteId(null) }}
        >
          <div
            className="w-full max-w-lg rounded-t-3xl bg-white p-5 shadow-2xl sm:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Başlık */}
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-semibold text-slate-800">
                    {detailAthlete.first_name} {detailAthlete.last_name}
                  </h3>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                      detailAthlete.is_active
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-amber-100 text-amber-700'
                    }`}
                  >
                    {detailAthlete.is_active ? 'Aktif' : 'Pasif'}
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-brand-muted">{detailAthlete.belt}</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => openEditForm(detailAthlete)}
                  className="flex h-9 w-9 items-center justify-center rounded-xl border border-app-border bg-white text-slate-600 hover:bg-app-bg-soft"
                  title="Düzenle"
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => { setSelectedAthlete(null); setConfirmDeleteId(null) }}
                  className="flex h-9 w-9 items-center justify-center rounded-xl border border-app-border bg-white text-slate-600 hover:bg-app-bg-soft"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Bilgiler */}
            <dl className="mt-4 grid grid-cols-2 gap-3">
              <InfoRow label="Cinsiyet" value={genderLabel(detailAthlete.gender)} />
              <InfoRow label="Doğum Yılı / Yaş" value={birthDetail(detailAthlete.birth_date)} />
              <InfoRow label="Kuşak" value={detailAthlete.belt} />
              <InfoRow label="Antrenman Grubu" value={groupName(detailAthlete)} />
              {detailAthlete.tc_no && (
                <InfoRow label="TC Kimlik No" value={detailAthlete.tc_no} />
              )}
              {detailAthlete.father_name && (
                <InfoRow label="Baba Adı" value={detailAthlete.father_name} />
              )}
              {detailAthlete.mother_name && (
                <InfoRow label="Anne Adı" value={detailAthlete.mother_name} />
              )}
            </dl>

            {/* Telefon & WhatsApp kartları */}
            <div className="mt-3 space-y-2">
              {/* Sporcu telefonu */}
              {detailAthlete.phone && (
                <PhoneCard
                  label="Sporcu Telefonu"
                  name={`${detailAthlete.first_name} ${detailAthlete.last_name}`}
                  contactName={`${detailAthlete.first_name} ${detailAthlete.last_name} SLV`}
                  phone={detailAthlete.phone}
                  waMessage=""
                />
              )}
              {/* Veli telefonu + WhatsApp karşılama */}
              {detailAthlete.parent_phone && (
                <PhoneCard
                  label={`Veli — ${detailAthlete.parent_name ?? 'Veli'}`}
                  name={detailAthlete.parent_name ?? 'Veli'}
                  contactName={`${detailAthlete.parent_name ?? 'Veli'} (${detailAthlete.first_name}) SLV`}
                  phone={detailAthlete.parent_phone}
                  waMessage={welcomeMessage(detailAthlete)}
                  showWelcome
                />
              )}
              {/* Telefon yoksa bilgi */}
              {!detailAthlete.phone && !detailAthlete.parent_phone && (
                <p className="text-xs text-brand-muted">Telefon numarası girilmemiş.</p>
              )}
            </div>

            {/* Aksiyonlar */}
            <div className="mt-5 flex flex-col gap-3 border-t border-app-border pt-4">

              {/* Tescil Fişi PDF */}
              <button
                type="button"
                onClick={() => void downloadTescil(detailAthlete)}
                className="inline-flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-medium text-blue-700 hover:bg-blue-100 transition"
              >
                <FileText className="h-4 w-4" />
                Tescil Fişi PDF İndir
              </button>

              {/* Pasife / aktife al */}
              <button
                type="button"
                disabled={saving}
                onClick={() => void onToggleActive(detailAthlete)}
                className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-medium transition disabled:opacity-60 ${
                  detailAthlete.is_active
                    ? 'border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100'
                    : 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                }`}
              >
                {detailAthlete.is_active ? (
                  <>
                    <PauseCircle className="h-4 w-4" />
                    {saving ? 'İşleniyor...' : 'Pasife Al (Ara Veriyor)'}
                  </>
                ) : (
                  <>
                    <PlayCircle className="h-4 w-4" />
                    {saving ? 'İşleniyor...' : 'Tekrar Aktifleştir'}
                  </>
                )}
              </button>

              {/* Kalıcı sil */}
              {confirmDeleteId === detailAthlete.id ? (
                <div className="flex flex-col gap-2">
                  <p className="text-xs font-medium text-rose-700">
                    Bu sporcu kalıcı olarak silinecek. Emin misiniz?
                  </p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => void onDelete(detailAthlete.id)}
                      className="flex-1 rounded-xl bg-rose-600 py-2 text-xs font-semibold text-white hover:bg-rose-700 disabled:opacity-60"
                    >
                      {saving ? 'Siliniyor...' : 'Evet, Kalıcı Sil'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteId(null)}
                      className="flex-1 rounded-xl border border-app-border py-2 text-xs font-medium text-slate-600"
                    >
                      İptal
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmDeleteId(detailAthlete.id)}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 px-3 py-2 text-xs font-medium text-rose-600 hover:bg-rose-50"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Kalıcı Olarak Sil
                </button>
              )}
            </div>
          </div>
        </div>
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

              {/* ─ Veli bilgileri ─ */}
              <div className="col-span-2 mt-1 border-t border-app-border pt-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-brand-muted">
                  Veli Bilgileri
                </p>
              </div>
              <Field label="Veli Adı Soyadı">
                <input
                  className="input-field"
                  placeholder="Mehmet Yılmaz"
                  value={form.parent_name}
                  onChange={set('parent_name')}
                />
              </Field>
              <Field label="Veli Telefonu">
                <input
                  className="input-field"
                  placeholder="05xx xxx xx xx"
                  value={form.parent_phone}
                  onChange={set('parent_phone')}
                />
              </Field>

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

// ─── InfoRow ──────────────────────────────────────────────────────────────────

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-app-border bg-app-bg-soft/60 px-3 py-2">
      <dt className="text-[10px] font-medium uppercase tracking-wide text-brand-muted">{label}</dt>
      <dd className="mt-0.5 text-sm font-medium text-slate-800">{value}</dd>
    </div>
  )
}

// ─── PhoneCard ─────────────────────────────────────────────────────────────────

function PhoneCard({
  label,
  contactName,
  phone,
  waMessage,
  showWelcome = false,
}: {
  label: string
  name: string
  contactName: string   // Rehbere kaydedilecek tam ad formatı
  phone: string
  waMessage: string
  showWelcome?: boolean
}) {
  const [copied, setCopied] = useState(false)

  const copyPhone = async () => {
    try {
      await navigator.clipboard.writeText(phone)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // fallback
    }
  }

  // Kişi kaydet: vCard indirme
  // Format: "Veli Ad Soyad (Sporcu Adı) SLV" veya "Sporcu Ad Soyad SLV"
  const saveContact = () => {
    const vcard = [
      'BEGIN:VCARD',
      'VERSION:3.0',
      `FN:${contactName}`,
      `N:${contactName};;;;`,
      `TEL;TYPE=CELL:${phone}`,
      'END:VCARD',
    ].join('\n')
    const blob = new Blob([vcard], { type: 'text/vcard' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${contactName.replace(/[^\w\s-]/g, '').replace(/\s+/g, '_')}.vcf`
    a.click()
    URL.revokeObjectURL(url)
  }

  const cleanPhone = phone.replace(/\D/g, '')
  const intl = cleanPhone.startsWith('0') ? '90' + cleanPhone.slice(1) : cleanPhone
  // Mesaj boşsa direkt sohbet aç, doluysa hazır metin ekle
  const waUrl = waMessage
    ? `https://wa.me/${intl}?text=${encodeURIComponent(waMessage)}`
    : `https://wa.me/${intl}`

  return (
    <div className="rounded-xl border border-app-border bg-white px-3 py-2.5">
      <p className="text-[10px] font-medium uppercase tracking-wide text-brand-muted">{label}</p>
      <p className="mt-0.5 text-sm font-semibold text-slate-800">{phone}</p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {/* Ara */}
        <a
          href={`tel:${phone.replace(/\s/g, '')}`}
          className="inline-flex items-center gap-1 rounded-lg border border-app-border bg-app-bg-soft px-2.5 py-1.5 text-[11px] font-medium text-slate-700 hover:bg-sky-50 hover:border-sky-200 hover:text-sky-700 transition"
        >
          <Phone className="h-3 w-3" />
          Ara
        </a>
        {/* Kopyala */}
        <button
          type="button"
          onClick={() => void copyPhone()}
          className="inline-flex items-center gap-1 rounded-lg border border-app-border bg-app-bg-soft px-2.5 py-1.5 text-[11px] font-medium text-slate-700 hover:bg-app-bg-soft transition"
        >
          {copied ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
          {copied ? 'Kopyalandı' : 'Kopyala'}
        </button>
        {/* Kişi kaydet */}
        <button
          type="button"
          onClick={saveContact}
          className="inline-flex items-center gap-1 rounded-lg border border-app-border bg-app-bg-soft px-2.5 py-1.5 text-[11px] font-medium text-slate-700 hover:bg-violet-50 hover:border-violet-200 hover:text-violet-700 transition"
        >
          Rehbere Kaydet
        </button>
        {/* WhatsApp — normal mesaj */}
        <a
          href={waUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-[11px] font-medium text-emerald-700 hover:bg-emerald-100 transition"
        >
          <MessageCircle className="h-3 w-3" />
          WhatsApp
        </a>
        {/* Karşılama mesajı — sadece veli kartında */}
        {showWelcome && (
          <a
            href={waUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 rounded-lg border border-emerald-300 bg-emerald-100 px-2.5 py-1.5 text-[11px] font-medium text-emerald-800 hover:bg-emerald-200 transition"
          >
            <MessageCircle className="h-3 w-3" />
            Karşılama Mesajı Gönder
          </a>
        )}
      </div>
    </div>
  )
}