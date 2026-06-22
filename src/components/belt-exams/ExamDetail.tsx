import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import BeltBadge from '../BeltBadge'
import LoadingSkeleton from '../LoadingSkeleton'
import { BELTS, findBeltIndex, getPossibleTargetBelts } from '../../lib/belts'
import { DollarSign, Users, TrendingUp, Package, CheckSquare, Square, Trash2, Plus } from 'lucide-react'

type Exam = { id: string; title: string; exam_date: string; fee_amount: number; status: string; notes: string | null }
type Participant = {
  id: string; athlete_id: string; belt_before: string; target_belt: string; fee_paid: boolean; result: string
  athletes: { first_name: string; last_name: string } | { first_name: string; last_name: string }[] | null
  licensed: boolean
}

type Props = {
  exam: Exam
  participants: Participant[]
  loading: boolean
  saving: boolean
  onExportPng: (type: 'attendance' | 'result') => void
  onOpenAdd: () => void
  onPromote: () => void
  onUpdateTarget: (id: string, belt: string) => void
  onToggleFee: (id: string, current: boolean) => void
  onRemove: (id: string) => void
}

function athleteName(p: Participant) {
  const a = Array.isArray(p.athletes) ? p.athletes[0] : p.athletes
  return a ? `${a.first_name} ${a.last_name}` : p.athlete_id
}

const feeSummary = (participants: Participant[], feeAmount: number) => {
  const paidCount = participants.filter((p) => p.fee_paid).length
  return { paidCount, total: paidCount * feeAmount }
}

const beltOrderSummary = (participants: Participant[]) => {
  const counts = new Map<string, number>()
  for (const p of participants) counts.set(p.target_belt, (counts.get(p.target_belt) ?? 0) + 1)
  return [...counts.entries()].sort(([a], [b]) => {
    const ia = BELTS.indexOf(a as any)
    const ib = BELTS.indexOf(b as any)
    return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib)
  })
}

