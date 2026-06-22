import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Users, UsersRound, Award, CalendarClock, ShieldAlert } from 'lucide-react'
import StatCard from '../components/StatCard'
import LoadingSkeleton from '../components/LoadingSkeleton'
import MissedAlert from '../components/dashboard/MissedAlert'
import BeltChart from '../components/dashboard/BeltChart'
import AttendanceChart from '../components/dashboard/AttendanceChart'
import { supabase } from '../lib/supabase'
import { todayIsoWeekday, formatTime } from '../lib/days'

type TodaySession = {
  groupId: string
  groupName: string
  time: string
}

type MissedAthlete = {
  id: string
  name: string
  groupName: string
  missedCount: number
  lastDate: string | null
}

const THIRTY_DAYS_AGO = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
  .toISOString()
  .slice(0, 10)

function groupName(
  a: { training_groups: { name: string } | { name: string }[] | null },
): string {
  const g = Array.isArray(a.training_groups) ? a.training_groups[0] : a.training_groups
  return g?.name ?? '—'
}

export default function Dashboard() {
  const navigate = useNavigate()
  const [dashboardLoading, setDashboardLoading] = useState(true)
  const [athleteCount, setAthleteCount] = useState('—')
  const [groupCount, setGroupCount] = useState('—')
  const [upcomingExam, setUpcomingExam] = useState('—')
  const [examHint, setExamHint] = useState('Planlanan kuşak sınavı')
  const [unlicensedCount, setUnlicensedCount] = useState<string | number>('—')
  const [todaySessions, setTodaySessions] = useState<TodaySession[]>([])
  const [beltSummary, setBeltSummary] = useState<{ belt: string; count: number }[]>([])
  const [monthlyAttendance, setMonthlyAttendance] = useState<{ date: string; count: number }[]>([])
  const [missedAthletes, setMissedAthletes] = useState<MissedAthlete[]>([])

  useEffect(() => {
    void (async () => {
      const today = todayIsoWeekday()
      const CURRENT_YEAR = new Date().getFullYear()

      const { data: allActiveAthletes } = await supabase
        .from('athletes')
        .select('id')
        .eq('is_active', true)

      const allActiveIds = (allActiveAthletes ?? []).map((a: any) => a.id)
      if (allActiveIds.length > 0) {
        const { count: licensedCount } = await supabase
          .from('athlete_licenses')
          .select('id', { count: 'exact' })
          .in('athlete_id', allActiveIds)
          .eq('year', CURRENT_YEAR)

        setUnlicensedCount(allActiveIds.length - (licensedCount ?? 0))
      } else {
        setUnlicensedCount(0)
      }

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
          .select('group_id, day_of_week, start_time, end_time, training_groups ( name )')
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

      const sessions: TodaySession[] = []
      for (const row of (schedulesRes.data ?? []) as Array<{
        group_id: string
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
          groupId: row.group_id,
          groupName: g.name,
          time: `${formatTime(row.start_time)} – ${formatTime(row.end_time)}`,
        })
      }
      sessions.sort((a, b) => a.time.localeCompare(b.time))
      setTodaySessions(sessions)

      const counts = new Map<string, number>()
      for (const a of (athletesRes.data ?? []) as Array<{ belt: string }>) {
        counts.set(a.belt, (counts.get(a.belt) ?? 0) + 1)
      }
      setBeltSummary(
        [...counts.entries()]
          .map(([belt, count]) => ({ belt, count }))
          .sort((a, b) => b.count - a.count),
      )

      const { data: athleteData } = await supabase
        .from('athletes')
        .select('id, first_name, last_name, training_groups ( name )')
        .eq('is_active', true)

      type AthleteRow = {
        id: string
        first_name: string
        last_name: string
        training_groups: { name: string } | { name: string }[] | null
      }
      const athletesWithGroup = (athleteData ?? []) as AthleteRow[]
      const ids = athletesWithGroup.map((a) => a.id)

      const { data: attData } = await supabase
        .from('attendance_records')
        .select('athlete_id, session_date, status')
        .in('athlete_id', ids)
        .gte('session_date', THIRTY_DAYS_AGO)
        .order('session_date', { ascending: false })

      const attMap = new Map<
        string,
        { session_date: string; status: string }[]
      >()
      for (const r of attData ?? []) {
        const list = attMap.get(r.athlete_id) ?? []
        list.push({ session_date: r.session_date, status: r.status })
        attMap.set(r.athlete_id, list)
      }

      const missed: MissedAthlete[] = []
      for (const a of athletesWithGroup) {
        const records = attMap.get(a.id) ?? []
        let streak = 0
        let lastDate: string | null = null
        for (const r of records) {
          if (r.status === 'gelmedi') {
            streak++
            if (!lastDate) lastDate = r.session_date
          } else {
            break
          }
        }
        if (streak >= 4) {
          missed.push({
            id: a.id,
            name: `${a.first_name} ${a.last_name}`,
            groupName: groupName(a),
            missedCount: streak,
            lastDate,
          })
        }
      }
      setMissedAthletes(missed)

      const { data: monthlyData } = await supabase
        .from('attendance_records')
        .select('session_date, status')
        .eq('status', 'geldi')
        .gte('session_date', THIRTY_DAYS_AGO)

      const dayCount = new Map<string, number>()
      for (const r of monthlyData ?? []) {
        const key = r.session_date.slice(5, 10)
        dayCount.set(key, (dayCount.get(key) ?? 0) + 1)
      }
      setMonthlyAttendance(
        [...dayCount.entries()]
          .map(([date, count]) => ({ date, count }))
          .sort((a, b) => a.date.localeCompare(b.date)),
      )

      setDashboardLoading(false)
    })()
  }, [])

  if (dashboardLoading) {
    return (
      <div className="space-y-6">
        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <LoadingSkeleton variant="card" count={5} />
        </section>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <MissedAlert athletes={missedAthletes} />

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard
          label="Aktif Sporcu"
          value={athleteCount}
          hint="Kayıtlı öğrenci sayısı"
          icon={Users}
          onClick={() => navigate('/sporcular')}
        />
        <StatCard
          label="Vizesiz Sporcu"
          value={String(unlicensedCount)}
          hint={`${new Date().getFullYear()} yılı lisans vizesi olmayanlar`}
          icon={ShieldAlert}
          onClick={() => navigate('/vizesiz-sporcular')}
        />
        <StatCard
          label="Antrenman Grubu"
          value={groupCount}
          hint="Tanımlı grup sayısı"
          icon={UsersRound}
          onClick={() => navigate('/gruplar')}
        />
        <StatCard
          label="Yaklaşan Sınav"
          value={upcomingExam}
          hint={examHint}
          icon={Award}
          onClick={() => navigate('/kusak-sinavi')}
        />
        <StatCard
          label="Bugün Antrenman"
          value={String(todaySessions.length)}
          hint="Bugün programda olan grup sayısı"
          icon={CalendarClock}
        />
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="glass-panel rounded-2xl p-4">
          <h2 className="text-sm font-semibold">Bugünün Antrenman Programı</h2>
          {todaySessions.length === 0 ? (
            <p className="mt-3 text-xs text-brand-muted">
              Bugün için tanımlı antrenman yok.{' '}
              <a href="/gruplar" className="text-brand-red hover:underline">
                Gruplar
              </a>{' '}
              sayfasından program ekleyin.
            </p>
          ) : (
            <ul className="mt-3 space-y-2 text-xs text-slate-700">
              {todaySessions.map((s, idx) => {
                const todayStr = new Date().toISOString().slice(0, 10)
                const attParams = `?date=${todayStr}&group=${s.groupId}&seans=${idx}`
                return (
                  <li
                    key={`${s.groupName}-${s.time}`}
                    className="flex flex-col gap-0.5 rounded-lg border border-app-border bg-white px-3 py-2 sm:flex-row sm:justify-between cursor-pointer hover:bg-brand-cyan/5 transition"
                    onClick={() => navigate('/yoklama-detay' + attParams)}
                  >
                    <span className="font-medium">{s.groupName}</span>
                    <span className="text-brand-muted">{s.time}</span>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        <BeltChart data={beltSummary} />
      </section>

      <AttendanceChart data={monthlyAttendance} />
    </div>
  )
}