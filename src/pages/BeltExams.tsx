import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { BELTS, beltStyle, findBeltIndex, getPossibleTargetBelts } from '../lib/belts'
import { CheckSquare, Square, Users, DollarSign, TrendingUp, Package, Trash2 } from 'lucide-react'

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
  athletes: { first_name: string; last_name: string } | { first_name: string; last_name: string }[] | null
}

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

  const selectedExam = exams.find((e) => e.id === selectedExamId) ?? null

  const loadExams = async () => {
    const { data, error: qErr } = await supabase
      .from('belt_exams')
      .select('id, title, exam_date, fee_amount, status, notes')
      .order('exam_date', { ascending: false })
    if (qErr) throw qErr
    setExams((data ?? []) as Exam[])
  }

  const loadParticipants = async (examId: string) => {
    const { data, error: qErr } = await supabase
      .from('belt_exam_participants')
      .select(
        'id, exam_id, athlete_id, belt_before, target_belt, fee_paid, athletes ( first_name, last_name )',
      )
      .eq('exam_id', examId)
      .order('created_at')
    if (qErr) throw qErr
    setParticipants((data ?? []) as Participant[])
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

    // Ödenmemiş ücret kontrolü
    const unpaid = participants.filter((p) => !p.fee_paid)
    if (unpaid.length > 0) {
      setError(
        `Sınav ücreti ödenmemiş sporcu var: ${unpaid.map((p) => athleteName(p)).join(', ')}. Tüm geçenlerin ücretini ödeyin.`,
      )
      setSaving(false)
      return
    }

    if (participants.length === 0) {
      setError('Sınavda sporcu yok.')
      setSaving(false)
      return
    }

    for (const p of participants) {
      const { error: upAthleteErr } = await supabase
        .from('athletes')
        .update({ belt: p.target_belt })
        .eq('id', p.athlete_id)
      if (upAthleteErr) {
        setError(upAthleteErr.message)
        setSaving(false)
        return
      }
    }

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

  // Ödeme özeti
  const feeSummary = useMemo(() => {
    const paidCount = participants.filter((p) => p.fee_paid).length
    const total = selectedExam ? paidCount * selectedExam.fee_amount : 0
    return { paidCount, total }
  }, [participants, selectedExam])

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
          <p className="mt-3 text-xs text-brand-muted">Yükleniyor...</p>
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
            {selectedExam.status === 'planlandi' && (
              <button
                type="button"
                disabled={saving}
                onClick={() => void promotePassed()}
                className="btn-primary shrink-0 text-xs"
              >
                Geçenleri Yükselt
              </button>
            )}
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
                    className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold ${beltStyle(belt).badge}`}
                  >
                    <span className={`h-1.5 w-1.5 rounded-full ${beltStyle(belt).dot}`} />
                    {belt}
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
                          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${beltStyle(p.belt_before).badge}`}>
                            <span className={`h-1.5 w-1.5 rounded-full ${beltStyle(p.belt_before).dot}`} />
                            {p.belt_before}
                          </span>
                        </div>
                        <div>
                          <span className="text-brand-muted">Hedef:</span>{' '}
                          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${beltStyle(p.target_belt).badge}`}>
                            <span className={`h-1.5 w-1.5 rounded-full ${beltStyle(p.target_belt).dot}`} />
                            {p.target_belt}
                          </span>
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

              {/* Masaüstü: tablo */}
              <div className="mt-4 hidden overflow-x-auto rounded-xl border border-app-border bg-white md:block">
                <table className="w-full min-w-[800px] text-left text-xs">
                  <thead className="bg-app-bg-soft text-brand-muted">
                    <tr>
                      <th className="px-3 py-2">Sporcu</th>
                      <th className="px-3 py-2">Mevcut</th>
                      <th className="px-3 py-2">Hedef</th>
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
                            <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${beltStyle(p.belt_before).badge}`}>
                              <span className={`h-1.5 w-1.5 rounded-full ${beltStyle(p.belt_before).dot}`} />
                              {p.belt_before}
                            </span>
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
                              <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${beltStyle(p.target_belt).badge}`}>
                                <span className={`h-1.5 w-1.5 rounded-full ${beltStyle(p.target_belt).dot}`} />
                                {p.target_belt}
                              </span>
                            )}
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
    </div>
  )
}
