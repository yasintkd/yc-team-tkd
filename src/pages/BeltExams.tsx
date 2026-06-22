import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { BELTS } from '../lib/belts'
import ExamForm from '../components/belt-exams/ExamForm'
import ExamList from '../components/belt-exams/ExamList'
import ExamDetail from '../components/belt-exams/ExamDetail'
import AddAthleteModal from '../components/belt-exams/AddAthleteModal'
import { exportExamPng } from '../lib/exportExamPng'

type Exam = {
  id: string
  title: string
  exam_date: string
  fee_amount: number
  status: string
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
  const [editingExam, setEditingExam] = useState<Exam | null>(null)
  const [showAddModal, setShowAddModal] = useState(false)

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
      await loadExams()
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

    const unlicensed = participants.filter((p) => !p.licensed)
    if (unlicensed.length > 0) {
      setError(`Vizesiz sporcu var: ${unlicensed.map((p) => athleteName(p)).join(', ')}. Sınav tamamlanamaz.`)
      setSaving(false)
      return
    }

    const unpaid = participants.filter((p) => !p.fee_paid)
    if (unpaid.length > 0) {
      setError(`Sınav ücreti ödenmemiş sporcu var: ${unpaid.map((p) => athleteName(p)).join(', ')}.`)
      setSaving(false)
      return
    }

    if (participants.length === 0) {
      setError('Sınavda sporcu yok.')
      setSaving(false)
      return
    }

    for (const p of participants) {
      const { error: upErr } = await supabase
        .from('belt_exam_participants')
        .update({ result: 'gecti' })
        .eq('id', p.id)
      if (upErr) { setError(upErr.message); setSaving(false); return }
    }

    for (const p of participants) {
      const { error: upAthleteErr } = await supabase
        .from('athletes')
        .update({ belt: p.target_belt })
        .eq('id', p.athlete_id)
      if (upAthleteErr) { setError(upAthleteErr.message); setSaving(false); return }
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

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">{error}</div>
      )}
      {message && (
        <div className="rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-800">{message}</div>
      )}

      <ExamForm
        editingExam={editingExam}
        onSaved={async () => { setEditingExam(null); await loadExams() }}
        onSelect={(id) => setSelectedExamId(id)}
        setError={setError}
        setMessage={setMessage}
      />

      <div className="space-y-6">
        <ExamList
          exams={exams}
          selectedId={selectedExamId}
          loading={loading}
          onSelect={(id) => setSelectedExamId(id)}
          onEdit={(exam) => setEditingExam(exam)}
          onDelete={deleteExam}
          saving={saving}
        />

        {selectedExam && (
          <ExamDetail
            exam={selectedExam}
            participants={participants}
            loading={loading}
            saving={saving}
            onExportPng={(type) => void exportExamPng(participants, selectedExam.title, selectedExam.exam_date, type)}
            onOpenAdd={() => setShowAddModal(true)}
            onPromote={() => void promotePassed()}
            onUpdateTarget={(id, belt) => void updateTargetBelt(id, belt)}
            onToggleFee={(id, current) => void toggleFeePaid(id, current)}
            onRemove={(id) => void removeParticipant(id)}
          />
        )}
      </div>

      {selectedExam && (
        <div className="rounded-xl border border-dashed border-app-border bg-app-bg-soft/60 p-3 text-[11px] text-brand-muted">
          <p className="font-medium text-slate-600">Kuşak sırası</p>
          <p className="mt-1">{BELTS.join(' → ')}</p>
        </div>
      )}

      {showAddModal && selectedExam && (
        <AddAthleteModal
          examId={selectedExam.id}
          existingAthleteIds={participants.map((p) => p.athlete_id)}
          onAdd={async () => { await loadParticipants(selectedExam.id) }}
          onClose={() => setShowAddModal(false)}
        />
      )}
    </div>
  )
}