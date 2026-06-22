type Exam = { id: string; title: string; exam_date: string; fee_amount: number; status: string; notes: string | null }

type Props = {
  exams: Exam[]
  selectedId: string | null
  loading: boolean
  onSelect: (id: string) => void
  onEdit: (exam: Exam) => void
  onDelete: (exam: Exam) => void
  saving: boolean
}

export default function ExamList({ exams, selectedId, loading, onSelect, onEdit, onDelete, saving }: Props) {
  return (
    <section className="glass-panel rounded-2xl p-4">
      <h2 className="text-sm font-semibold">Sınav Listeleri</h2>
      {loading ? (
        <div className="mt-3 space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-16 animate-pulse rounded-xl bg-slate-100" />
          ))}
        </div>
      ) : exams.length === 0 ? (
        <p className="mt-3 text-xs text-brand-muted">Henüz sınav yok.</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {exams.map((exam) => (
            <li key={exam.id}>
              <div
                className={`w-full rounded-xl border text-left text-sm transition ${
                  selectedId === exam.id
                    ? 'border-brand-red bg-brand-red/5'
                    : 'border-app-border bg-white hover:bg-app-bg-soft'
                }`}
              >
                <button type="button" onClick={() => onSelect(exam.id)}
                  className="flex w-full items-center justify-between gap-2 px-3 pt-3 pb-2">
                  <span className="font-medium">{exam.title}</span>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                    exam.status === 'tamamlandi' ? 'bg-sky-100 text-sky-800' : 'bg-amber-100 text-amber-800'
                  }`}>
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
                      <button type="button" onClick={(e) => { e.stopPropagation(); onEdit(exam) }}
                        className="rounded-lg border border-app-border bg-white px-2 py-1 text-[11px] font-medium text-slate-600 hover:bg-app-bg-soft">
                        Düzenle
                      </button>
                      <button type="button" disabled={saving}
                        onClick={(e) => { e.stopPropagation(); onDelete(exam) }}
                        className="rounded-lg border border-rose-200 bg-rose-50 px-2 py-1 text-[11px] font-medium text-rose-700 hover:bg-rose-100 disabled:opacity-60">
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
  )
}