export default function ExamDetail({ exam, participants, loading, saving, onExportPng, onOpenAdd, onPromote, onUpdateTarget, onToggleFee, onRemove }: Props) {
  const sorted = useMemo(() =>
    [...participants].sort((a, b) => {
      const ia = findBeltIndex(a.belt_before)
      const ib = findBeltIndex(b.belt_before)
      if (ia !== ib) return ia - ib
      return athleteName(a).localeCompare(athleteName(b))
    }), [participants])

  const fs = useMemo(() => feeSummary(participants, exam.fee_amount), [participants, exam.fee_amount])
  const order = useMemo(() => beltOrderSummary(participants), [participants])

  return (
    <section className="glass-panel rounded-2xl p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-sm font-semibold">{exam.title}</h2>
          <p className="text-xs text-brand-muted">
            {new Date(exam.exam_date).toLocaleDateString('tr-TR')} • {participants.length} katılımcı
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {participants.length > 0 && (
            <button type="button" onClick={() => onExportPng('attendance')}
              className="inline-flex items-center gap-1 rounded-lg border border-app-border bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-app-bg-soft">
              Yoklama Listesi PNG
            </button>
          )}
          {participants.length > 0 && exam.status === 'tamamlandi' && (
            <button type="button" onClick={() => onExportPng('result')}
              className="inline-flex items-center gap-1 rounded-lg border border-app-border bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-app-bg-soft">
              Sonuç PNG
            </button>
          )}
          {exam.status === 'planlandi' && (
            <>
              <button type="button" onClick={onOpenAdd}
                className="inline-flex items-center gap-1 rounded-lg border border-app-border bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-app-bg-soft">
                <Plus className="h-3.5 w-3.5" /> Sporcu Ekle
              </button>
              <button type="button" disabled={saving} onClick={onPromote}
                className="btn-primary shrink-0 text-xs">
                Geçenleri Yükselt
              </button>
            </>
          )}
        </div>
      </div>

      {/* Fee summary */}
      {exam.fee_amount > 0 && (
        <div className="mt-4 rounded-xl border border-brand-cyan/20 bg-brand-cyan/5 p-3">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs">
            <div className="flex items-center gap-1.5">
              <DollarSign className="h-3.5 w-3.5 text-brand-cyan" />
              <span className="text-slate-600">Sınav ücreti:</span>
              <span className="font-semibold text-slate-800">{exam.fee_amount} ₺</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5 text-brand-cyan" />
              <span className="text-slate-600">Ödeyen:</span>
              <span className="font-semibold text-emerald-700">{fs.paidCount}</span>
              <span className="text-brand-muted">/ {participants.length}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <TrendingUp className="h-3.5 w-3.5 text-brand-cyan" />
              <span className="text-slate-600">Toplam tahsilat:</span>
              <span className="font-semibold text-slate-800">{fs.total} ₺</span>
            </div>
          </div>
        </div>
      )}

      {/* Order summary */}
      {order.length > 0 && (
        <div className="mt-4 rounded-xl border border-amber-200/60 bg-amber-50/70 p-3">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-900">
            <Package className="h-3.5 w-3.5" />
            Kuşak Siparişi
            <span className="font-normal text-amber-700">— {order.reduce((s, [,c]) => s + c, 0)} adet kuşak sipariş edilmeli</span>
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {order.map(([belt, count]) => (
              <span key={belt} className="inline-flex items-center gap-1">
                <BeltBadge belt={belt} size="sm" />
                <span className="ml-0.5 font-bold">×{count}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {loading ? (
        <div className="mt-4"><LoadingSkeleton variant="table-row" count={5} /></div>
      ) : participants.length === 0 ? (
        <p className="mt-4 text-xs text-brand-muted">Henüz katılımcı yok.</p>
      ) : (
        <>
          {/* Mobile cards */}
          <ul className="mt-4 space-y-2 md:hidden">
            {sorted.map((p) => {
              const targets = getPossibleTargetBelts(p.belt_before)
              return (
                <li key={p.id} className="rounded-xl border border-app-border bg-white p-3">
                  <Link to={`/sporcular/${p.athlete_id}`} className="text-sm font-medium hover:text-brand-red transition">{athleteName(p)}</Link>
                  <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                    <div><span className="text-brand-muted">Mevcut:</span> <BeltBadge belt={p.belt_before} size="sm" /></div>
                    <div><span className="text-brand-muted">Hedef:</span> <BeltBadge belt={p.target_belt} size="sm" /></div>
                  </div>
                  {exam.status === 'planlandi' && targets.length > 1 && (
                    <select className="input-field mt-2 py-1.5 text-xs" value={p.target_belt}
                      onChange={(e) => onUpdateTarget(p.id, e.target.value)}>
                      {targets.map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                  )}
                  {exam.fee_amount > 0 && (
                    <button type="button" onClick={() => onToggleFee(p.id, p.fee_paid)}
                      className={`mt-2 inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs transition ${
                        p.fee_paid ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-app-border bg-white text-slate-500 hover:bg-emerald-50'
                      }`}>
                      {p.fee_paid ? <CheckSquare className="h-3.5 w-3.5" /> : <Square className="h-3.5 w-3.5" />}
                      {p.fee_paid ? 'Ücret ödendi' : 'Ücret ödenmedi'}
                    </button>
                  )}
                  {exam.status === 'planlandi' && (
                    <div className="mt-3 flex justify-end">
                      <button type="button" onClick={() => onRemove(p.id)}
                        className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-xs font-medium text-rose-700 hover:bg-rose-100">
                        <Trash2 className="h-3 w-3" /> Listeden Çıkart
                      </button>
                    </div>
                  )}
                </li>
              )
            })}
          </ul>

          {/* Desktop table */}
          <div className="mt-4 hidden overflow-x-auto rounded-xl border border-app-border bg-white md:block">
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
                {sorted.map((p) => {
                  const targets = getPossibleTargetBelts(p.belt_before)
                  return (
                    <tr key={p.id} className="border-t border-app-border">
                      <td className="px-3 py-2 font-medium text-slate-800">
                        <Link to={`/sporcular/${p.athlete_id}`} className="hover:text-brand-red transition">{athleteName(p)}</Link>
                      </td>
                      <td className="px-3 py-2"><BeltBadge belt={p.belt_before} size="sm" /></td>
                      <td className="px-3 py-2">
                        {exam.status === 'planlandi' && targets.length > 1 ? (
                          <select className="input-field py-1 text-xs" value={p.target_belt}
                            onChange={(e) => onUpdateTarget(p.id, e.target.value)}>
                            {targets.map((t) => <option key={t} value={t}>{t}</option>)}
                          </select>
                        ) : (
                          <BeltBadge belt={p.target_belt} size="sm" />
                        )}
                      </td>
                      <td className="px-3 py-2">
                        {p.licensed
                          ? <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-700">Vizeli</span>
                          : <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700">Vizesiz</span>
                        }
                      </td>
                      <td className="px-3 py-2">
                        {exam.fee_amount > 0 ? (
                          <button type="button" onClick={() => onToggleFee(p.id, p.fee_paid)}
                            className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[11px] transition ${
                              p.fee_paid ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-app-border bg-white text-slate-500 hover:bg-emerald-50'
                            }`}>
                            {p.fee_paid ? <CheckSquare className="h-3 w-3" /> : <Square className="h-3 w-3" />}
                            {p.fee_paid ? 'Ödendi' : 'Ödemedi'}
                          </button>
                        ) : <span className="text-brand-muted">—</span>}
                      </td>
                      <td className="px-3 py-2">
                        {exam.status === 'planlandi' && (
                          <button type="button" onClick={() => onRemove(p.id)}
                            className="rounded-lg border border-rose-200 bg-rose-50 px-2 py-1 text-[11px] font-medium text-rose-700 hover:bg-rose-100">
                            Çıkart
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
    </section>
  )
}