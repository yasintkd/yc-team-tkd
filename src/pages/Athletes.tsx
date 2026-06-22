import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Search, UserPlus, Users, ShieldAlert, ShieldCheck } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { BELTS } from '../lib/belts'
import BeltBadge from '../components/BeltBadge'
import LoadingSkeleton from '../components/LoadingSkeleton'
import AthleteFormModal from '../components/AthleteFormModal'

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
  licensed_this_year: boolean
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

// ─── Main component ───────────────────────────────────────────────────────────

export default function Athletes() {
  const [searchParams] = useSearchParams()
  const [rows, setRows] = useState<Athlete[]>([])
  const [groups, setGroups] = useState<TrainingGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [search, setSearch] = useState('')
  const [beltFilter, setBeltFilter] = useState('')
  const [groupFilter, setGroupFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState<'active' | 'passive' | 'all'>('active')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [modalEditingId, setModalEditingId] = useState<string | null>(null)
  const [modalOpen, setModalOpen] = useState(false)

  const CURRENT_YEAR = new Date().getFullYear()

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
      const athletes = (data ?? []) as Athlete[]
      const ids = athletes.map((a) => a.id)
      const { data: licenses } = await supabase
        .from('athlete_licenses')
        .select('athlete_id')
        .in('athlete_id', ids)
        .eq('year', CURRENT_YEAR)

      const licensedIds = new Set((licenses ?? []).map((l: any) => l.athlete_id))
      setRows(
        athletes.map((a) => ({
          ...a,
          licensed_this_year: licensedIds.has(a.id),
        })),
      )
    }
    setLoading(false)
  }

  useEffect(() => {
    void loadGroups()
    void loadAthletes()
  }, [])

  // URL'den gelen düzenleme parametresi
  useEffect(() => {
    if (!rows.length) return
    const editId = searchParams.get('duzenle')
    if (!editId) return
    const athlete = rows.find((r) => r.id === editId)
    if (athlete) {
      setModalEditingId(athlete.id)
      setModalOpen(true)
    }
  }, [searchParams, rows])

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
        `${a.first_name} ${a.last_name}`.localeCompare(`${b.first_name} ${b.last_name}`, 'tr'),
      )
  }, [rows, search, beltFilter, groupFilter, statusFilter])

  // ── Sayfalama ──────────────────────────────────────────────────────────────
  const PAGE_SIZE = 20
  const [page, setPage] = useState(1)
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const paged = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

  useEffect(() => { setPage(1) }, [search, beltFilter, groupFilter, statusFilter])

  const activeCount = useMemo(() => rows.filter((r) => r.is_active).length, [rows])
  const passiveCount = useMemo(() => rows.filter((r) => !r.is_active).length, [rows])

  // ── Bulk actions ──────────────────────────────────────────────────────────
  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleSelectAll = () => {
    const pagedIds = paged.map((a) => a.id)
    setSelectedIds((prev) => {
      const allSelected = pagedIds.every((id) => prev.has(id))
      const next = new Set(prev)
      for (const id of pagedIds) {
        if (allSelected) next.delete(id)
        else next.add(id)
      }
      return next
    })
  }

  const bulkLicense = async () => {
    const unlicensedIds = paged
      .filter((a) => selectedIds.has(a.id) && !a.licensed_this_year)
      .map((a) => a.id)
    if (unlicensedIds.length === 0) return
    await supabase.from('athlete_licenses').insert(
      unlicensedIds.map((athlete_id) => ({ athlete_id, year: CURRENT_YEAR })),
    )
    await loadAthletes()
    setSelectedIds(new Set())
  }

  // ── Modal handlers ─────────────────────────────────────────────────────────

  const openNewForm = () => {
    setModalEditingId(null)
    setModalOpen(true)
  }

  const openEditForm = (a: Athlete) => {
    setModalEditingId(a.id)
    setModalOpen(true)
  }

  const closeModal = () => {
    setModalOpen(false)
    setModalEditingId(null)
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4 md:space-y-6">
      {modalOpen && (
        <AthleteFormModal
          editingId={modalEditingId}
          groups={groups}
          onSaved={async () => { await loadAthletes(); closeModal() }}
          onClose={closeModal}
        />
      )}

      <section className="glass-panel rounded-2xl p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-sm font-semibold">Sporcular</h2>
            <p className="mt-0.5 text-xs text-brand-muted">{activeCount} aktif · {passiveCount} pasif</p>
          </div>
          <button type="button" onClick={openNewForm} className="btn-primary inline-flex items-center gap-1.5">
            <UserPlus className="h-3.5 w-3.5" />
            Yeni Sporcu
          </button>
        </div>

        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <div className="flex items-center gap-2 rounded-lg border border-app-border bg-white px-3 focus-within:border-brand-cyan focus-within:ring-2 focus-within:ring-brand-cyan/25">
            <Search className="h-3.5 w-3.5 shrink-0 text-slate-400" />
            <input className="w-full bg-transparent py-2.5 text-sm text-slate-800 outline-none placeholder:text-slate-400" placeholder="Sporcu ara..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <select className="input-field text-sm" value={beltFilter} onChange={(e) => setBeltFilter(e.target.value)}>
            <option value="">Tüm kuşaklar</option>
            {BELTS.map((b) => <option key={b} value={b}>{b}</option>)}
          </select>
          <select className="input-field text-sm" value={groupFilter} onChange={(e) => setGroupFilter(e.target.value)}>
            <option value="">Tüm gruplar</option>
            {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
          <div className="flex rounded-lg border border-app-border bg-app-bg-soft/60 p-0.5 text-xs font-medium">
            {([{ key: 'active', label: 'Aktif' }, { key: 'passive', label: 'Pasif' }, { key: 'all', label: 'Tümü' }] as const).map(({ key, label }) => (
              <button key={key} type="button" onClick={() => setStatusFilter(key)}
                className={`flex-1 rounded-md py-1.5 transition ${statusFilter === key ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                {label}
              </button>
            ))}
          </div>
          {selectedIds.size > 0 && (
            <div className="mt-3 flex items-center gap-2 border-t border-app-border/40 pt-3">
              <span className="text-xs text-brand-muted">{selectedIds.size} sporcu seçildi</span>
              <button type="button" onClick={bulkLicense}
                className="rounded-lg bg-brand-cyan px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 transition">
                Seçilileri Vizele
              </button>
              <button type="button" onClick={() => setSelectedIds(new Set())}
                className="rounded-lg border border-app-border px-3 py-1.5 text-xs font-medium text-slate-500 hover:bg-app-bg-soft transition">
                İptal
              </button>
            </div>
          )}
        </div>
      </section>

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">{error}</div>
      )}

      {loading ? (
        <LoadingSkeleton variant="table-row" count={8} />
      ) : filtered.length === 0 ? (
        <div className="glass-panel flex flex-col items-center gap-2 rounded-2xl py-12 text-center">
          <Users className="h-8 w-8 text-slate-300" />
          <p className="text-sm font-medium text-slate-500">Sporcu bulunamadı</p>
          <p className="text-xs text-brand-muted">Filtrelerinizi değiştirin veya yeni sporcu ekleyin.</p>
        </div>
      ) : (
        <>
          {/* Mobil kart */}
          <ul className="space-y-2 md:hidden">
            {paged.map((a) => (
              <li key={a.id}>
                <div className={`glass-panel block w-full rounded-xl p-3 text-left transition ${!a.is_active ? 'opacity-60' : ''}`}>
                  <Link to={`/sporcular/${a.id}`} className="block transition active:scale-[0.99]">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <span className="block truncate text-sm font-semibold text-slate-800 hover:text-brand-red transition">{a.first_name} {a.last_name}</span>
                        <div className="mt-1 flex flex-wrap items-center gap-2">
                          <BeltBadge belt={a.belt} size="sm" />
                          {!a.licensed_this_year && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] font-medium text-amber-700">
                              <ShieldAlert className="h-2.5 w-2.5" />
                              Vizesiz
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${genderBadgeClass(a.gender)}`}>{genderLabel(a.gender)}</span>
                        {!a.is_active && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700">Pasif</span>}
                      </div>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-brand-muted">
                      <span>{birthYear(a.birth_date)}</span>
                      <span>{groupName(a)}</span>
                    </div>
                  </Link>
                  <div className="mt-3 flex justify-end border-t border-app-border/40 pt-2">
                    <button type="button" onClick={() => openEditForm(a)} className="rounded-lg border border-app-border bg-white px-2.5 py-1 text-[11px] font-medium text-slate-600 hover:bg-app-bg-soft">Düzenle</button>
                  </div>
                </div>
              </li>
            ))}
          </ul>

          {/* Masaüstü tablo */}
          <div className="glass-panel hidden overflow-x-auto rounded-2xl md:block">
            <table className="w-full min-w-[720px] text-left text-xs">
              <thead className="border-b border-app-border bg-app-bg-soft/60">
                <tr>
                  <th className="px-3 py-3">
                    <input type="checkbox" checked={paged.length > 0 && paged.every((a) => selectedIds.has(a.id))}
                      onChange={toggleSelectAll} className="accent-brand-cyan h-4 w-4" />
                  </th>
                  <th className="px-4 py-3 font-semibold text-slate-500">Ad Soyad</th>
                  <th className="px-4 py-3 font-semibold text-slate-500">Doğum Yılı</th>
                  <th className="px-4 py-3 font-semibold text-slate-500">Cinsiyet</th>
                  <th className="px-4 py-3 font-semibold text-slate-500">Kuşak</th>
                  <th className="px-4 py-3 font-semibold text-slate-500">Grup</th>
                  <th className="px-4 py-3 font-semibold text-slate-500">Durum</th>
                  <th className="px-4 py-3 font-semibold text-slate-500">Vize</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-app-border">
                {paged.map((a) => (
                  <tr key={a.id} className={`transition hover:bg-app-bg-soft/60 ${!a.is_active ? 'opacity-60' : ''}`}>
                    <td className="px-3 py-3">
                      <input type="checkbox" checked={selectedIds.has(a.id)}
                        onChange={() => toggleSelect(a.id)} className="accent-brand-cyan h-4 w-4" />
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-800">
                      <Link to={`/sporcular/${a.id}`} className="hover:text-brand-red transition">{a.first_name} {a.last_name}</Link>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{birthYear(a.birth_date)}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${genderBadgeClass(a.gender)}`}>{genderLabel(a.gender)}</span>
                    </td>
                    <td className="px-4 py-3"><BeltBadge belt={a.belt} size="md" /></td>
                    <td className="px-4 py-3 text-slate-600">{groupName(a)}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${a.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                        {a.is_active ? 'Aktif' : 'Pasif'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {a.licensed_this_year ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
                          <ShieldCheck className="h-3 w-3" />
                          Vizeli
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700">
                          <ShieldAlert className="h-3 w-3" />
                          Vizesiz
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <button type="button" onClick={() => openEditForm(a)} className="rounded-lg border border-app-border bg-white px-2.5 py-1 text-[11px] font-medium text-slate-600 hover:bg-app-bg-soft">Düzenle</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 px-4 py-3 border-t border-app-border">
              <button type="button" disabled={safePage <= 1} onClick={() => setPage(safePage - 1)} className="rounded-lg border border-app-border bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-app-bg-soft disabled:opacity-40">← Önceki</button>
              <span className="text-xs text-brand-muted">{safePage} / {totalPages}</span>
              <button type="button" disabled={safePage >= totalPages} onClick={() => setPage(safePage + 1)} className="rounded-lg border border-app-border bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-app-bg-soft disabled:opacity-40">Sonraki →</button>
            </div>
          )}
        </>
      )}
    </div>
  )
}