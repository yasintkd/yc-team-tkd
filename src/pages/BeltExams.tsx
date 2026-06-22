import { useEffect, useMemo, useState, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { BELTS, findBeltIndex, getPossibleTargetBelts } from '../lib/belts'
import { CheckSquare, Square, Users, DollarSign, TrendingUp, Package, Trash2, Plus, X } from 'lucide-react'
import BeltBadge from '../components/BeltBadge'
import LoadingSkeleton from '../components/LoadingSkeleton'
import { BRAND } from '../lib/brand'
import logoUrl from '../assets/logo-team-taekwondo.png'

type Exam = {
  id: string
  title: string
  exam_date: string
  fee_amount: number
  status: 'planlandi' | 'tamamlandi'
  notes: string | null
}

type Participant = {
  id: string
  exam_id: string
  athlete_id: string
  belt_before: string
  target_belt: string
  fee_paid: boolean
  result: string
  athletes: { first_name: string; last_name: string } | { first_name: string; last_name: string }[] | null
  licensed: boolean
}

const CURRENT_YEAR = new Date().getFullYear()

export default function BeltExams() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [exams, setExams] = useState<Exam[]>([])
  const [selectedExamId, setSelectedExamId] = useState<string | null>(null)
  const [participants, setParticipants] = useState<Participant[]>([])
  const [saving, setSaving] = useState(false)

  const [title, setTitle] = useState('')
  const [examDate, setExamDate] = useState('')
  const [feeAmount, setFeeAmount] = useState('')
  const [editingExam, setEditingExam] = useState<Exam | null>(null)

  // Sporcu ekleme modal
  const [showAddModal, setShowAddModal] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<{ id: string; first_name: string; last_name: string; belt: string }[]>([])
  const [athletesCache, setAthletesCache] = useState<{ id: string; first_name: string; last_name: string; belt: string }[]>([])
  const addModalRef = useRef<HTMLDivElement>(null)

  const selectedExam = exams.find((e) => e.id === selectedExamId) ?? null

  const loadExams = async () => {
    const [planned, completed] = await Promise.all([
      supabase
        .from('belt_exams')
        .select('id, title, exam_date, fee_amount, status, notes')
        .eq('status', 'planlandi')
        .order('exam_date', { ascending: false }),
      supabase
        .from('belt_exams')
        .select('id, title, exam_date, fee_amount, status, notes')
        .eq('status', 'tamamlandi')
        .order('exam_date', { ascending: false })
        .limit(2),
    ])
    if (planned.error) throw planned.error
    if (completed.error) throw completed.error
    const merged = [...(planned.data ?? []), ...(completed.data ?? [])]
    setExams(merged as Exam[])
  }

  const loadParticipants = async (examId: string) => {
    const { data, error: qErr } = await supabase
      .from('belt_exam_participants')
      .select(
        'id, exam_id, athlete_id, belt_before, target_belt, fee_paid, result, athletes ( first_name, last_name )',
      )
      .eq('exam_id', examId)
      .order('created_at')
    if (qErr) throw qErr
    const raw = (data ?? []) as (Participant & { athletes: any })[]
    const athleteIds = raw.map((p) => p.athlete_id)
    let licensedSet = new Set<string>()
    if (athleteIds.length > 0) {
      const { data: licData } = await supabase
        .from('athlete_licenses')
        .select('athlete_id')
        .in('athlete_id', athleteIds)
        .eq('year', CURRENT_YEAR)
      if (licData) licensedSet = new Set(licData.map((l: any) => l.athlete_id))
    }
    setParticipants(raw.map((p) => ({ ...p, licensed: licensedSet.has(p.athlete_id) })))
  }

  const loadAll = async () => {
    setLoading(true)
    setError(null)
    try {
      await Promise.all([loadExams()])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Yüklenemedi.')
    }
    setLoading(false)
  }

  useEffect(() => {
    void loadAll()
  }, [])

  useEffect(() => {
    if (!selectedExamId) {
      setParticipants([])
      return
    }
    void loadParticipants(selectedExamId).catch((err) => {
      setError(err instanceof Error ? err.message : 'Katılımcılar yüklenemedi.')
    })
  }, [selectedExamId])


  const startEdit = (exam: Exam) => {
    setEditingExam(exam)
    setTitle(exam.title)
    setExamDate(exam.exam_date)
    setFeeAmount(String(exam.fee_amount))
    setError(null)
  }

  const cancelEdit = () => {
    setEditingExam(null)
    setTitle('')
    setExamDate('')
    setFeeAmount('')
    setError(null)
  }

  const submitExam = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim() || !examDate) return
    setSaving(true)
    setError(null)

    if (editingExam) {
      const { error: upErr } = await supabase
        .from('belt_exams')
        .update({
          title: title.trim(),
          exam_date: examDate,
          fee_amount: feeAmount ? parseFloat(feeAmount) : 0,
        })
        .eq('id', editingExam.id)
      if (upErr) { setError(upErr.message); setSaving(false); return }
      setMessage('Sınav güncellendi.')
      cancelEdit()
      await loadExams()
      setSaving(false)
      return
    }

    // Yeni sınav — tüm uygun sporcuları otomatik ekle
    const { data: inserted, error: insErr } = await supabase
      .from('belt_exams')
      .insert({
        title: title.trim(),
        exam_date: examDate,
        fee_amount: feeAmount ? parseFloat(feeAmount) : 0,
      })
      .select('id')
      .single()
    if (insErr) { setError(insErr.message); setSaving(false); return }

    const newExamId = inserted!.id

    const { data: allAthletes } = await supabase
      .from('athletes')
      .select('id, belt, first_name, last_name')
      .eq('is_active', true)

    const eligible = (allAthletes ?? []).filter((a) => {
      const targets = getPossibleTargetBelts(a.belt)
      return targets.length > 0
    })

    if (eligible.length > 0) {
      const { error: batchErr } = await supabase
        .from('belt_exam_participants')
        .insert(
          eligible.map((a) => ({
            exam_id: newExamId,
            athlete_id: a.id,
            belt_before: a.belt,
            target_belt: getPossibleTargetBelts(a.belt)[0],
          })),
        )
      if (batchErr) { setError(batchErr.message); setSaving(false); return }
    }

    setTitle('')
    setExamDate('')
    setFeeAmount('')
    cancelEdit()
    await loadExams()
    setSelectedExamId(newExamId)
    setMessage(
      `Sınav oluşturuldu. ${eligible.length} sporcu otomatik listeye eklendi.`,
    )
    setSaving(false)
  }

  const deleteExam = async (exam: Exam) => {
    if (exam.status === 'tamamlandi') return
    if (!window.confirm(`"${exam.title}" sınavını silmek istediğinize emin misiniz? Tüm katılımcı kayıtları da silinecek.`)) return
    setSaving(true)
    setError(null)
    await supabase.from('belt_exam_participants').delete().eq('exam_id', exam.id)
    const { error: delErr } = await supabase.from('belt_exams').delete().eq('id', exam.id)
    if (delErr) { setError(delErr.message); setSaving(false); return }
    if (selectedExamId === exam.id) {
      setSelectedExamId(null)
      setEditingExam(null)
    }
    cancelEdit()
    await loadExams()
    setSaving(false)
  }

  const updateTargetBelt = async (participantId: string, targetBelt: string) => {
    setError(null)
    const { error: upErr } = await supabase
      .from('belt_exam_participants')
      .update({ target_belt: targetBelt })
      .eq('id', participantId)
    if (upErr) setError(upErr.message)
    else setParticipants((prev) => prev.map((p) => (p.id === participantId ? { ...p, target_belt: targetBelt } : p)))
  }

  const toggleFeePaid = async (participantId: string, current: boolean) => {
    setError(null)
    const { error: upErr } = await supabase
      .from('belt_exam_participants')
      .update({ fee_paid: !current })
      .eq('id', participantId)
    if (upErr) setError(upErr.message)
    else setParticipants((prev) => prev.map((p) => (p.id === participantId ? { ...p, fee_paid: !current } : p)))
  }

  const removeParticipant = async (participantId: string) => {
    if (!window.confirm('Bu sporcuyu sınav listesinden çıkarmak istediğinize emin misiniz?')) return
    setError(null)
    const { error: delErr } = await supabase
      .from('belt_exam_participants')
      .delete()
      .eq('id', participantId)
    if (delErr) setError(delErr.message)
    else setParticipants((prev) => prev.filter((p) => p.id !== participantId))
  }

  const promotePassed = async () => {
    if (!selectedExamId) return
    setSaving(true)
    setError(null)
    setMessage(null)

    // Vize kontrolü
    const unlicensed = participants.filter((p) => !p.licensed)
    if (unlicensed.length > 0) {
      setError(
        `Vizesiz sporcu var: ${unlicensed.map((p) => athleteName(p)).join(', ')}. Sınav tamamlanamaz.`,
      )
      setSaving(false)
      return
    }

    // Ödenmemiş ücret kontrolü
    const unpaid = participants.filter((p) => !p.fee_paid)
    if (unpaid.length > 0) {
      setError(
        `Sınav ücreti ödenmemiş sporcu var: ${unpaid.map((p) => athleteName(p)).join(', ')}.`,
      )
      setSaving(false)
      return
    }

    if (participants.length === 0) {
      setError('Sınavda sporcu yok.')
      setSaving(false)
      return
    }

    // Tüm katılımcıları geçti olarak işaretle
    for (const p of participants) {
      const { error: upErr } = await supabase
        .from('belt_exam_participants')
        .update({ result: 'gecti' })
        .eq('id', p.id)
      if (upErr) { setError(upErr.message); setSaving(false); return }
    }

    // Kuşakları yükselt
    for (const p of participants) {
      const { error: upAthleteErr } = await supabase
        .from('athletes')
        .update({ belt: p.target_belt })
        .eq('id', p.athlete_id)
      if (upAthleteErr) { setError(upAthleteErr.message); setSaving(false); return }
    }

    // Sınavı tamamla
    const { error: examErr } = await supabase
      .from('belt_exams')
      .update({ status: 'tamamlandi' })
      .eq('id', selectedExamId)

    if (examErr) setError(examErr.message)
    else {
      setMessage(`${participants.length} sporcu bir üst kuşağa yükseltildi.`)
      await loadExams()
      await loadParticipants(selectedExamId)
    }
    setSaving(false)
  }

  const athleteName = (p: Participant) => {
    const a = Array.isArray(p.athletes) ? p.athletes[0] : p.athletes
    return a ? `${a.first_name} ${a.last_name}` : p.athlete_id
  }

  // ── PNG export (ortak) ──────────────────────────────────────────
  const examPngSorted = useMemo(() => {
    return [...participants].sort((a, b) => {
      const aWhite = a.belt_before.toLowerCase().startsWith('beyaz')
      const bWhite = b.belt_before.toLowerCase().startsWith('beyaz')
      if (aWhite && !bWhite) return -1
      if (!aWhite && bWhite) return 1
      return athleteName(a).localeCompare(athleteName(b))
    })
  }, [participants])

  const exportPng = async (type: 'attendance' | 'result') => {
    if (!selectedExam) return

    const sorted = examPngSorted
    const isAttendance = type === 'attendance'

    const rows = sorted
      .map(
        (p, i) => isAttendance
          ? `
        <tr>
          <td class="num">${i + 1}</td>
          <td class="name">${escapeHtml(athleteName(p))}</td>
          <td class="belt">${escapeHtml(p.belt_before)}</td>
          <td class="fee">${p.fee_paid ? 'Ödendi' : 'Ödemedi'}</td>
          <td class="check"><span class="check-box">☐</span></td>
        </tr>`
          : `
        <tr>
          <td class="num">${i + 1}</td>
          <td class="name">${escapeHtml(athleteName(p))}</td>
          <td class="belt">${escapeHtml(p.target_belt)}</td>
        </tr>`,
      )
      .join('')

    const colTags = isAttendance
      ? '<th class="num-th">#</th><th class="name-th">Sporcu</th><th class="belt-th">Mevcut Kuşak</th><th class="fee-th">Ücret</th><th class="check-th">Katılım</th>'
      : '<th class="num-th">#</th><th class="name-th">Sporcu</th><th class="belt-th">Geçtiği Kuşak</th>'

    const subtitle = isAttendance
      ? `${new Date(selectedExam.exam_date).toLocaleDateString('tr-TR')} · ${participants.length} Katılımcı`
      : `${new Date(selectedExam.exam_date).toLocaleDateString('tr-TR')} · ${participants.length} Sporcu yükseldi`

    const body = `
      <div class="header">
        <img src="${logoUrl}" alt="${escapeHtml(BRAND.name)}" class="logo" />
        <h1>${escapeHtml(selectedExam.title)}</h1>
        <p class="subtitle">${escapeHtml(subtitle)}</p>
      </div>
      <table>
        <thead><tr>${colTags}</tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <p class="footer">Oluşturulma: ${escapeHtml(new Date().toLocaleString('tr-TR'))}</p>
    `

    const iframe = document.createElement('iframe')
    iframe.style.cssText =
      'position:fixed;left:-10000px;top:0;width:800px;height:10000px;border:0;visibility:hidden;'
    document.body.appendChild(iframe)

    const doc = iframe.contentDocument
    if (!doc) {
      document.body.removeChild(iframe)
      setError('Görsel oluşturulamadı.')
      return
    }

    doc.open()
    doc.write(
      `<!DOCTYPE html>
<html lang="tr"><head><meta charset="utf-8"/><style>${pngStyles}</style></head>
<body>${body}</body></html>`,
    )
    doc.close()

    try {
      const images = Array.from(doc.images)
      if (images.length > 0) {
        await Promise.all(
          images.map(
            (img) =>
              new Promise<void>((resolve) => {
                if (img.complete) resolve()
                else { img.onload = () => resolve(); img.onerror = () => resolve() }
              }),
          ),
        )
      }
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))

      const html2canvas = (await import('html2canvas')).default
      iframe.style.width = '800px'
      iframe.style.height = `${doc.body.scrollHeight}px`

      const canvas = await html2canvas(doc.body, {
        backgroundColor: '#e3f0fa',
        scale: 2,
        useCORS: true,
        logging: false,
        width: 800,
        windowWidth: 800,
        height: doc.body.scrollHeight,
        windowHeight: doc.body.scrollHeight,
      })

      const link = document.createElement('a')
      const suffix = isAttendance ? 'yoklama-listesi' : 'sonuc'
      link.download = `${safeFilename(selectedExam.title)}-${suffix}.png`
      link.href = canvas.toDataURL('image/png')
      link.click()
    } finally {
      document.body.removeChild(iframe)
    }
  }

  function escapeHtml(text: string | number) {
    return String(text)
      .replace(/&/g, '&')
      .replace(/</g, '<')
      .replace(/>/g, '>')
      .replace(/"/g, '"')
  }

  function safeFilename(name: string) {
    return name
      .trim()
      .replace(/[^\p{L}\p{N}\s-]/gu, '')
      .replace(/\s+/g, '-')
      .slice(0, 60) || 'rapor'
  }

  const pngStyles = `
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
      background: #e3f0fa;
      padding: 40px;
      width: 800px;
    }
    .header { text-align: center; margin-bottom: 28px; }
    .logo { max-width: 220px; height: auto; display: block; margin: 0 auto; }
    h1 {
      margin-top: 16px;
      font-size: 22px;
      font-weight: 700;
      color: #2c2c34;
    }
    .subtitle {
      margin-top: 4px;
      font-size: 13px;
      color: #5a6b7d;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 2px 12px rgba(0,0,0,0.06);
    }
    thead { background: #b21f24; }
    th {
      padding: 12px 16px;
      text-align: left;
      font-size: 12px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #ffffff;
    }
    .num-th { width: 48px; text-align: center; }
    .name-th { }
    .belt-th { }
    .fee-th { }
    .check-th { width: 60px; text-align: center; }
    tbody tr {
      background: #ffffff;
      border-bottom: 1px solid #eef6fc;
    }
    tbody tr:last-child { border-bottom: none; }
    tbody tr:nth-child(even) { background: #f8fafd; }
    td {
      padding: 10px 16px;
      font-size: 14px;
      color: #2c2c34;
    }
    td.num {
      text-align: center;
      font-weight: 700;
      color: #b21f24;
      font-size: 13px;
    }
    td.name { font-weight: 600; }
    td.fee { font-size: 13px; }
    td.check { text-align: center; }
    .check-box { font-size: 18px; color: #5a6b7d; }
    td.target { font-size: 13px; color: #5a6b7d; }
    .footer {
      margin-top: 24px;
      text-align: center;
      font-size: 11px;
      color: #8a9db0;
    }
  `

  // ── Sporcu ekleme modal ──────────────────────────────────────────

  const openAddModal = async () => {
    if (!selectedExamId) return
    setError(null)
    // Tüm aktif sporcuları cache'e al (bir kere)
    if (athletesCache.length === 0) {
      const { data } = await supabase
        .from('athletes')
        .select('id, first_name, last_name, belt')
        .eq('is_active', true)
        .order('first_name')
      setAthletesCache((data ?? []) as any[])
    }
    setSearchQuery('')
    setSearchResults([])
    setShowAddModal(true)
  }

  const addAthleteToExam = async (athlete: { id: string; first_name: string; last_name: string; belt: string }) => {
    if (!selectedExamId) return
    const targets = getPossibleTargetBelts(athlete.belt)
    if (targets.length === 0) return

    const { error: insErr } = await supabase
      .from('belt_exam_participants')
      .insert({
        exam_id: selectedExamId,
        athlete_id: athlete.id,
        belt_before: athlete.belt,
        target_belt: targets[0],
      })
    if (insErr) {
      setError(insErr.message)
      return
    }
    // Katılımcıları yeniden yükle
    await loadParticipants(selectedExamId)
    setSearchResults((prev) => prev.filter((a) => a.id !== athlete.id))
    setSearchQuery('')
  }

  // Arama filtresi: athletesCache'te arama yap, zaten listedekileri çıkar
  const handleSearch = (q: string) => {
    setSearchQuery(q)
    if (!q.trim()) {
      setSearchResults([])
      return
    }
    const lower = q.toLowerCase()
    const alreadyIn = new Set(participants.map((p) => p.athlete_id))
    const result = athletesCache.filter(
      (a) =>
        !alreadyIn.has(a.id) &&
        getPossibleTargetBelts(a.belt).length > 0 &&
        (`${a.first_name} ${a.last_name}`.toLowerCase().includes(lower) ||
          a.first_name.toLowerCase().includes(lower) ||
          a.last_name.toLowerCase().includes(lower)),
    )
    setSearchResults(result.slice(0, 20))
  }

  // Ödeme özeti
  const feeSummary = useMemo(() => {
    const paidCount = participants.filter((p) => p.fee_paid).length
    const total = selectedExam ? paidCount * selectedExam.fee_amount : 0
    return { paidCount, total }
  }, [participants, selectedExam?.id])

  // Sıralı katılımcı listesi — kuşak sırası (beyaz→siyah), aynı kuşakta alfabetik
  const sortedParticipants = useMemo(() => {
    return [...participants].sort((a, b) => {
      const ia = findBeltIndex(a.belt_before)
      const ib = findBeltIndex(b.belt_before)
      if (ia !== ib) return ia - ib
      return athleteName(a).localeCompare(athleteName(b))
    })
  }, [participants])

  // Sipariş özeti — her hedef kuşaktan kaç tane gerekli
  const beltOrderSummary = useMemo(() => {
    const counts = new Map<string, number>()
    for (const p of participants) {
      counts.set(p.target_belt, (counts.get(p.target_belt) ?? 0) + 1)
    }
    return [...counts.entries()]
      .sort(([a], [b]) => {
        const ia = BELTS.indexOf(a as any)
        const ib = BELTS.indexOf(b as any)
        return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib)
      })
  }, [participants])

  return (
    <div className="space-y-6">
      {/* ── Sınav formu (yeni / düzenle) ── */}
      <section className="glass-panel rounded-2xl p-4">
        <h2 className="text-sm font-semibold">
          {editingExam ? 'Sınavı Düzenle' : 'Yeni Kuşak Sınavı'}
        </h2>
        <p className="mt-1 text-xs text-brand-muted">
          {editingExam
            ? 'Sınav bilgilerini güncelleyin.'
            : 'Sınav listesi oluşturun; sonuçları girince geçenleri otomatik yükseltin.'}
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
        <form className="mt-4 grid gap-3 sm:grid-cols-3" onSubmit={submitExam}>
          <div className="space-y-1 text-xs">
            <label className="text-slate-600">Sınav adı</label>
            <input
              className="input-field"
              placeholder="Örn: 2026 Ocak Dönemi"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              autoFocus={!!editingExam}
            />
          </div>
          <div className="space-y-1 text-xs">
            <label className="text-slate-600">Tarih</label>
            <input
              type="date"
              className="input-field"
              value={examDate}
              onChange={(e) => setExamDate(e.target.value)}
            />
          </div>
          <div className="space-y-1 text-xs">
            <label className="text-slate-600">Ücret (₺)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              className="input-field"
              placeholder="Örn: 500"
              value={feeAmount}
              onChange={(e) => setFeeAmount(e.target.value)}
            />
          </div>
          <div className="sm:col-span-3 flex items-center gap-2">
            <button
              type="submit"
              disabled={saving || !title.trim() || !examDate}
              className="btn-primary"
            >
              {saving
                ? 'Kaydediliyor...'
                : editingExam
                  ? 'Güncelle'
                  : 'Sınav Oluştur'}
            </button>
            {editingExam && (
              <button
                type="button"
                onClick={cancelEdit}
                className="rounded-lg border border-app-border bg-white px-4 py-2.5 text-xs font-medium text-slate-600 hover:bg-app-bg-soft"
              >
                İptal
              </button>
            )}
          </div>
        </form>
</section>

      {/* ── Sınav listesi ── */}
      <section className="glass-panel rounded-2xl p-4">
        <h2 className="text-sm font-semibold">Sınav Listeleri</h2>
        {loading ? (
          <LoadingSkeleton variant="list-item" count={4} />
        ) : exams.length === 0 ? (
          <p className="mt-3 text-xs text-brand-muted">Henüz sınav yok.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {exams.map((exam) => (
              <li key={exam.id}>
                <div
                  className={`w-full rounded-xl border text-left text-sm transition ${
                    selectedExamId === exam.id
                      ? 'border-brand-red bg-brand-red/5'
                      : 'border-app-border bg-white hover:bg-app-bg-soft'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => setSelectedExamId(exam.id)}
                    className="flex w-full items-center justify-between gap-2 px-3 pt-3 pb-2"
                  >
                    <span className="font-medium">{exam.title}</span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                        exam.status === 'tamamlandi'
                          ? 'bg-sky-100 text-sky-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {exam.status === 'tamamlandi' ? 'Tamamlandı' : 'Planlandı'}
                    </span>
                  </button>
                  <div className="flex items-center justify-between px-3 pb-3">
                    <p className="text-xs text-brand-muted">
                      {new Date(exam.exam_date).toLocaleDateString('tr-TR')}
                      {exam.fee_amount > 0 && ` • ${exam.fee_amount} ₺`}
                    </p>
                    {exam.status === 'planlandi' && (
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); startEdit(exam) }}
                          className="rounded-lg border border-app-border bg-white px-2 py-1 text-[11px] font-medium text-slate-600 hover:bg-app-bg-soft"
                        >
                          Düzenle
                        </button>
                        <button
                          type="button"
                          disabled={saving}
                          onClick={(e) => { e.stopPropagation(); void deleteExam(exam) }}
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

      {/* ── Sınav detayı ── */}
      {selectedExam && (
        <section className="glass-panel rounded-2xl p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-sm font-semibold">{selectedExam.title}</h2>
              <p className="text-xs text-brand-muted">
                {new Date(selectedExam.exam_date).toLocaleDateString('tr-TR')} •{' '}
                {participants.length} katılımcı
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {participants.length > 0 && (
                <button
                  type="button"
                  onClick={() => void exportPng('attendance')}
                  className="inline-flex items-center gap-1 rounded-lg border border-app-border bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-app-bg-soft"
                >
                  Yoklama Listesi PNG
                </button>
              )}
              {participants.length > 0 && selectedExam.status === 'tamamlandi' && (
                <button
                  type="button"
                  onClick={() => void exportPng('result')}
                  className="inline-flex items-center gap-1 rounded-lg border border-app-border bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-app-bg-soft"
                >
                  Sonuç PNG
                </button>
              )}
              {selectedExam.status === 'planlandi' && (
                <>
                  <button
                    type="button"
                    onClick={() => void openAddModal()}
                    className="inline-flex items-center gap-1 rounded-lg border border-app-border bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-app-bg-soft"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Sporcu Ekle
                  </button>
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => void promotePassed()}
                    className="btn-primary shrink-0 text-xs"
                  >
                    Geçenleri Yükselt
                  </button>
                </>
              )}
            </div>
          </div>

          {/* ── Ödeme özet kartı ── */}
          {selectedExam.fee_amount > 0 && (
            <div className="mt-4 rounded-xl border border-brand-cyan/20 bg-brand-cyan/5 p-3">
              <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs">
                <div className="flex items-center gap-1.5">
                  <DollarSign className="h-3.5 w-3.5 text-brand-cyan" />
                  <span className="text-slate-600">Sınav ücreti:</span>
                  <span className="font-semibold text-slate-800">
                    {selectedExam.fee_amount} ₺
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Users className="h-3.5 w-3.5 text-brand-cyan" />
                  <span className="text-slate-600">Ödeyen:</span>
                  <span className="font-semibold text-emerald-700">
                    {feeSummary.paidCount}
                  </span>
                  <span className="text-brand-muted">/ {participants.length}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <TrendingUp className="h-3.5 w-3.5 text-brand-cyan" />
                  <span className="text-slate-600">Toplam tahsilat:</span>
                  <span className="font-semibold text-slate-800">
                    {feeSummary.total} ₺
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* ── Sipariş kartı ── */}
          {beltOrderSummary.length > 0 && (
            <div className="mt-4 rounded-xl border border-amber-200/60 bg-amber-50/70 p-3">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-900">
                <Package className="h-3.5 w-3.5" />
                Kuşak Siparişi
                <span className="font-normal text-amber-700">
                  — {beltOrderSummary.reduce((s, [,c]) => s + c, 0)} adet kuşak sipariş edilmeli
                </span>
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                {beltOrderSummary.map(([belt, count]) => (
                  <span
                    key={belt}
                    className="inline-flex items-center gap-1"
                  >
                    <BeltBadge belt={belt} size="sm" />
                    <span className="ml-0.5 font-bold">×{count}</span>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* ── Katılımcı listesi ── */}
          {participants.length === 0 ? (
            <p className="mt-4 text-xs text-brand-muted">Henüz katılımcı yok.</p>
          ) : (
            <>
              {/* Mobil: kart */}
              <ul className="mt-4 space-y-2 md:hidden">
                {sortedParticipants.map((p) => {
                  const targets = getPossibleTargetBelts(p.belt_before)
                  return (
                    <li
                      key={p.id}
                      className="rounded-xl border border-app-border bg-white p-3"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-medium">{athleteName(p)}</p>
                      </div>
                      <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <span className="text-brand-muted">Mevcut:</span>{' '}
                          <BeltBadge belt={p.belt_before} size="sm" />
                        </div>
                        <div>
                          <span className="text-brand-muted">Hedef:</span>{' '}
                          <BeltBadge belt={p.target_belt} size="sm" />
                        </div>
                      </div>

                      {/* Hedef kuşak seçimi */}
                      {selectedExam.status === 'planlandi' && targets.length > 1 && (
                        <div className="mt-2">
                          <select
                            className="input-field py-1.5 text-xs"
                            value={p.target_belt}
                            onChange={(e) => void updateTargetBelt(p.id, e.target.value)}
                          >
                            {targets.map((t) => (
                              <option key={t} value={t}>
                                {t}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}

                      {/* Ödeme tik */}
                      {selectedExam.fee_amount > 0 && (
                        <button
                          type="button"
                          onClick={() => void toggleFeePaid(p.id, p.fee_paid)}
                          className={`mt-2 inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs transition ${
                            p.fee_paid
                              ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                              : 'border-app-border bg-white text-slate-500 hover:bg-emerald-50'
                          }`}
                        >
                          {p.fee_paid ? (
                            <CheckSquare className="h-3.5 w-3.5" />
                          ) : (
                            <Square className="h-3.5 w-3.5" />
                          )}
                          {p.fee_paid ? 'Ücret ödendi' : 'Ücret ödenmedi'}
                        </button>
                      )}

                      {/* Çıkart */}
                      {selectedExam.status === 'planlandi' && (
                        <div className="mt-3 flex justify-end">
                          <button
                            type="button"
                            onClick={() => void removeParticipant(p.id)}
                            className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-xs font-medium text-rose-700 hover:bg-rose-100"
                          >
                            <Trash2 className="h-3 w-3" />
                            Listeden Çıkart
                          </button>
                        </div>
                      )}
                    </li>
                  )
                })}
              </ul>

              <div className="mt-4 hidden overflow-x-auto rounded-xl border border-app-border bg-white md:block">
              {/* Masaüstü: tablo */}
                <table className="w-full min-w-[900px] text-left text-xs">
                  <thead className="bg-app-bg-soft text-brand-muted">
                    <tr>
                      <th className="px-3 py-2">Sporcu</th>
                      <th className="px-3 py-2">Mevcut</th>
                      <th className="px-3 py-2">Hedef</th>
                      <th className="px-3 py-2">Vize</th>
                      <th className="px-3 py-2">Ücret</th>
                      <th className="px-3 py-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedParticipants.map((p) => {
                      const targets = getPossibleTargetBelts(p.belt_before)
                      return (
                        <tr key={p.id} className="border-t border-app-border">
                          <td className="px-3 py-2 font-medium text-slate-800">
                            {athleteName(p)}
                          </td>
                          <td className="px-3 py-2">
                            <BeltBadge belt={p.belt_before} size="sm" />
                          </td>
                          <td className="px-3 py-2">
                            {selectedExam.status === 'planlandi' &&
                            targets.length > 1 ? (
                              <select
                                className="input-field max-w-[220px] py-1 text-xs"
                                value={p.target_belt}
                                onChange={(e) =>
                                  void updateTargetBelt(p.id, e.target.value)
                                }
                              >
                                {targets.map((t) => (
                                  <option key={t} value={t}>
                                    {t}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <BeltBadge belt={p.target_belt} size="sm" />
                            )}
                          </td>
                          <td className="px-3 py-2">
                            <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                              p.licensed
                                ? 'bg-emerald-100 text-emerald-700'
                                : 'bg-amber-100 text-amber-700'
                            }`}>
                              {p.licensed ? 'Vizeli' : 'Vizesiz'}
                            </span>
                          </td>
                          <td className="px-3 py-2">
                            {selectedExam.fee_amount > 0 && (
                              <button
                                type="button"
                                onClick={() =>
                                  void toggleFeePaid(p.id, p.fee_paid)
                                }
                                className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs transition ${
                                  p.fee_paid
                                    ? 'text-emerald-700 hover:bg-emerald-50'
                                    : 'text-slate-500 hover:bg-emerald-50'
                                }`}
                              >
                                {p.fee_paid ? (
                                  <CheckSquare className="h-3.5 w-3.5" />
                                ) : (
                                  <Square className="h-3.5 w-3.5" />
                                )}
                                {p.fee_paid ? 'Ödendi' : 'Ödenmedi'}
                              </button>
                            )}
                          </td>
                          <td className="px-3 py-2">
                            {selectedExam.status === 'planlandi' && (
                              <button
                                type="button"
                                onClick={() => void removeParticipant(p.id)}
                                className="inline-flex items-center gap-1 rounded-lg p-1.5 text-rose-500 hover:bg-rose-50 hover:text-rose-700"
                                title="Listeden çıkart"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {/* Kuşak sırası */}
          <div className="mt-4 rounded-xl border border-dashed border-app-border bg-app-bg-soft/60 p-3 text-[11px] text-brand-muted">
            <p className="font-medium text-slate-600">Kuşak sırası</p>
            <p className="mt-1">{BELTS.join(' → ')}</p>
          </div>
        </section>
      )}

      {/* ── Sporcu Ekleme Modal ── */}
      {showAddModal && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 pt-[15vh]"
          onClick={() => setShowAddModal(false)}
        >
          <div
            ref={addModalRef}
            className="mx-4 w-full max-w-md rounded-2xl bg-white p-4 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">Sporcu Ekle</h3>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <input
              className="input-field mt-3 w-full"
              placeholder="İsim ara..."
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              autoFocus
            />
            <div className="mt-3 max-h-72 space-y-1 overflow-y-auto">
              {searchQuery && searchResults.length === 0 && (
                <p className="py-4 text-center text-xs text-brand-muted">
                  {athletesCache.length === 0
                    ? 'Sporcu yükleniyor...'
                    : searchQuery.trim()
                      ? 'Eşleşen sporcu yok.'
                      : 'Arama yapmak için yazın.'}
                </p>
              )}
              {searchResults.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => void addAthleteToExam(a)}
                  className="flex w-full items-center justify-between gap-2 rounded-xl border border-app-border px-3 py-2 text-left text-xs hover:bg-app-bg-soft"
                >
                  <span className="font-medium text-slate-800">
                    {a.first_name} {a.last_name}
                  </span>
                  <BeltBadge belt={a.belt} size="sm" />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
