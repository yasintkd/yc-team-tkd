import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ArrowLeft, Award, Trophy, PauseCircle, PlayCircle, Trash2, FileText } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { downloadTescilPdf } from '../lib/exportTescilPdf'
import BeltBadge from '../components/BeltBadge'
import PhoneCard from '../components/PhoneCard'
import ConfirmDialog from '../components/ConfirmDialog'
import LoadingSkeleton from '../components/LoadingSkeleton'

// ─── Types ────────────────────────────────────────────────────────────────────

type AthleteDetail = {
  id: string
  first_name: string
  last_name: string
  belt: string
  phone: string | null
  birth_date: string | null
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

type BeltHistory = {
  id: string
  exam_title: string
  exam_date: string
  belt_before: string
  target_belt: string
  result: string
}

type CompHistory = {
  id: string
  comp_title: string
  comp_date: string
  weight_category: string | null
  ranking: string | null
}

type AttendanceSummary = {
  total: number
  geldi: number
  gelmedi: number
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function groupName(
  a: { training_groups: { name: string } | { name: string }[] | null },
): string {
  const g = Array.isArray(a.training_groups) ? a.training_groups[0] : a.training_groups
  return g?.name ?? '—'
}

function resultLabel(r: string): string {
  if (r === 'gecti') return 'Geçti'
  if (r === 'kaldi') return 'Kaldı'
  return 'Bekliyor'
}

function resultColor(r: string): string {
  if (r === 'gecti') return 'text-emerald-700 bg-emerald-100'
  if (r === 'kaldi') return 'text-rose-700 bg-rose-100'
  return 'text-amber-700 bg-amber-100'
}

function genderLabel(g: string | null) {
  if (g === 'erkek') return 'Erkek'
  if (g === 'kiz') return 'Kız'
  return '—'
}

function birthDetail(birthDate: string | null): string {
  if (!birthDate) return '—'
  const d = new Date(birthDate)
  const year = d.getFullYear()
  const age = Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24 * 365.25))
  return `${year} (${age} yaş)`
}

function parentDisplayName(a: { parent_type: string | null; mother_name: string | null; father_name: string | null }): string {
  if (a.parent_type === 'anne' && a.mother_name) return a.mother_name
  if (a.parent_type === 'baba' && a.father_name) return a.father_name
  // Fallback — parent_type seçilmemiş veya isim boş
  if (a.mother_name) return a.mother_name
  if (a.father_name) return a.father_name
  return 'Veli'
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-app-border bg-app-bg-soft/60 px-3 py-2">
      <dt className="text-[10px] font-medium uppercase tracking-wide text-brand-muted">{label}</dt>
      <dd className="mt-0.5 text-sm font-medium text-slate-800">{value}</dd>
    </div>
  )
}

// ─── Component ─────────────────────────────────────────────────────────────────

