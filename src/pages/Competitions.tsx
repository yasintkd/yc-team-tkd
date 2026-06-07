import { useEffect, useMemo, useState } from 'react'
import {
  Plus, Trophy, Trash2, Users, AlertTriangle,
  Calendar, Weight, Filter, Download,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { BELTS, findBeltIndex } from '../lib/belts'
import { downloadCompetitionPng } from '../lib/exportCompetitionPng'
import BeltBadge from '../components/BeltBadge'
import LoadingSkeleton from '../components/LoadingSkeleton'

// ─── Types ────────────────────────────────────────────────────────────────────

type Competition = {
  id: string
  title: string
  competition_date: string
  birth_year_min: number | null                // min doğum yılı
  birth_year_max: number | null                // max doğum yılı
  min_belt_index: number
  status: 'planlandi' | 'tamamlandi'
  notes: string | null
}

type Participant = {
  id: string
  competition_id: string
  athlete_id: string
  weight_category: string | null
  athletes: { first_name: string; last_name: string; belt: string } | { first_name: string; last_name: string; belt: string }[] | null
}

type AthleteOption = {
  id: string
  first_name: string
  last_name: string
  birth_date: string | null
  belt: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getAthleteName(p: Participant): string {
  const a = Array.isArray(p.athletes) ? p.athletes[0] : p.athletes
  return a ? `${a.first_name} ${a.last_name}` : p.athlete_id
}

function getAthleteBelt(p: Participant): string {
  const a = Array.isArray(p.athletes) ? p.athletes[0] : p.athletes
  return a?.belt ?? ''
}

function isAthleteEligible(
  a: AthleteOption,
  birthYearMin: number | null,
  birthYearMax: number | null,
  minBeltIdx: number,
): boolean {
  // belt check
  const beltIdx = findBeltIndex(a.belt)
  if (beltIdx === -1 || beltIdx < minBeltIdx) return false

  // birth year range check — athlete's birth year must be within [birthYearMin, birthYearMax]
  if (a.birth_date) {
    const athleteYear = new Date(a.birth_date).getFullYear()
    if (birthYearMin !== null && athleteYear < birthYearMin) return false
    if (birthYearMax !== null && athleteYear > birthYearMax) return false
  } else if (birthYearMin !== null || birthYearMax !== null) {
    return false  // no birth date on file, can't verify eligibility
  }

  return true
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function Competitions() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [competitions, setCompetitions] = useState<Competition[]>([])
  const [selectedCompetitionId, setSelectedCompetitionId] = useState<string | null>(null)
  const [participants, setParticipants] = useState<Participant[]>([])
  const [athletes, setAthletes] = useState<AthleteOption[]>([])
  const [saving, setSaving] = useState(false)
  const [exportingPng, setExportingPng] = useState(false)

  // Form
  const [title, setTitle] = useState('')
  const [compDate, setCompDate] = useState('')
  const [birthYearMin, setBirthYearMin] = useState('')
  const [birthYearMax, setBirthYearMax] = useState('')
  const [minBeltIndex, setMinBeltIndex] = useState(0)
  const [notes, setNotes] = useState('')
  const [editingCompetition, setEditingCompetition] = useState<Competition | null>(null)

  const selectedCompetition = competitions.find((c) => c.id === selectedCompetitionId) ?? null

  // ── Load ────────────────────────────────────────────────────────────────────

  const loadCompetitions = async () => {
    const { data, error: qErr } = await supabase
      .from('competitions')
      .select('id, title, competition_date, birth_year_min, birth_year_max, min_belt_index, status, notes')
      .order('competition_date', { ascending: false })
    if (qErr) throw qErr
    setCompetitions((data ?? []) as Competition[])
  }

  const loadAthletes = async () => {
    const { data, error: qErr } = await supabase
      .from('athletes')
      .select('id, first_name, last_name, birth_date, belt')
      .eq('is_active', true)
      .order('last_name')
    if (qErr) throw qErr
    setAthletes((data ?? []) as AthleteOption[])
  }

  const loadParticipants = async (competitionId: string) => {
    const { data, error: qErr } = await supabase
      .from('competition_participants')
      .select(
        'id, competition_id, athlete_id, weight_category, athletes ( first_name, last_name, belt )',
      )
      .eq('competition_id', competitionId)
      .order('created_at')
    if (qErr) throw qErr
    setParticipants((data ?? []) as Participant[])
  }

  const loadAll = async () => {
    setLoading(true)
    setError(null)
    try {
      await Promise.all([loadCompetitions(), loadAthletes()])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Yüklenemedi.')
    }
    setLoading(false)
  }

  useEffect(() => { void loadAll() }, [])

  useEffect(() => {
    if (!selectedCompetitionId) {
      setParticipants([])
      return
    }
    void loadParticipants(selectedCompetitionId).catch((err) => {
      setError(err instanceof Error ? err.message : 'Katılımcılar yüklenemedi.')
    })
  }, [selectedCompetitionId])

  // ── Derived ─────────────────────────────────────────────────────────────────

  const participantIds = useMemo(() => new Set(participants.map((p) => p.athlete_id)), [participants])

  const eligibleAthletes = useMemo(() => {
    if (!selectedCompetition) return []
    return athletes.filter(
      (a) =>
        !participantIds.has(a.id) &&
        isAthleteEligible(
            a,
            selectedCompetition.birth_year_min,
            selectedCompetition.birth_year_max,
          selectedCompetition.min_belt_index,
        ),
    )
  }, [athletes, selectedCompetition, participantIds])

  // ── CRUD ────────────────────────────────────────────────────────────────────

  const resetForm = () => {
    setTitle('')
    setCompDate('')
    setBirthYearMin('')
    setBirthYearMax('')
    setMinBeltIndex(0)
    setNotes('')
    setEditingCompetition(null)
    setError(null)
  }

  const startEdit = (comp: Competition) => {
    setEditingCompetition(comp)
    setTitle(comp.title)
    setCompDate(comp.competition_date)
    setBirthYearMin(comp.birth_year_min !== null ? String(comp.birth_year_min) : '')
    setBirthYearMax(comp.birth_year_max !== null ? String(comp.birth_year_max) : '')
    setMinBeltIndex(comp.min_belt_index)
    setNotes(comp.notes ?? '')
    setError(null)
  }

  const submitCompetition = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim() || !compDate) return
    setSaving(true)
    setError(null)

    const payload = {
      title: title.trim(),
      competition_date: compDate,
      birth_year_min: birthYearMin ? parseInt(birthYearMin) : null,
      birth_year_max: birthYearMax ? parseInt(birthYearMax) : null,
      min_belt_index: minBeltIndex,
      notes: notes.trim() || null,
    }

    if (editingCompetition) {
      const { error: upErr } = await supabase
        .from('competitions')
        .update(payload)
        .eq('id', editingCompetition.id)
      if (upErr) { setError(upErr.message); setSaving(false); return }
      setMessage('Yarışma güncellendi.')
      resetForm()
      await loadCompetitions()
      setSaving(false)
      return
    }

    // Yeni
    const { error: insErr } = await supabase
      .from('competitions')
      .insert(payload)
    if (insErr) { setError(insErr.message); setSaving(false); return }

    resetForm()
    await loadCompetitions()
    setMessage('Yarışma oluşturuldu.')
    setSaving(false)
  }

  const deleteCompetition = async (comp: Competition) => {
    if (comp.status === 'tamamlandi') return
    if (!window.confirm(`"${comp.title}" yarışmasını silmek istediğinize emin misiniz? Tüm katılımcı kayıtları da silinecek.`)) return
    setSaving(true)
    setError(null)
    await supabase.from('competition_participants').delete().eq('competition_id', comp.id)
    const { error: delErr } = await supabase.from('competitions').delete().eq('id', comp.id)
    if (delErr) { setError(delErr.message); setSaving(false); return }
    if (selectedCompetitionId === comp.id) {
      setSelectedCompetitionId(null)
      resetForm()
    }
    await loadCompetitions()
    setSaving(false)
  }

  const addToCompetition = async (athleteId: string) => {
    if (!selectedCompetitionId) return
    setError(null)
    const { error: insErr } = await supabase
      .from('competition_participants')
      .insert({ competition_id: selectedCompetitionId, athlete_id: athleteId })
    if (insErr) { setError(insErr.message); return }
    await loadParticipants(selectedCompetitionId)
  }

  const removeParticipant = async (participantId: string) => {
    if (!window.confirm('Bu sporcuyu yarışma listesinden çıkarmak istediğinize emin misiniz?')) return
    setError(null)
    const { error: delErr } = await supabase
      .from('competition_participants')
      .delete()
      .eq('id', participantId)
    if (delErr) setError(delErr.message)
    else if (selectedCompetitionId) setParticipants((prev) => prev.filter((p) => p.id !== participantId))
  }

  const updateWeight = async (participantId: string, weight: string) => {
    setError(null)
    const { error: upErr } = await supabase
      .from('competition_participants')
      .update({ weight_category: weight || null })
      .eq('id', participantId)
    if (upErr) setError(upErr.message)
    else setParticipants((prev) => prev.map((p) => (p.id === participantId ? { ...p, weight_category: weight } : p)))
  }

  const exportPng = async () => {
    if (!selectedCompetition || participants.length === 0) return
    setExportingPng(true)
    setError(null)
    try {
      await downloadCompetitionPng({
        competitionTitle: selectedCompetition.title,
        competitionDate: selectedCompetition.competition_date,
        participants: participants.map((p, i) => ({
          number: i + 1,
          name: getAthleteName(p),
          belt: getAthleteBelt(p),
          weight: p.weight_category ?? '',
        })),
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Görsel oluşturulamadı.')
    } finally {
      setExportingPng(false)
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">

      {/* ── Yarışma formu ── */}
      <section className="glass-panel rounded-2xl p-4">
        <h2 className="text-sm font-semibold">
          {editingCompetition ? 'Yarışmayı Düzenle' : 'Yeni Yarışma'}
        </h2>
        <p className="mt-1 text-xs text-brand-muted">
          {editingCompetition
            ? 'Yarışma bilgilerini güncelleyin.'
            : 'Turnuva veya müsabaka kaydı oluşturun.'}
        </p>

        {error && (
          <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
            {error}
          </div>
        )}
        {message && (
          <div className="mt-3 rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-800">
            {message}
          </div>
        )}

        <form className="mt-4 space-y-3" onSubmit={submitCompetition}>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-1 text-xs">
              <label className="text-slate-600">Yarışma adı *</label>
              <input
                className="input-field"
                placeholder="Örn: İl Şampiyonası"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                autoFocus={!!editingCompetition}
              />
            </div>
            <div className="space-y-1 text-xs">
              <label className="text-slate-600">Tarih *</label>
              <input
                type="date"
                className="input-field"
                value={compDate}
                onChange={(e) => setCompDate(e.target.value)}
              />
            </div>
            <div className="space-y-1 text-xs">
              <label className="text-slate-600">Minimum kuşak</label>
              <select
                className="input-field"
                value={minBeltIndex}
                onChange={(e) => setMinBeltIndex(Number(e.target.value))}
              >
                {BELTS.map((belt, i) => (
                  <option key={i} value={i}>{belt}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1 text-xs">
              <label className="text-slate-600">Doğum yılı üst sınır (büyük yaş)</label>
              <input
                type="number"
                min="1900"
                max="2099"
                className="input-field"
                placeholder="örn: 2012"
                value={birthYearMin}
                onChange={(e) => setBirthYearMin(e.target.value)}
              />
              <p className="text-[10px] text-brand-muted">Bu yıldan önce doğanlar elenir</p>
            </div>
            <div className="space-y-1 text-xs">
              <label className="text-slate-600">Doğum yılı alt sınır (küçük yaş)</label>
              <input
                type="number"
                min="1900"
                max="2099"
                className="input-field"
                placeholder="örn: 2008"
                value={birthYearMax}
                onChange={(e) => setBirthYearMax(e.target.value)}
              />
              <p className="text-[10px] text-brand-muted">Bu yıldan sonra doğanlar elenir</p>
            </div>
          </div>

          <div className="space-y-1 text-xs">
            <label className="text-slate-600">Not</label>
            <input
              className="input-field"
              placeholder="Yer, organizasyon vb."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          <div className="flex items-center gap-2">
            <button
              type="submit"
              disabled={saving || !title.trim() || !compDate}
              className="btn-primary"
            >
              {saving
                ? 'Kaydediliyor...'
                : editingCompetition
                  ? 'Güncelle'
                  : 'Yarışma Oluştur'}
            </button>
            {editingCompetition && (
              <button
                type="button"
                onClick={resetForm}
                className="rounded-lg border border-app-border bg-white px-4 py-2.5 text-xs font-medium text-slate-600 hover:bg-app-bg-soft"
              >
                İptal
              </button>
            )}
          </div>
        </form>
      </section>

      {/* ── Yarışma listesi ── */}
      <section className="glass-panel rounded-2xl p-4">
        <h2 className="text-sm font-semibold">Yarışmalar</h2>
        {loading ? (
          <LoadingSkeleton variant="list-item" count={4} />
        ) : competitions.length === 0 ? (
          <div className="mt-3 flex flex-col items-center gap-2 py-8 text-center">
            <Trophy className="h-6 w-6 text-slate-300" />
            <p className="text-xs text-brand-muted">Henüz yarışma yok.</p>
          </div>
        ) : (
          <ul className="mt-3 space-y-2">
            {competitions.map((comp) => (
              <li key={comp.id}>
                <div
                  className={`w-full rounded-xl border text-left text-sm transition ${
                    selectedCompetitionId === comp.id
                      ? 'border-brand-red bg-brand-red/5'
                      : 'border-app-border bg-white hover:bg-app-bg-soft'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => setSelectedCompetitionId(comp.id)}
                    className="flex w-full items-center justify-between gap-2 px-3 pb-1 pt-3"
                  >
                    <span className="font-medium">{comp.title}</span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                        comp.status === 'tamamlandi'
                          ? 'bg-sky-100 text-sky-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {comp.status === 'tamamlandi' ? 'Tamamlandı' : 'Planlandı'}
                    </span>
                  </button>
                  <div className="flex items-center justify-between px-3 pb-3">
                    <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-brand-muted">
                      <span>{new Date(comp.competition_date).toLocaleDateString('tr-TR')}</span>
                      {comp.min_belt_index > 0 && (
                        <BeltBadge belt={BELTS[comp.min_belt_index]} size="sm" />
                      )}
                      {comp.birth_year_min !== null || comp.birth_year_max !== null ? (
                        <span>doğum yılı sınırı var</span>
                      ) : null}
                    </div>
                    {comp.status === 'planlandi' && (
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); startEdit(comp) }}
                          className="rounded-lg border border-app-border bg-white px-2 py-1 text-[11px] font-medium text-slate-600 hover:bg-app-bg-soft"
                        >
                          Düzenle
                        </button>
                        <button
                          type="button"
                          disabled={saving}
                          onClick={(e) => { e.stopPropagation(); void deleteCompetition(comp) }}
                          className="rounded-lg border border-rose-200 bg-rose-50 px-2 py-1 text-[11px] font-medium text-rose-700 hover:bg-rose-100 disabled:opacity-60"
                        >
                          Sil
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ── Detay ── */}
      {selectedCompetition && (
        <section className="glass-panel rounded-2xl p-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-sm font-semibold">{selectedCompetition.title}</h2>
              <p className="mt-0.5 text-xs text-brand-muted">
                {new Date(selectedCompetition.competition_date).toLocaleDateString('tr-TR')} •{' '}
                {participants.length} katılımcı
                {selectedCompetition.notes && ` • ${selectedCompetition.notes}`}
              </p>
            </div>
            {participants.length > 0 && (
              <button
                type="button"
                disabled={exportingPng}
                onClick={() => void exportPng()}
                className="inline-flex items-center gap-1.5 rounded-lg border border-app-border bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-app-bg-soft disabled:opacity-60"
              >
                <Download className="h-3.5 w-3.5" />
                {exportingPng ? 'Oluşturuluyor...' : 'PNG İndir'}
              </button>
            )}
          </div>

          {/* Filtre özeti */}
          <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
            <span className="inline-flex items-center gap-1 rounded-full border border-app-border bg-white px-2.5 py-1 font-medium text-slate-600">
              <Filter className="h-3 w-3 text-brand-muted" />
              {selectedCompetition.min_belt_index > 0
                ? `Min ${BELTS[selectedCompetition.min_belt_index]}`
                : 'Tüm kuşaklar'}
            </span>
            {selectedCompetition.birth_year_min !== null && (
              <span className="inline-flex items-center gap-1 rounded-full border border-app-border bg-white px-2.5 py-1 text-slate-600">
                <Calendar className="h-3 w-3 text-brand-muted" />
                ≤ {selectedCompetition.birth_year_min} doğumlu
              </span>
            )}
            {selectedCompetition.birth_year_max !== null && (
              <span className="inline-flex items-center gap-1 rounded-full border border-app-border bg-white px-2.5 py-1 text-slate-600">
                <Calendar className="h-3 w-3 text-brand-muted" />
                ≥ {selectedCompetition.birth_year_max} doğumlu
              </span>
            )}
            <span className="inline-flex items-center gap-1 rounded-full border border-app-border bg-white px-2.5 py-1 text-slate-600">
              <Users className="h-3 w-3 text-brand-muted" />
              {eligibleAthletes.length} uygun sporcu
            </span>
          </div>

          {/* ── Uygun sporcu listesi ── */}
          {selectedCompetition.status === 'planlandi' && eligibleAthletes.length > 0 && (
            <div className="mt-4 rounded-xl border border-brand-cyan/20 bg-brand-cyan/5 p-3">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
                <Users className="h-3.5 w-3.5 text-brand-cyan" />
                Uygun Sporcular ({eligibleAthletes.length})
              </div>

              {/* Masaüstü tablo */}
              <div className="mt-2 hidden overflow-x-auto rounded-lg border border-app-border bg-white md:block">
                <table className="w-full min-w-[500px] text-left text-xs">
                  <thead className="bg-app-bg-soft text-brand-muted">
                    <tr>
                      <th className="px-3 py-2">Sporcu</th>
                      <th className="px-3 py-2">Kuşak</th>
                      <th className="px-3 py-2">Doğum</th>
                      <th className="px-3 py-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {eligibleAthletes.map((a) => (
                      <tr key={a.id} className="border-t border-app-border">
                        <td className="px-3 py-2 font-medium text-slate-800">
                          {a.first_name} {a.last_name}
                        </td>
                        <td className="px-3 py-2">
                          <BeltBadge belt={a.belt} size="sm" />
                        </td>
                        <td className="px-3 py-2 text-brand-muted">
                          {a.birth_date ? new Date(a.birth_date).toLocaleDateString('tr-TR') : '—'}
                        </td>
                        <td className="px-3 py-2">
                          <button
                            type="button"
                            onClick={() => void addToCompetition(a.id)}
                            className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-medium text-emerald-700 hover:bg-emerald-100"
                          >
                            <Plus className="h-3 w-3" />
                            Ekle
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobil kart */}
              <ul className="mt-2 space-y-1.5 md:hidden">
                {eligibleAthletes.map((a) => (
                  <li
                    key={a.id}
                    className="flex items-center justify-between rounded-lg border border-app-border bg-white px-3 py-2 text-xs"
                  >
                    <div className="min-w-0 flex-1">
                      <span className="font-medium text-slate-700">{a.first_name} {a.last_name}</span>
                      <span className="ml-1">
                        <BeltBadge belt={a.belt} size="sm" />
                      </span>
                      {a.birth_date && (
                        <span className="ml-1.5 text-brand-muted">
                          {new Date(a.birth_date).toLocaleDateString('tr-TR')}
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => void addToCompetition(a.id)}
                      className="ml-2 shrink-0 rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-1 text-[11px] font-medium text-emerald-700 hover:bg-emerald-100"
                    >
                      <Plus className="inline h-3 w-3" />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Uygun sporcu yok uyarısı */}
          {selectedCompetition.status === 'planlandi' && eligibleAthletes.length === 0 && athletes.length > 0 && (
            <div className="mt-4 rounded-xl border border-amber-200/60 bg-amber-50/70 p-3">
              <div className="flex items-center gap-1.5 text-xs font-medium text-amber-800">
                <AlertTriangle className="h-3.5 w-3.5" />
                Filtreye uygun sporcu bulunamadı
              </div>
            </div>
          )}

          {/* ── Katılımcı listesi ── */}
          {participants.length === 0 ? (
            <p className="mt-4 text-xs text-brand-muted">
              {selectedCompetition.status === 'planlandi'
                ? 'Henüz katılımcı eklenmemiş. Yukarıdan sporcu ekleyin.'
                : 'Bu yarışmada katılımcı yok.'}
            </p>
          ) : (
            <>
              {/* Mobil kart */}
              <ul className="mt-4 space-y-2 md:hidden">
                {participants.map((p) => (
                  <li
                    key={p.id}
                    className="rounded-xl border border-app-border bg-white p-3"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-slate-800">{getAthleteName(p)}</p>
                        <span className="mt-1 inline-flex items-center gap-1">
                          <BeltBadge belt={getAthleteBelt(p)} size="sm" />
                        </span>
                      </div>
                      {selectedCompetition.status === 'planlandi' && (
                        <button
                          type="button"
                          onClick={() => void removeParticipant(p.id)}
                          className="shrink-0 rounded-lg border border-rose-200 bg-rose-50 p-1.5 text-rose-500 hover:bg-rose-100"
                          title="Listeden çıkart"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                    <div className="mt-2">
                      <label className="text-[10px] font-medium text-brand-muted">Kilo kategorisi</label>
                      <input
                        className="input-field mt-0.5 py-1.5 text-xs"
                        placeholder="Örn: -45kg, +55kg..."
                        value={p.weight_category ?? ''}
                        onChange={(e) => void updateWeight(p.id, e.target.value)}
                        disabled={selectedCompetition.status !== 'planlandi'}
                      />
                    </div>
                  </li>
                ))}
              </ul>

              {/* Masaüstü tablo */}
              <div className="mt-4 hidden overflow-x-auto rounded-xl border border-app-border bg-white md:block">
                <table className="w-full min-w-[700px] text-left text-xs">
                  <thead className="bg-app-bg-soft text-brand-muted">
                    <tr>
                      <th className="px-3 py-2">Sporcu</th>
                      <th className="px-3 py-2">Kuşak</th>
                      <th className="px-3 py-2">Kilo Kategorisi</th>
                      {selectedCompetition.status === 'planlandi' && <th className="px-3 py-2"></th>}
                    </tr>
                  </thead>
                  <tbody>
                    {participants.map((p) => (
                      <tr key={p.id} className="border-t border-app-border">
                        <td className="px-3 py-2 font-medium text-slate-800">
                          {getAthleteName(p)}
                        </td>
                        <td className="px-3 py-2">
                          <BeltBadge belt={getAthleteBelt(p)} size="sm" />
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-1.5">
                            <Weight className="h-3 w-3 shrink-0 text-brand-muted" />
                            <input
                              className="input-field max-w-[150px] py-1 text-xs"
                              placeholder="-45kg, +55kg..."
                              value={p.weight_category ?? ''}
                              onChange={(e) => void updateWeight(p.id, e.target.value)}
                              disabled={selectedCompetition.status !== 'planlandi'}
                            />
                          </div>
                        </td>
                        {selectedCompetition.status === 'planlandi' && (
                          <td className="px-3 py-2">
                            <button
                              type="button"
                              onClick={() => void removeParticipant(p.id)}
                              className="inline-flex items-center gap-1 rounded-lg p-1.5 text-rose-500 hover:bg-rose-50 hover:text-rose-700"
                              title="Listeden çıkart"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </section>
      )}
    </div>
  )
}
