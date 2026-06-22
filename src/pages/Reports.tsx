import { useEffect, useState } from 'react'
import {
  Users,
  CalendarCheck,
  ClipboardList,
  Award,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useReportExport } from '../hooks/useReportExport'
import LoadingSkeleton from '../components/LoadingSkeleton'

// ─── Types ────────────────────────────────────────────────────────────────────

type ReportMeta = {
  id: string
  title: string
  description: string
  icon: typeof Users
}

const REPORTS: ReportMeta[] = [
  {
    id: 'athletes',
    title: 'Sporcu Listesi',
    description: 'Tüm aktif sporcular — ad, kuşak, telefon, grup',
    icon: Users,
  },
  {
    id: 'attendance',
    title: 'Yoklama Raporu',
    description: 'Son 30 gün — sporcu bazında katılım/gelmeme sayıları',
    icon: CalendarCheck,
  },
  {
    id: 'orders',
    title: 'Bekleyen Siparişler',
    description: 'Henüz teslim edilmemiş malzeme siparişleri',
    icon: ClipboardList,
  },
  {
    id: 'exams',
    title: 'Sınav Katılım',
    description: 'Seçili bir kuşak sınavına katılan sporcu listesi',
    icon: Award,
  },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function groupName(a: any): string {
  const g = Array.isArray(a.training_groups) ? a.training_groups[0] : a.training_groups
  return g?.name ?? '—'
}

function athleteName(a: any): string {
  return a?.first_name && a?.last_name ? `${a.first_name} ${a.last_name}` : ''
}

// ─── Component ─────────────────────────────────────────────────────────────────

export default function Reports() {
  const { exportCsv, exportPng, exportPdf, isExporting } = useReportExport()
  const [loading, setLoading] = useState(true)
  const [athletes, setAthletes] = useState<any[]>([])
  const [attendance, setAttendance] = useState<any[]>([])
  const [orders, setOrders] = useState<any[]>([])
  const [exams, setExams] = useState<any[]>([])
  const [selectedExam, setSelectedExam] = useState<string>('')
  const [examParticipants, setExamParticipants] = useState<any[]>([])

  useEffect(() => {
    void (async () => {
      const [athRes, attRes, ordRes, examRes] = await Promise.all([
        supabase
          .from('athletes')
          .select('id, first_name, last_name, belt, phone, training_groups ( name )')
          .eq('is_active', true)
          .order('first_name'),
        supabase
          .from('attendance_records')
          .select('athlete_id, status, session_date')
          .gte('session_date', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)),
        supabase
          .from('athlete_orders')
          .select('id, athletes ( first_name, last_name ), total_amount, created_at')
          .eq('is_delivered', false)
          .order('created_at', { ascending: false }),
        supabase
          .from('belt_exams')
          .select('id, title, exam_date')
          .order('exam_date', { ascending: false }),
      ])

      setAthletes(athRes.data ?? [])
      setAttendance(attRes.data ?? [])
      setOrders(ordRes.data ?? [])
      setExams(examRes.data ?? [])
      setLoading(false)
    })()
  }, [])

  const loadExamParticipants = async (examId: string) => {
    if (!examId) {
      setExamParticipants([])
      return
    }
    const { data } = await supabase
      .from('belt_exam_participants')
      .select('belt_before, target_belt, result, athletes:athlete_id ( first_name, last_name )')
      .eq('exam_id', examId)

    setExamParticipants(data ?? [])
  }

  // ── Export handlers ─────────────────────────────────────────────────────────

  const athleteRows = () => athletes.map((a: any) => [
    athleteName(a), a.belt, a.phone ?? '', groupName(a),
  ])

  const attendanceSummary = () => {
    const map = new Map<string, { name: string; geldi: number; gelmedi: number }>()
    for (const r of attendance) {
      if (!map.has(r.athlete_id)) {
        const a = athletes.find((x: any) => x.id === r.athlete_id)
        map.set(r.athlete_id, {
          name: a ? athleteName(a) : r.athlete_id,
          geldi: 0,
          gelmedi: 0,
        })
      }
      const e = map.get(r.athlete_id)!
      if (r.status === 'geldi') e.geldi++
      else e.gelmedi++
    }
    return [...map.entries()]
      .map(([_, v]) => [v.name, String(v.geldi), String(v.gelmedi)])
      .sort((a, b) => a[0].localeCompare(b[0]))
  }

  const orderRows = () => orders.map((o: any) => {
    const a = Array.isArray(o.athletes) ? o.athletes[0] : o.athletes
    return [
      athleteName(a),
      String(o.total_amount ?? 0),
      new Date(o.created_at).toLocaleDateString('tr-TR'),
    ]
  })

  const examRows = () => examParticipants.map((p: any) => {
    const a = Array.isArray(p.athletes) ? p.athletes[0] : p.athletes
    const result = p.result === 'gecti' ? 'Geçti' : p.result === 'kaldi' ? 'Kaldı' : 'Bekliyor'
    return [athleteName(a), p.belt_before, p.target_belt, result]
  })

  const handleExport = (id: string, format: 'csv' | 'png' | 'pdf') => {
    if (format === 'csv') {
      if (id === 'athletes') return exportCsv('athletes', athleteRows(), ['Ad Soyad', 'Kuşak', 'Telefon', 'Grup'], 'sporcu-listesi.csv')
      if (id === 'attendance') return exportCsv('attendance', attendanceSummary(), ['Ad Soyad', 'Geldi', 'Gelmedi'], 'yoklama-raporu.csv')
      if (id === 'orders') return exportCsv('orders', orderRows(), ['Sporcu', 'Tutar', 'Sipariş Tarihi'], 'bekleyen-siparisler.csv')
      if (id === 'exams') return exportCsv('exams', examRows(), ['Ad Soyad', 'Önceki Kuşak', 'Hedef Kuşak', 'Sonuç'], `sinav-katilim-${selectedExam.slice(0, 8)}.csv`)
      return
    }

    const opts = (() => {
      if (id === 'athletes') return {
        title: 'Sporcu Listesi',
        subtitle: `${athletes.length} aktif sporcu`,
        columns: ['#', 'Ad Soyad', 'Kuşak', 'Telefon', 'Grup'] as string[],
        rows: athleteRows().map((r, i) => [i + 1, ...r]) as (string | number)[][],
        filename: 'sporcu-listesi',
      }
      if (id === 'attendance') {
        const summary = attendanceSummary()
        return {
          title: 'Yoklama Raporu',
          subtitle: 'Son 30 gün',
          columns: ['#', 'Ad Soyad', 'Geldi', 'Gelmedi'] as string[],
          rows: summary.map((r, i) => [i + 1, r[0], r[1], r[2]]) as (string | number)[][],
          filename: 'yoklama-raporu',
        }
      }
      if (id === 'orders') return {
        title: 'Bekleyen Siparişler',
        subtitle: `${orders.length} sipariş teslim edilmemiş`,
        columns: ['#', 'Sporcu', 'Tutar', 'Tarih'] as string[],
        rows: orderRows().map((r, i) => [i + 1, r[0], r[1], r[2]]) as (string | number)[][],
        filename: 'bekleyen-siparisler',
      }
      if (id === 'exams') {
        const exam = exams.find((e: any) => e.id === selectedExam)
        return {
          title: exam?.title ?? 'Sınav Katılım',
          subtitle: `${examParticipants.length} katılımcı`,
          columns: ['#', 'Ad Soyad', 'Önceki Kuşak', 'Hedef Kuşak', 'Sonuç'] as string[],
          rows: examRows().map((r, i) => [i + 1, r[0], r[1], r[2], r[3]]) as (string | number)[][],
          filename: 'sinav-katilim',
        }
      }
      return null as any
    })()
    if (!opts) return

    if (format === 'png') void exportPng(id, opts)
    else void exportPdf(id, opts)
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="space-y-6">
        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <LoadingSkeleton variant="card" count={4} />
        </section>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-4">
        {REPORTS.map((report) => {
          const Icon = report.icon
          const csvBusy = isExporting(report.id, 'csv')
          const pngBusy = isExporting(report.id, 'png')
          const pdfBusy = isExporting(report.id, 'pdf')
          const examLocked = report.id === 'exams' && !selectedExam
          return (
            <div key={report.id} className="glass-panel rounded-2xl p-4 flex flex-col">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-red/10">
                  <Icon className="h-5 w-5 text-brand-red" />
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="text-sm font-semibold text-slate-800">{report.title}</h2>
                  <p className="mt-0.5 text-xs text-brand-muted">{report.description}</p>
                </div>
              </div>
              <div className="mt-auto pt-4 flex gap-1.5">
                <button type="button" onClick={() => handleExport(report.id, 'csv')}
                  disabled={csvBusy || examLocked}
                  className="flex-1 rounded-lg border border-app-border bg-white px-2 py-1.5 text-[10px] font-medium text-slate-600 hover:bg-app-bg-soft disabled:opacity-40">
                  {csvBusy ? '...' : 'CSV'}
                </button>
                <button type="button" onClick={() => handleExport(report.id, 'png')}
                  disabled={pngBusy || examLocked}
                  className="flex-1 rounded-lg bg-brand-red px-2 py-1.5 text-[10px] font-semibold text-white hover:bg-brand-red/90 disabled:opacity-60">
                  {pngBusy ? '...' : 'PNG'}
                </button>
                <button type="button" onClick={() => handleExport(report.id, 'pdf')}
                  disabled={pdfBusy || examLocked}
                  className="flex-1 rounded-lg border border-blue-200 bg-blue-50 px-2 py-1.5 text-[10px] font-medium text-blue-700 hover:bg-blue-100 disabled:opacity-60">
                  {pdfBusy ? '...' : 'PDF'}
                </button>
              </div>
            </div>
          )
        })}
      </section>

      <section className="glass-panel rounded-2xl p-4">
        <h2 className="text-sm font-semibold text-slate-800 mb-3">Sınav Seçimi</h2>
        <select value={selectedExam}
          onChange={(e) => { setSelectedExam(e.target.value); void loadExamParticipants(e.target.value) }}
          className="input-field max-w-md">
          <option value="">Sınav seçin...</option>
          {exams.map((e: any) => (
            <option key={e.id} value={e.id}>{e.title} ({new Date(e.exam_date).toLocaleDateString('tr-TR')})</option>
          ))}
        </select>
        {examParticipants.length > 0 && (
          <p className="mt-2 text-xs text-brand-muted">{examParticipants.length} katılımcı</p>
        )}
      </section>
    </div>
  )
}