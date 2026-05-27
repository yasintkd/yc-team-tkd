import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'

type PaymentStatus = 'odendi' | 'odenmedi'

type PaymentRow = {
  id: string
  athlete_id: string
  period_year: number
  period_month: number
  amount: number | null
  status: PaymentStatus
  paid_at: string | null
  athletes:
    | { first_name: string; last_name: string; belt: string }[]
    | { first_name: string; last_name: string; belt: string }
    | null
}

function monthLabel(year: number, month: number) {
  const d = new Date(Date.UTC(year, month - 1, 1))
  return d.toLocaleDateString('tr-TR', { year: 'numeric', month: 'long' })
}

export default function Payments() {
  const now = useMemo(() => new Date(), [])
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [rows, setRows] = useState<PaymentRow[]>([])

  const loadPayments = async () => {
    setLoading(true)
    setError(null)

    const { data, error: qErr } = await supabase
      .from('fee_payments')
      .select(
        'id, athlete_id, period_year, period_month, amount, status, paid_at, athletes ( first_name, last_name, belt )',
      )
      .eq('period_year', year)
      .eq('period_month', month)
      .order('created_at', { ascending: false })

    if (qErr) {
      setError(qErr.message)
      setRows([])
    } else {
      setRows((data ?? []) as PaymentRow[])
    }
    setLoading(false)
  }

  useEffect(() => {
    void loadPayments()
  }, [year, month])

  const toggleStatus = async (row: PaymentRow) => {
    const newStatus: PaymentStatus = row.status === 'odendi' ? 'odenmedi' : 'odendi'
    const payload = {
      id: row.id,
      athlete_id: row.athlete_id,
      period_year: row.period_year,
      period_month: row.period_month,
      amount: row.amount,
      status: newStatus,
      paid_at: newStatus === 'odendi' ? new Date().toISOString() : null,
    }

    setError(null)
    const { error: upErr } = await supabase.from('fee_payments').upsert(payload)
    if (upErr) {
      setError(upErr.message)
      return
    }
    await loadPayments()
  }

  const createMissingForPeriod = async () => {
    setError(null)
    setLoading(true)

    const { data: athletes, error: aErr } = await supabase
      .from('athletes')
      .select('id')
      .eq('is_active', true)

    if (aErr) {
      setError(aErr.message)
      setLoading(false)
      return
    }

    const payload = (athletes ?? []).map((a: { id: string }) => ({
      athlete_id: a.id,
      period_year: year,
      period_month: month,
      status: 'odenmedi' as const,
      paid_at: null,
      amount: null,
    }))

    // unique (athlete_id, period_year, period_month) sayesinde tekrar çalıştırılabilir
    const { error: insErr } = await supabase
      .from('fee_payments')
      .upsert(payload, { onConflict: 'athlete_id,period_year,period_month' })

    if (insErr) {
      setError(insErr.message)
      setLoading(false)
      return
    }

    await loadPayments()
    setLoading(false)
  }

  return (
    <div className="space-y-6">
      <section className="glass-panel rounded-2xl p-4">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold">Aidat & Ödeme Takibi</h2>
            <p className="text-xs text-slate-500">
              Sporcuların aylık aidat durumlarını tek bakışta görüntüleyin.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <select
              className="rounded-lg border border-slate-800 bg-slate-900 px-3 py-1.5 text-xs text-slate-200 outline-none focus:border-emerald-500"
              value={month}
              onChange={(e) => setMonth(Number(e.target.value))}
            >
              {Array.from({ length: 12 }).map((_, i) => (
                <option key={i + 1} value={i + 1}>
                  {new Date(Date.UTC(2020, i, 1)).toLocaleDateString('tr-TR', {
                    month: 'long',
                  })}
                </option>
              ))}
            </select>
            <input
              className="w-24 rounded-lg border border-slate-800 bg-slate-900 px-3 py-1.5 text-xs text-slate-200 outline-none focus:border-emerald-500"
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              inputMode="numeric"
            />
            <button
              type="button"
              onClick={() => void loadPayments()}
              className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800/80"
            >
              Yenile
            </button>
            <button
              type="button"
              onClick={() => void createMissingForPeriod()}
              className="hidden rounded-lg bg-slate-800 px-3 py-1.5 text-xs text-slate-100 hover:bg-slate-700 md:inline-block"
            >
              Dönemi Oluştur
            </button>
          </div>
        </div>

        <div className="mt-3 text-[11px] text-slate-500">
          Dönem: {monthLabel(year, month)}
        </div>

        {error && (
          <div className="mt-3 rounded-xl border border-rose-900/40 bg-rose-950/40 px-3 py-2 text-xs text-rose-200">
            {error}
          </div>
        )}

        <div className="mt-4 overflow-hidden rounded-xl border border-slate-800/80 bg-slate-900/60">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-900/80 text-slate-400">
              <tr>
                <th className="px-3 py-2">Sporcu</th>
                <th className="px-3 py-2">Kuşak</th>
                <th className="px-3 py-2">Ay</th>
                <th className="px-3 py-2">Durum</th>
                <th className="px-3 py-2">İşlem</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr className="border-t border-slate-800/80">
                  <td className="px-3 py-4 text-slate-400" colSpan={5}>
                    Yükleniyor...
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr className="border-t border-slate-800/80">
                  <td className="px-3 py-4 text-slate-400" colSpan={5}>
                    Bu dönem için ödeme kaydı bulunamadı. (Not: Ödemeler, sporcu
                    bazında ayrıca oluşturulur.)
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr
                    key={row.id}
                    className="border-t border-slate-800/80"
                  >
                    <td className="px-3 py-2">
                      {(() => {
                        const a = Array.isArray(row.athletes)
                          ? row.athletes[0]
                          : row.athletes
                        return a
                          ? `${a.first_name} ${a.last_name}`
                          : row.athlete_id
                      })()}
                    </td>
                    <td className="px-3 py-2">
                      {(() => {
                        const a = Array.isArray(row.athletes)
                          ? row.athletes[0]
                          : row.athletes
                        return a?.belt ?? '-'
                      })()}
                    </td>
                    <td className="px-3 py-2">
                      {monthLabel(row.period_year, row.period_month)}
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${
                          row.status === 'odendi'
                            ? 'bg-emerald-500/20 text-emerald-400'
                            : 'bg-rose-500/15 text-rose-400'
                        }`}
                      >
                        {row.status === 'odendi' ? 'Ödendi' : 'Ödenmedi'}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <button
                        type="button"
                        onClick={() => void toggleStatus(row)}
                        className="rounded-lg border border-slate-700 px-3 py-1 text-[11px] text-slate-200 hover:bg-slate-800/80"
                      >
                        Durumu Değiştir
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
