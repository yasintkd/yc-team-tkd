import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { BELTS, getNextBelt } from '../lib/belts'

type Exam = {
  id: string
  title: string
  exam_date: string
  status: 'planlandi' | 'tamamlandi'
  notes: string | null
}

type Participant = {
  id: string
  exam_id: string
  athlete_id: string
  belt_before: string
  target_belt: string
  result: 'bekliyor' | 'gecti' | 'kaldi'
  athletes: { first_name: string; last_name: string } | { first_name: string; last_name: string }[] | null
}

type AthleteOption = {
  id: string
  first_name: string
  last_name: string
  belt: string
}

export default function BeltExams() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [exams, setExams] = useState<Exam[]>([])
  const [selectedExamId, setSelectedExamId] = useState<string | null>(null)
  const [participants, setParticipants] = useState<Participant[]>([])
  const [athletes, setAthletes] = useState<AthleteOption[]>([])
  const [saving, setSaving] = useState(false)

  const [title, setTitle] = useState('')
  const [examDate, setExamDate] = useState('')
  const [addAthleteId, setAddAthleteId] = useState('')

  const selectedExam = exams.find((e) => e.id === selectedExamId) ?? null

  const loadExams = async () => {
    const { data, error: qErr } = await supabase
      .from('belt_exams')
      .select('id, title, exam_date, status, notes')
      .order('exam_date', { ascending: false })
    if (qErr) throw qErr
    setExams((data ?? []) as Exam[])
  }

  const loadAthletes = async () => {
    const { data, error: qErr } = await supabase
      .from('athletes')
      .select('id, first_name, last_name, belt')
      .eq('is_active', true)
      .order('last_name')
    if (qErr) throw qErr
    setAthletes((data ?? []) as AthleteOption[])
  }

  const loadParticipants = async (examId: string) => {
    const { data, error: qErr } = await supabase
      .from('belt_exam_participants')
      .select(
        'id, exam_id, athlete_id, belt_before, target_belt, result, athletes ( first_name, last_name )',
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
      await Promise.all([loadExams(), loadAthletes()])
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

  const participantAthleteIds = useMemo(
    () => new Set(participants.map((p) => p.athlete_id)),
    [participants],
  )

  const availableAthletes = useMemo(
    () =>
      athletes.filter((a) => {
        if (participantAthleteIds.has(a.id)) return false
        return getNextBelt(a.belt) !== null
      }),
    [athletes, participantAthleteIds],
  )

  const createExam = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim() || !examDate) return
    setSaving(true)
    setError(null)
    const { data, error: insErr } = await supabase
      .from('belt_exams')
      .insert({ title: title.trim(), exam_date: examDate })
      .select('id')
      .single()
    if (insErr) setError(insErr.message)
    else {
      setTitle('')
      setExamDate('')
      await loadExams()
      if (data?.id) setSelectedExamId(data.id)
    }
    setSaving(false)
  }

  const addParticipant = async () => {
    if (!selectedExamId || !addAthleteId) return
    const athlete = athletes.find((a) => a.id === addAthleteId)
    if (!athlete) return
    const next = getNextBelt(athlete.belt)
    if (!next) {
      setError('Bu sporcu zaten en üst kuşakta.')
      return
    }
    setSaving(true)
    setError(null)
    const { error: insErr } = await supabase.from('belt_exam_participants').insert({
      exam_id: selectedExamId,
      athlete_id: athlete.id,
      belt_before: athlete.belt,
      target_belt: next,
    })
    if (insErr) setError(insErr.message)
    else {
      setAddAthleteId('')
      await loadParticipants(selectedExamId)
    }
    setSaving(false)
  }

  const setResult = async (participantId: string, result: Participant['result']) => {
    if (!selectedExamId || selectedExam?.status === 'tamamlandi') return
    setError(null)
    const { error: upErr } = await supabase
      .from('belt_exam_participants')
      .update({ result })
      .eq('id', participantId)
    if (upErr) setError(upErr.message)
    else await loadParticipants(selectedExamId)
  }

  const promotePassed = async () => {
    if (!selectedExamId) return
    setSaving(true)
    setError(null)
    setMessage(null)

    const passed = participants.filter((p) => p.result === 'gecti')
    if (passed.length === 0) {
      setError('Yükseltilecek (geçti) sporcu yok.')
      setSaving(false)
      return
    }

    for (const p of passed) {
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
      setMessage(`${passed.length} sporcu bir üst kuşağa yükseltildi.`)
      await loadExams()
      await loadParticipants(selectedExamId)
      await loadAthletes()
    }
    setSaving(false)
  }

  const athleteName = (p: Participant) => {
    const a = Array.isArray(p.athletes) ? p.athletes[0] : p.athletes
    return a ? `${a.first_name} ${a.last_name}` : p.athlete_id
  }

  return (
    <div className="space-y-6">
      <section className="glass-panel rounded-2xl p-4">
        <h2 className="text-sm font-semibold">Yeni Kuşak Sınavı</h2>
        <p className="mt-1 text-xs text-brand-muted">
          Sınav listesi oluşturun; sonuçları girince geçenleri otomatik yükseltin.
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
        <form className="mt-4 grid gap-3 sm:grid-cols-2" onSubmit={createExam}>
          <div className="space-y-1 text-xs">
            <label className="text-slate-600">Sınav adı</label>
            <input
              className="input-field"
              placeholder="Örn: 2026 Bahar Kuşak Sınavı"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
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
          <div className="sm:col-span-2">
            <button type="submit" disabled={saving || !title.trim() || !examDate} className="btn-primary">
              Sınav Oluştur
            </button>
          </div>
        </form>
      </section>

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
                <button
                  type="button"
                  onClick={() => setSelectedExamId(exam.id)}
                  className={`w-full rounded-xl border px-3 py-3 text-left text-sm transition ${
                    selectedExamId === exam.id
                      ? 'border-brand-red bg-brand-red/5'
                      : 'border-app-border bg-white hover:bg-app-bg-soft'
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
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
                  </div>
                  <p className="mt-0.5 text-xs text-brand-muted">
                    {new Date(exam.exam_date).toLocaleDateString('tr-TR')}
                  </p>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

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

          {selectedExam.status === 'planlandi' && (
            <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-end">
              <div className="flex-1 space-y-1 text-xs">
                <label className="text-slate-600">Sporcu ekle</label>
                <select
                  className="input-field"
                  value={addAthleteId}
                  onChange={(e) => setAddAthleteId(e.target.value)}
                >
                  <option value="">Seçin</option>
                  {availableAthletes.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.first_name} {a.last_name} — {a.belt} → {getNextBelt(a.belt)}
                    </option>
                  ))}
                </select>
              </div>
              <button
                type="button"
                disabled={saving || !addAthleteId}
                onClick={() => void addParticipant()}
                className="rounded-lg border border-app-border bg-white px-4 py-2.5 text-xs font-medium text-slate-700 hover:bg-app-bg-soft"
              >
                Listeye Ekle
              </button>
            </div>
          )}

          {participants.length === 0 ? (
            <p className="mt-4 text-xs text-brand-muted">Henüz katılımcı yok.</p>
          ) : (
            <ul className="mt-4 space-y-2 md:hidden">
              {participants.map((p) => (
                <li key={p.id} className="rounded-xl border border-app-border bg-white p-3">
                  <p className="text-sm font-medium">{athleteName(p)}</p>
                  <p className="mt-0.5 text-xs text-brand-muted">
                    {p.belt_before} → {p.target_belt}
                  </p>
                  {selectedExam.status === 'planlandi' ? (
                    <div className="mt-3 grid grid-cols-3 gap-1">
                      {(['bekliyor', 'gecti', 'kaldi'] as const).map((r) => (
                        <button
                          key={r}
                          type="button"
                          onClick={() => void setResult(p.id, r)}
                          className={`min-h-[40px] rounded-lg text-[11px] font-medium ${
                            p.result === r
                              ? r === 'gecti'
                                ? 'bg-brand-cyan text-slate-900'
                                : r === 'kaldi'
                                  ? 'bg-rose-100 text-rose-800'
                                  : 'bg-amber-100 text-amber-900'
                              : 'border border-app-border bg-app-bg-soft text-slate-600'
                          }`}
                        >
                          {r === 'bekliyor' ? 'Bekliyor' : r === 'gecti' ? 'Geçti' : 'Kaldı'}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-2 text-xs font-medium text-slate-700">
                      Sonuç:{' '}
                      {p.result === 'gecti' ? 'Geçti ✓' : p.result === 'kaldi' ? 'Kaldı' : 'Bekliyor'}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}

          {participants.length > 0 && (
            <div className="mt-4 hidden overflow-x-auto rounded-xl border border-app-border bg-white md:block">
              <table className="w-full min-w-[560px] text-left text-xs">
                <thead className="bg-app-bg-soft text-brand-muted">
                  <tr>
                    <th className="px-3 py-2">Sporcu</th>
                    <th className="px-3 py-2">Mevcut</th>
                    <th className="px-3 py-2">Hedef</th>
                    <th className="px-3 py-2">Sonuç</th>
                  </tr>
                </thead>
                <tbody>
                  {participants.map((p) => (
                    <tr key={p.id} className="border-t border-app-border">
                      <td className="px-3 py-2">{athleteName(p)}</td>
                      <td className="px-3 py-2">{p.belt_before}</td>
                      <td className="px-3 py-2">{p.target_belt}</td>
                      <td className="px-3 py-2">
                        {selectedExam.status === 'planlandi' ? (
                          <div className="inline-flex gap-1">
                            {(['bekliyor', 'gecti', 'kaldi'] as const).map((r) => (
                              <button
                                key={r}
                                type="button"
                                onClick={() => void setResult(p.id, r)}
                                className={`rounded-full px-2 py-0.5 text-[11px] ${
                                  p.result === r
                                    ? r === 'gecti'
                                      ? 'bg-brand-cyan text-slate-900'
                                      : r === 'kaldi'
                                        ? 'bg-rose-100 text-rose-800'
                                        : 'bg-amber-100 text-amber-900'
                                    : 'text-slate-500 hover:bg-app-bg-soft'
                                }`}
                              >
                                {r === 'bekliyor' ? 'Bekliyor' : r === 'gecti' ? 'Geçti' : 'Kaldı'}
                              </button>
                            ))}
                          </div>
                        ) : (
                          <span>
                            {p.result === 'gecti'
                              ? 'Geçti'
                              : p.result === 'kaldi'
                                ? 'Kaldı'
                                : 'Bekliyor'}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="mt-4 rounded-xl border border-dashed border-app-border bg-app-bg-soft/60 p-3 text-[11px] text-brand-muted">
            <p className="font-medium text-slate-600">Kuşak sırası</p>
            <p className="mt-1">{BELTS.join(' → ')}</p>
          </div>
        </section>
      )}
    </div>
  )
}
