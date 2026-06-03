import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Users, UsersRound, Award, CalendarClock } from 'lucide-react'
import StatCard from '../components/StatCard'
import { supabase } from '../lib/supabase'
import { todayIsoWeekday, formatTime } from '../lib/days';

type TodaySession = {
  groupName: string
  time: string
}

type BeltCount = { belt: string; count: number }

export default function Dashboard() {
  const [athleteCount, setAthleteCount] = useState('—')
  const [groupCount, setGroupCount] = useState('—')
  const [upcomingExam, setUpcomingExam] = useState('—')
  const [examHint, setExamHint] = useState('Planlanan kuşak sınavı')
  const [todaySessions, setTodaySessions] = useState<TodaySession[]>([])
  const [beltSummary, setBeltSummary] = useState<BeltCount[]>([])

  useEffect(() => {
    void (async () => {
      const today = todayIsoWeekday()

      const [athletesRes, groupsRes, examsRes, schedulesRes] = await Promise.all([
        supabase
          .from('athletes')
          .select('id, belt', { count: 'exact' })
          .eq('is_active', true),
        supabase
          .from('training_groups')
          .select('id', { count: 'exact' })
          .eq('is_active', true),
        supabase
          .from('belt_exams')
          .select('title, exam_date')
          .eq('status', 'planlandi')
          .gte('exam_date', new Date().toISOString().slice(0, 10))
          .order('exam_date')
          .limit(1),
        supabase
          .from('group_schedules')
          .select('day_of_week, start_time, end_time, training_groups ( name )')
          .eq('day_of_week', today),
      ])

      setAthleteCount(String(athletesRes.count ?? 0))
      setGroupCount(String(groupsRes.count ?? 0))

      const exam = examsRes.data?.[0] as
        | { title: string; exam_date: string }
        | undefined
      if (exam) {
        setUpcomingExam(new Date(exam.exam_date).toLocaleDateString('tr-TR'))
        setExamHint(exam.title)
      }

      // Bugünün antrenmanları
      const sessions: TodaySession[] = []
      for (const row of (schedulesRes.data ?? []) as Array<{
        day_of_week: number
        start_time: string
        end_time: string
        training_groups: { name: string } | { name: string }[] | null
      }>) {
        const g = Array.isArray(row.training_groups)
          ? row.training_groups[0]
          : row.training_groups
        if (!g) continue
        sessions.push({
          groupName: g.name,
          time: `${formatTime(row.start_time)} – ${formatTime(row.end_time)}`,
        })
      }
      sessions.sort((a, b) => a.time.localeCompare(b.time))
      setTodaySessions(sessions)

      // Kuşak dağılımı
      const counts = new Map<string, number>()
      for (const a of (athletesRes.data ?? []) as Array<{ belt: string }>) {
        counts.set(a.belt, (counts.get(a.belt) ?? 0) + 1)
      }
      setBeltSummary(
        [...counts.entries()]
          .map(([belt, count]) => ({ belt, count }))
          .sort((a, b) => b.count - a.count),
      )
    })()
  }, [])

  return (
    <div className="space-y-6">
      {/* İstatistik kartları */}
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Aktif Sporcu"
          value={athleteCount}
          hint="Kayıtlı öğrenci sayısı"
          icon={Users}
        />
        <StatCard
          label="Antrenman Grubu"
          value={groupCount}
          hint="Tanımlı grup sayısı"
          icon={UsersRound}
        />
        <StatCard
          label="Yaklaşan Sınav"
          value={upcomingExam}
          hint={examHint}
          icon={Award}
        />
        <StatCard
          label="Bugün Antrenman"
          value={String(todaySessions.length)}
          hint="Bugün programda olan grup sayısı"
          icon={CalendarClock}
        />
      </section>

      {/* Alt paneller */}
      <section className="grid gap-4 lg:grid-cols-2">
        {/* Bugünün programı */}
        <div className="glass-panel rounded-2xl p-4">
          <h2 className="text-sm font-semibold">Bugünün Antrenman Programı</h2>
          {todaySessions.length === 0 ? (
            <p className="mt-3 text-xs text-brand-muted">
              Bugün için tanımlı antrenman yok.{' '}
              <Link to="/gruplar" className="text-brand-red hover:underline">
                Gruplar
              </Link>{' '}
              sayfasından program ekleyin.
            </p>
          ) : (
            <ul className="mt-3 space-y-2 text-xs text-slate-700">
              {todaySessions.map((s) => (
                <li
                  key={`${s.groupName}-${s.time}`}
                  className="flex flex-col gap-0.5 rounded-lg border border-app-border bg-white px-3 py-2 sm:flex-row sm:justify-between"
                >
                  <span className="font-medium">{s.groupName}</span>
                  <span className="text-brand-muted">{s.time}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Kuşak dağılımı */}
        <div className="glass-panel rounded-2xl p-4">
          <h2 className="text-sm font-semibold">Kuşak Dağılımı</h2>
          {beltSummary.length === 0 ? (
            <p className="mt-3 text-xs text-brand-muted">Henüz sporcu kaydı yok.</p>
          ) : (
            <ul className="mt-3 space-y-2 text-xs">
              {beltSummary.map(({ belt, count }) => (
                <li
                  key={belt}
                  className="flex items-center justify-between rounded-lg border border-app-border bg-white px-3 py-2"
                >
                  <span className="text-slate-700">{belt}</span>
                  <span className="font-semibold text-slate-800">{count}</span>
                </li>
              ))}
            </ul>
          )}
          <Link
            to="/kusak-sinavi"
            className="mt-4 inline-block text-xs font-medium text-brand-red hover:underline"
          >
            Kuşak sınavı listesi oluştur →
          </Link>
        </div>
      </section>
    </div>
  )
}