export default function AthleteDetail() {
  const { id } = useParams<{ id: string }>()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [athlete, setAthlete] = useState<AthleteDetail | null>(null)
  const [beltHistory, setBeltHistory] = useState<BeltHistory[]>([])
  const [compHistory, setCompHistory] = useState<CompHistory[]>([])
  const [attSummary, setAttSummary] = useState<AttendanceSummary | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  useEffect(() => {
    if (!id) return
    void (async () => {
      const [aRes, beltRes, compRes, attRes] = await Promise.all([
        supabase
          .from('athletes')
          .select('id, first_name, last_name, belt, phone, birth_date, gender, tc_no, mother_name, father_name, parent_name, parent_phone, parent_type, training_group_id, is_active, training_groups ( name )')
          .eq('id', id)
          .single(),
        supabase
          .from('belt_exam_participants')
          .select('id, belt_before, target_belt, result, belt_exams!inner ( id, title, exam_date )')
          .eq('athlete_id', id)
          .order('belt_exams(exam_date)', { ascending: false }),
        supabase
          .from('competition_participants')
          .select('id, weight_category, ranking, competitions!inner ( id, title, competition_date )')
          .eq('athlete_id', id)
          .order('competitions(competition_date)', { ascending: false }),
        supabase
          .from('attendance_records')
          .select('status')
          .eq('athlete_id', id)
          .gte('session_date', new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)),
      ])

      if (aRes.data) setAthlete(aRes.data as AthleteDetail)

      const beltData = (beltRes.data ?? []) as any[]
      setBeltHistory(
        beltData.map((b: any) => ({
          id: b.id,
          exam_title: b.belt_exams?.title ?? 'Sınav',
          exam_date: b.belt_exams?.exam_date ?? '',
          belt_before: b.belt_before,
          target_belt: b.target_belt,
          result: b.result,
        })),
      )

      const compData = (compRes.data ?? []) as any[]
      setCompHistory(
        compData.map((c: any) => ({
          id: c.id,
          comp_title: c.competitions?.title ?? 'Yarışma',
          comp_date: c.competitions?.competition_date ?? '',
          weight_category: c.weight_category,
          ranking: c.ranking,
        })),
      )

      const attData = attRes.data ?? []
      setAttSummary({
        total: attData.length,
        geldi: attData.filter((r: any) => r.status === 'geldi').length,
        gelmedi: attData.filter((r: any) => r.status === 'gelmedi').length,
      })

      setLoading(false)
    })()
  }, [id])

  const downloadTescil = async () => {
    if (!athlete) return
    try {
      await downloadTescilPdf({
        tc_no: athlete.tc_no,
        first_name: athlete.first_name,
        last_name: athlete.last_name,
        birth_date: athlete.birth_date,
        mother_name: athlete.mother_name,
        father_name: athlete.father_name,
      })
    } catch {
      setError('Tescil fişi oluşturulamadı.')
    }
  }

  const toggleActive = async () => {
    if (!athlete) return
    setSaving(true)
    setError(null)
    const { error: dbErr } = await supabase
      .from('athletes')
      .update({ is_active: !athlete.is_active })
      .eq('id', athlete.id)
    if (dbErr) {
      setError(dbErr.message)
    } else {
      setAthlete((prev) => prev ? { ...prev, is_active: !prev.is_active } : prev)
    }
    setSaving(false)
  }

  const handleDelete = async () => {
    if (!athlete) return
    setSaving(true)
    setError(null)
    const { error: dbErr } = await supabase.from('athletes').delete().eq('id', athlete.id)
    if (dbErr) {
      setError(dbErr.message)
      setSaving(false)
    } else {
      window.location.href = '/sporcular'
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <LoadingSkeleton variant="card" count={3} />
      </div>
    )
  }

  if (!athlete) {
    return (
      <div className="glass-panel rounded-2xl p-6 text-center">
        <p className="text-sm text-brand-muted">Sporcu bulunamadı.</p>
        <Link to="/sporcular" className="mt-2 inline-block text-xs text-brand-red hover:underline">
          Sporculara dön
        </Link>
      </div>
    )
  }

  const attendRate = attSummary && attSummary.total > 0
    ? Math.round((attSummary.geldi / attSummary.total) * 100)
    : null

  return (
    <div className="space-y-6">

      {/* ── Üst bilgi & geri ── */}
      <section className="glass-panel rounded-2xl p-4">
        <Link
          to="/sporcular"
          className="mb-3 inline-flex items-center gap-1 text-xs text-brand-muted hover:text-slate-700"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Sporculara dön
        </Link>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold text-slate-800">
              {athlete.first_name} {athlete.last_name}
            </h1>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <BeltBadge belt={athlete.belt} size="md" />
              <span className="text-xs text-brand-muted">{groupName(athlete)}</span>
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                  athlete.is_active
                    ? 'bg-emerald-100 text-emerald-700'
                    : 'bg-amber-100 text-amber-700'
                }`}
              >
                {athlete.is_active ? 'Aktif' : 'Pasif'}
              </span>
            </div>
          </div>
        </div>

        {/* Katılım özeti */}
        {attSummary && (
          <div className="mt-4 grid grid-cols-3 gap-3">
            <div className="rounded-xl border border-app-border bg-white px-3 py-2 text-center">
              <p className="text-lg font-bold text-slate-800">{attSummary.total}</p>
              <p className="text-[10px] text-brand-muted">Toplam</p>
            </div>
            <div className="rounded-xl border border-app-border bg-white px-3 py-2 text-center">
              <p className="text-lg font-bold text-emerald-600">{attSummary.geldi}</p>
              <p className="text-[10px] text-brand-muted">Geldi</p>
            </div>
            <div className="rounded-xl border border-app-border bg-white px-3 py-2 text-center">
              <p className="text-lg font-bold text-rose-600">{attSummary.gelmedi}</p>
              <p className="text-[10px] text-brand-muted">Gelmedi</p>
            </div>
          </div>
        )}
        {attendRate !== null && (
          <p className="mt-2 text-xs text-brand-muted text-center">
            Son 90 gün katılım oranı: <span className="font-semibold text-slate-700">%{attendRate}</span>
          </p>
        )}
      </section>

      {/* ── Bilgi kartları ── */}
      <section className="glass-panel rounded-2xl p-4">
        <h2 className="mb-3 text-sm font-semibold text-slate-800">Sporcu Bilgileri</h2>
        <dl className="grid grid-cols-2 gap-3">
          <InfoRow label="Cinsiyet" value={genderLabel(athlete.gender)} />
          <InfoRow label="Doğum Yılı / Yaş" value={birthDetail(athlete.birth_date)} />
          <InfoRow label="Kuşak" value={athlete.belt} />
          <InfoRow label="Antrenman Grubu" value={groupName(athlete)} />
          {athlete.tc_no && <InfoRow label="TC Kimlik No" value={athlete.tc_no} />}
          {athlete.father_name && <InfoRow label="Baba Adı" value={athlete.father_name} />}
          {athlete.mother_name && <InfoRow label="Anne Adı" value={athlete.mother_name} />}
        </dl>
      </section>

      {/* ── Telefon & WhatsApp kartları ── */}
      <section className="glass-panel rounded-2xl p-4">
        <h2 className="mb-3 text-sm font-semibold text-slate-800">İletişim</h2>
        {athlete.phone && (
          <div className="mb-2">
            <PhoneCard
              label="Sporcu Telefonu"
              contactName={`${athlete.first_name} ${athlete.last_name} SLV`}
              phone={athlete.phone}
              waMessage=""
            />
          </div>
        )}
        {athlete.parent_phone && (
          <div className="mb-2">
            <PhoneCard
              label={`Veli — ${parentDisplayName(athlete)}`}
              contactName={`${parentDisplayName(athlete)} (${athlete.first_name}) SLV`}
              phone={athlete.parent_phone}
              waMessage=""
              showWelcome
            />
          </div>
        )}
        {!athlete.phone && !athlete.parent_phone && (
          <p className="text-xs text-brand-muted">Telefon numarası girilmemiş.</p>
        )}
      </section>

      {/* ── Aksiyonlar ── */}
      <section className="glass-panel rounded-2xl p-4">
        <h2 className="mb-3 text-sm font-semibold text-slate-800">İşlemler</h2>
        <div className="flex flex-col gap-2">
          {/* Tescil Fişi PDF */}
          <button
            type="button"
            onClick={() => void downloadTescil()}
            className="inline-flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2.5 text-xs font-medium text-blue-700 hover:bg-blue-100 transition"
          >
            <FileText className="h-4 w-4" />
            Tescil Fişi PDF İndir
          </button>

          {/* Pasife / aktife al */}
          <button
            type="button"
            disabled={saving}
            onClick={() => void toggleActive()}
            className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2.5 text-xs font-medium transition disabled:opacity-60 ${
              athlete.is_active
                ? 'border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100'
                : 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
            }`}
          >
            {athlete.is_active ? (
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
          <button
            type="button"
            onClick={() => setShowDeleteConfirm(true)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 px-3 py-2.5 text-xs font-medium text-rose-600 hover:bg-rose-50"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Kalıcı Olarak Sil
          </button>
        </div>
      </section>

      {/* ── Hata ── */}
      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
          {error}
        </div>
      )}

      {/* ── Kuşak geçmişi ── */}
      <section className="glass-panel rounded-2xl p-4">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-800">
          <Award className="h-4 w-4 text-brand-cyan" />
          Kuşak Geçmişi
        </h2>
        {beltHistory.length === 0 ? (
          <p className="text-xs text-brand-muted">Henüz sınav kaydı yok.</p>
        ) : (
          <div className="space-y-0">
            <div className="hidden sm:grid sm:grid-cols-4 gap-3 px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-brand-muted">
              <span>Tarih</span>
              <span>Sınav</span>
              <span>Önceki → Hedef</span>
              <span>Sonuç</span>
            </div>
            {beltHistory.map((h) => (
              <div
                key={h.id}
                className="grid grid-cols-2 sm:grid-cols-4 gap-3 rounded-xl border border-app-border bg-white px-3 py-2.5 text-xs mt-2"
              >
                <span className="text-brand-muted">
                  {h.exam_date ? new Date(h.exam_date).toLocaleDateString('tr-TR') : '—'}
                </span>
                <span className="font-medium text-slate-700">{h.exam_title}</span>
                <span className="text-slate-600">
                  {h.belt_before} → {h.target_belt}
                </span>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium inline-flex items-center justify-center ${resultColor(h.result)}`}>
                  {resultLabel(h.result)}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── Yarışma geçmişi ── */}
      <section className="glass-panel rounded-2xl p-4">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-800">
          <Trophy className="h-4 w-4 text-amber-500" />
          Yarışma Geçmişi
        </h2>
        {compHistory.length === 0 ? (
          <p className="text-xs text-brand-muted">Henüz yarışma kaydı yok.</p>
        ) : (
          <div className="space-y-2">
            {compHistory.map((c) => (
              <div
                key={c.id}
                className="flex items-center justify-between rounded-xl border border-app-border bg-white px-3 py-2.5 text-xs"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-slate-700">{c.comp_title}</p>
                  <p className="text-brand-muted">
                    {c.comp_date ? new Date(c.comp_date).toLocaleDateString('tr-TR') : '—'}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  {c.ranking && (
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${c.ranking.includes('1.lik') ? 'bg-amber-100 text-amber-700' : c.ranking.includes('2.lik') ? 'bg-slate-100 text-slate-700' : c.ranking.includes('3.lük') ? 'bg-orange-100 text-orange-700' : 'bg-app-bg-soft text-brand-muted'}`}>
                      <Trophy className="-ml-0.5 mr-0.5 inline h-3 w-3" />
                      {c.ranking}
                    </span>
                  )}
                  {c.weight_category && (
                    <span className="rounded-full bg-app-bg-soft px-2.5 py-1 text-[10px] font-medium text-brand-muted">
                      {c.weight_category}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── Sil onay diyaloğu ── */}
      <ConfirmDialog
        open={showDeleteConfirm}
        title="Sporcu Kalıcı Olarak Silinecek"
        message={`${athlete.first_name} ${athlete.last_name} tüm kayıtlarıyla birlikte silinecek. Bu işlem geri alınamaz.`}
        confirmLabel="Evet, Kalıcı Sil"
        cancelLabel="İptal"
        danger
        saving={saving}
        onConfirm={() => void handleDelete()}
        onCancel={() => setShowDeleteConfirm(false)}
      />
    </div>
  )
}
