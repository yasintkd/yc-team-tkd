import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { getPossibleTargetBelts } from '../../lib/belts'

type Exam = { id: string; title: string; exam_date: string; fee_amount: number }

type Props = {
  editingExam: Exam | null
  onSaved: () => Promise<void>
  onSelect?: (id: string) => void
  setError: (msg: string | null) => void
  setMessage: (msg: string | null) => void
}

export default function ExamForm({ editingExam, onSaved, onSelect, setError, setMessage }: Props) {
  const [title, setTitle] = useState(editingExam?.title ?? '')
  const [examDate, setExamDate] = useState(editingExam?.exam_date ?? '')
  const [feeAmount, setFeeAmount] = useState(String(editingExam?.fee_amount ?? ''))
  const [saving, setSaving] = useState(false)

  const reset = () => {
    setTitle('')
    setExamDate('')
    setFeeAmount('')
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim() || !examDate) return
    setSaving(true)
    setError(null)

    if (editingExam) {
      const { error: upErr } = await supabase
        .from('belt_exams')
        .update({ title: title.trim(), exam_date: examDate, fee_amount: feeAmount ? parseFloat(feeAmount) : 0 })
        .eq('id', editingExam.id)
      if (upErr) { setError(upErr.message); setSaving(false); return }
      setMessage('Sınav güncellendi.')
      reset()
      await onSaved()
      setSaving(false)
      return
    }

    const { data: inserted, error: insErr } = await supabase
      .from('belt_exams')
      .insert({ title: title.trim(), exam_date: examDate, fee_amount: feeAmount ? parseFloat(feeAmount) : 0 })
      .select('id')
      .single()
    if (insErr) { setError(insErr.message); setSaving(false); return }

    const newExamId = inserted!.id

    const { data: allAthletes } = await supabase
      .from('athletes')
      .select('id, belt, first_name, last_name')
      .eq('is_active', true)

    const eligible = (allAthletes ?? []).filter((a) => getPossibleTargetBelts(a.belt).length > 0)

    if (eligible.length > 0) {
      const { error: batchErr } = await supabase
        .from('belt_exam_participants')
        .insert(eligible.map((a) => ({
          exam_id: newExamId,
          athlete_id: a.id,
          belt_before: a.belt,
          target_belt: getPossibleTargetBelts(a.belt)[0],
        })))
      if (batchErr) { setError(batchErr.message); setSaving(false); return }
    }

    reset()
    await onSaved()
    onSelect?.(newExamId)
    setMessage(`Sınav oluşturuldu. ${eligible.length} sporcu otomatik listeye eklendi.`)
    setSaving(false)
  }

  return (
    <section className="glass-panel rounded-2xl p-4">
      <h2 className="text-sm font-semibold">
        {editingExam ? 'Sınavı Düzenle' : 'Yeni Kuşak Sınavı'}
      </h2>
      <p className="mt-1 text-xs text-brand-muted">
        {editingExam ? 'Sınav bilgilerini güncelleyin.' : 'Sınav listesi oluşturun; sonuçları girince geçenleri otomatik yükseltin.'}
      </p>
      <form className="mt-4 grid gap-3 sm:grid-cols-3" onSubmit={submit}>
        <div className="space-y-1 text-xs">
          <label className="text-slate-600">Sınav adı</label>
          <input className="input-field" placeholder="Örn: 2026 Ocak Dönemi" value={title}
            onChange={(e) => setTitle(e.target.value)} autoFocus={!!editingExam} />
        </div>
        <div className="space-y-1 text-xs">
          <label className="text-slate-600">Tarih</label>
          <input type="date" className="input-field" value={examDate}
            onChange={(e) => setExamDate(e.target.value)} />
        </div>
        <div className="space-y-1 text-xs">
          <label className="text-slate-600">Ücret (₺)</label>
          <input type="number" min="0" step="0.01" className="input-field" placeholder="Örn: 500"
            value={feeAmount} onChange={(e) => setFeeAmount(e.target.value)} />
        </div>
        <div className="sm:col-span-3 flex items-center gap-2">
          <button type="submit" disabled={saving || !title.trim() || !examDate} className="btn-primary">
            {saving ? 'Kaydediliyor...' : editingExam ? 'Güncelle' : 'Sınav Oluştur'}
          </button>
          {editingExam && (
            <button type="button" onClick={() => { reset(); onSaved() }}
              className="rounded-lg border border-app-border bg-white px-4 py-2.5 text-xs font-medium text-slate-600 hover:bg-app-bg-soft">
              İptal
            </button>
          )}
        </div>
      </form>
    </section>
  )
}