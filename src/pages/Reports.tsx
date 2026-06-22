import { useEffect, useState } from 'react'
import {
  Users,
  CalendarCheck,
  ClipboardList,
  Award,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { downloadCsv } from '../lib/exportCsv'
import { downloadReportPng } from '../lib/exportReportPng'
import { downloadReportPdf } from '../lib/exportReportPdf'
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

// ─── Component ─────────────────────────────────────────────────────────────────

export default function Reports() {
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState<string | null>(null)
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

  // ── Export handlers ─────────────────────────────────────────────────────────

  const exportAthletesCsv = () => {
    const rows = athletes.map((a: any) => {
      const g = Array.isArray(a.training_groups)
        ? a.training_groups[0]
        : a.training_groups
      return [
        a.first_name + ' ' + a.last_name,
        a.belt,
        a.phone ?? '',
        g?.name ?? '',
      ]
    })
    downloadCsv(
      rows,
      ['Ad Soyad', 'Kuşak', 'Telefon', 'Grup'],
      'sporcu-listesi.csv',
    )
  }

  const exportAthletesPng = async () => {
    setExporting('athletes')
    try {
      await downloadReportPng({
        title: 'Sporcu Listesi',
        subtitle: `${athletes.length} aktif sporcu`,
        columns: ['#', 'Ad Soyad', 'Kuşak', 'Telefon', 'Grup'],
        rows: athletes.map((a: any, i: number) => {
          const g = Array.isArray(a.training_groups)
            ? a.training_groups[0]
            : a.training_groups
          return [i + 1, a.first_name + ' ' + a.last_name, a.belt, a.phone ?? '', g?.name ?? '']
        }),
        filename: 'sporcu-listesi',
      })
    } finally {
      setExporting(null)
    }
  }

  const exportAthletesPdf = async () => {
    setExporting('athletes-pdf')
    try {
      await downloadReportPdf({
        title: 'Sporcu Listesi',
        subtitle: `${athletes.length} aktif sporcu`,
        columns: ['#', 'Ad Soyad', 'Kuşak', 'Telefon', 'Grup'],
        rows: athletes.map((a: any, i: number) => {
          const g = Array.isArray(a.training_groups) ? a.training_groups[0] : a.training_groups
          return [i + 1, a.first_name + ' ' + a.last_name, a.belt, a.phone ?? '', g?.name ?? '']
        }),
        filename: 'sporcu-listesi',
      })
    } finally {
      setExporting(null)
    }
  }

  const exportAttendanceCsv = () => {
    const attNameMap = new Map<string, { name: string; geldi: number; gelmedi: number }>()
    for (const r of attendance as any[]) {
      if (!attNameMap.has(r.athlete_id)) {
        const athlete = (athletes as any[]).find((a: any) => a.id === r.athlete_id)
        attNameMap.set(r.athlete_id, {
          name: athlete ? athlete.first_name + ' ' + athlete.last_name : r.athlete_id,
          geldi: 0,
          gelmedi: 0,
        })
      }
      const entry = attNameMap.get(r.athlete_id)!
      if (r.status === 'geldi') entry.geldi++
      else entry.gelmedi++
    }

    const rows = [...attNameMap.entries()]
      .map(([_, v]) => [v.name, String(v.geldi), String(v.gelmedi)])
      .sort((a, b) => a[0].localeCompare(b[0]))

    downloadCsv(rows, ['Ad Soyad', 'Geldi', 'Gelmedi'], 'yoklama-raporu.csv')
  }

  const exportAttendancePng = async () => {
    setExporting('attendance')
    try {
      const attNameMap = new Map<string, { name: string; geldi: number; gelmedi: number }>()
      for (const r of attendance as any[]) {
        if (!attNameMap.has(r.athlete_id)) {
          const athlete = (athletes as any[]).find((a: any) => a.id === r.athlete_id)
          attNameMap.set(r.athlete_id, {
            name: athlete ? athlete.first_name + ' ' + athlete.last_name : r.athlete_id,
            geldi: 0,
            gelmedi: 0,
          })
        }
        const entry = attNameMap.get(r.athlete_id)!
        if (r.status === 'geldi') entry.geldi++
        else entry.gelmedi++
      }

      const rows = [...attNameMap.entries()]
        .map(([_, v]) => [v.name, String(v.geldi), String(v.gelmedi)])
        .sort((a, b) => a[0].localeCompare(b[0]))

      await downloadReportPng({
        title: 'Yoklama Raporu',
        subtitle: 'Son 30 gün',
        columns: ['#', 'Ad Soyad', 'Geldi', 'Gelmedi'],
        rows: rows.map((r, i) => [i + 1, r[0], r[1], r[2]]),
        filename: 'yoklama-raporu',
      })
    } finally {
      setExporting(null)
    }
  }

  const exportAttendancePdf = async () => {
    setExporting('attendance-pdf')
    try {
      const attNameMap = new Map<string, { name: string; geldi: number; gelmedi: number }>()
      for (const r of attendance as any[]) {
        if (!attNameMap.has(r.athlete_id)) {
          const athlete = (athletes as any[]).find((a: any) => a.id === r.athlete_id)
          attNameMap.set(r.athlete_id, { name: athlete ? athlete.first_name + ' ' + athlete.last_name : r.athlete_id, geldi: 0, gelmedi: 0 })
        }
        const entry = attNameMap.get(r.athlete_id)!
        if (r.status === 'geldi') entry.geldi++
        else entry.gelmedi++
      }
      const rows = [...attNameMap.entries()].map(([_, v]) => [v.name, String(v.geldi), String(v.gelmedi)]).sort((a, b) => a[0].localeCompare(b[0]))
      await downloadReportPdf({
        title: 'Yoklama Raporu', subtitle: 'Son 30 gün',
        columns: ['#', 'Ad Soyad', 'Geldi', 'Gelmedi'],
        rows: rows.map((r, i) => [i + 1, r[0], r[1], r[2]]),
        filename: 'yoklama-raporu',
      })
    } finally { setExporting(null) }
  }

  const exportOrdersCsv = () => {
    const rows = (orders as any[]).map((o: any) => {
      const a = Array.isArray(o.athletes) ? o.athletes[0] : o.athletes
      return [
        a?.first_name && a?.last_name ? `${a.first_name} ${a.last_name}` : '',
        String(o.total_amount ?? 0),
        new Date(o.created_at).toLocaleDateString('tr-TR'),
      ]
    })
    downloadCsv(
      rows,
      ['Sporcu', 'Tutar', 'Sipariş Tarihi'],
      'bekleyen-siparisler.csv',
    )
  }

  const exportOrdersPng = async () => {
    setExporting('orders')
    try {
      const rows = (orders as any[]).map((o: any) => {
        const a = Array.isArray(o.athletes) ? o.athletes[0] : o.athletes
        return [
          a?.first_name && a?.last_name ? `${a.first_name} ${a.last_name}` : '',
          String(o.total_amount ?? 0),
          new Date(o.created_at).toLocaleDateString('tr-TR'),
        ]
      })

      await downloadReportPng({
        title: 'Bekleyen Siparişler',
        subtitle: `${orders.length} sipariş teslim edilmemiş`,
        columns: ['#', 'Sporcu', 'Tutar', 'Tarih'],
        rows: rows.map((r, i) => [i + 1, r[0], r[1], r[2]]),
        filename: 'bekleyen-siparisler',
      })
    } finally {
      setExporting(null)
    }
  }

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

  const exportExamCsv = () => {
    const rows = (examParticipants as any[]).map((p: any) => {
      const a = Array.isArray(p.athletes) ? p.athletes[0] : p.athletes
      return [
        a?.first_name && a?.last_name ? `${a.first_name} ${a.last_name}` : '',
        p.belt_before,
        p.target_belt,
        p.result === 'gecti' ? 'Geçti' : p.result === 'kaldi' ? 'Kaldı' : 'Bekliyor',
      ]
    })
    downloadCsv(
      rows,
      ['Ad Soyad', 'Önceki Kuşak', 'Hedef Kuşak', 'Sonuç'],
      `sinav-katilim-${selectedExam.slice(0, 8)}.csv`,
    )
  }

  const exportExamPng = async () => {
    setExporting('exams')
    try {
      const rows = (examParticipants as any[]).map((p: any) => {
        const a = Array.isArray(p.athletes) ? p.athletes[0] : p.athletes
        return [
          a?.first_name && a?.last_name ? `${a.first_name} ${a.last_name}` : '',
          p.belt_before,
          p.target_belt,
          p.result === 'gecti' ? 'Geçti' : p.result === 'kaldi' ? 'Kaldı' : 'Bekliyor',
        ]
      })

      const exam = exams.find((e: any) => e.id === selectedExam)
      await downloadReportPng({
        title: exam?.title ?? 'Sınav Katılım',
        subtitle: `${rows.length} katılımcı`,
        columns: ['#', 'Ad Soyad', 'Önceki Kuşak', 'Hedef Kuşak', 'Sonuç'],
        rows: rows.map((r, i) => [i + 1, r[0], r[1], r[2], r[3]]),
        filename: `sinav-katilim`,
      })
    } finally {
      setExporting(null)
    }
  }

  const exportOrdersPdf = async () => {
    setExporting('orders-pdf')
    try {
      const rows = (orders as any[]).map((o: any) => {
        const a = Array.isArray(o.athletes) ? o.athletes[0] : o.athletes
        return [a?.first_name && a?.last_name ? `${a.first_name} ${a.last_name}` : '', String(o.total_amount ?? 0), new Date(o.created_at).toLocaleDateString('tr-TR')]
      })
      await downloadReportPdf({ title: 'Bekleyen Siparişler', subtitle: `${orders.length} sipariş teslim edilmemiş`, columns: ['#', 'Sporcu', 'Tutar', 'Tarih'], rows: rows.map((r, i) => [i + 1, r[0], r[1], r[2]]), filename: 'bekleyen-siparisler' })
    } finally { setExporting(null) }
  }

  const exportExamPdf = async () => {
    setExporting('exams-pdf')
    try {
      const rows = (examParticipants as any[]).map((p: any) => {
        const a = Array.isArray(p.athletes) ? p.athletes[0] : p.athletes
        return [a?.first_name && a?.last_name ? `${a.first_name} ${a.last_name}` : '', p.belt_before, p.target_belt, p.result === 'gecti' ? 'Geçti' : p.result === 'kaldi' ? 'Kaldı' : 'Bekliyor']
      })
      const exam = exams.find((e: any) => e.id === selectedExam)
      await downloadReportPdf({ title: exam?.title ?? 'Sınav Katılım', subtitle: `${rows.length} katılımcı`, columns: ['#', 'Ad Soyad', 'Önceki Kuşak', 'Hedef Kuşak', 'Sonuç'], rows: rows.map((r, i) => [i + 1, r[0], r[1], r[2], r[3]]), filename: 'sinav-katilim' })
    } finally { setExporting(null) }
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

      {/* Rapor kartları */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-4">
        {REPORTS.map((report) => {
          const Icon = report.icon
          const isCsvExport = exporting === report.id
          const isPngExport = exporting === `${report.id}-png`
          const isPdfExport = exporting === `${report.id}-pdf`
          return (
            <div
              key={report.id}
              className="glass-panel rounded-2xl p-4 flex flex-col"
            >
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-red/10">
                  <Icon className="h-5 w-5 text-brand-red" />
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="text-sm font-semibold text-slate-800">
                    {report.title}
                  </h2>
                  <p className="mt-0.5 text-xs text-brand-muted">
                    {report.description}
                  </p>
                </div>
              </div>

              <div className="mt-auto pt-4 flex gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    if (report.id === 'athletes') exportAthletesCsv()
                    else if (report.id === 'attendance') exportAttendanceCsv()
                    else if (report.id === 'orders') exportOrdersCsv()
                    else if (report.id === 'exams') exportExamCsv()
                  }}
                  disabled={isCsvExport || (report.id === 'exams' && !selectedExam)}
                  className="flex-1 rounded-lg border border-app-border bg-white px-2 py-1.5 text-[10px] font-medium text-slate-600 hover:bg-app-bg-soft disabled:opacity-40"
                >
                  CSV
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (report.id === 'athletes') exportAthletesPng()
                    else if (report.id === 'attendance') exportAttendancePng()
                    else if (report.id === 'orders') exportOrdersPng()
                    else if (report.id === 'exams') exportExamPng()
                  }}
                  disabled={isPngExport || (report.id === 'exams' && !selectedExam)}
                  className="flex-1 rounded-lg bg-brand-red px-2 py-1.5 text-[10px] font-semibold text-white hover:bg-brand-red/90 disabled:opacity-60"
                >
                  {isPngExport ? '...' : 'PNG'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (report.id === 'athletes') exportAthletesPdf()
                    else if (report.id === 'attendance') exportAttendancePdf()
                    else if (report.id === 'orders') exportOrdersPdf()
                    else if (report.id === 'exams') exportExamPdf()
                  }}
                  disabled={isPdfExport || (report.id === 'exams' && !selectedExam)}
                  className="flex-1 rounded-lg border border-blue-200 bg-blue-50 px-2 py-1.5 text-[10px] font-medium text-blue-700 hover:bg-blue-100 disabled:opacity-60"
                >
                  {isPdfExport ? '...' : 'PDF'}
                </button>
              </div>
            </div>
          )
        })}
      </section>

      {/* Sınav seçimi (sadece Exams raporu için) */}
      <section className="glass-panel rounded-2xl p-4">
        <h2 className="text-sm font-semibold text-slate-800 mb-3">
          Sınav Seçimi
        </h2>
        <select
          value={selectedExam}
          onChange={(e) => {
            setSelectedExam(e.target.value)
            void loadExamParticipants(e.target.value)
          }}
          className="input-field max-w-md"
        >
          <option value="">Sınav seçin...</option>
          {exams.map((e: any) => (
            <option key={e.id} value={e.id}>
              {e.title} ({new Date(e.exam_date).toLocaleDateString('tr-TR')})
            </option>
          ))}
        </select>

        {examParticipants.length > 0 && (
          <p className="mt-2 text-xs text-brand-muted">
            {examParticipants.length} katılımcı
          </p>
        )}
      </section>
    </div>
  )
}
