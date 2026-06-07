import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Users, UsersRound, Award, CalendarClock, AlertTriangle } from 'lucide-react'
import StatCard from '../components/StatCard'
import { supabase } from '../lib/supabase'
import { todayIsoWeekday, formatTime } from '../lib/days'

type TodaySession = {
  groupName: string
  time: string
}

type BeltCount = { belt: string; count: number }

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
  const [athleteCount, setAthleteCount] = useState('—')
  const [groupCount, setGroupCount] = useState('—')
  const [upcomingExam, setUpcomingExam] = useState('—')
  const [examHint, setExamHint] = useState('Planlanan kuşak sınavı')
  const [todaySessions, setTodaySessions] = useState<TodaySession[]>([])
  const [beltSummary, setBeltSummary] = useState<BeltCount[]>([])
  const [missedAthletes, setMissedAthletes] = useState<MissedAthlete[]>([])

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

      // ── Devamsızlık tespiti ──────────────────────────────────────────
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

      // Grupla — her sporcunun son kayıtları
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
    })()
  }, [])

  return (
    <div className="space-y-6">
      {/* ── Devamsızlık uyarısı (en üst) ── */}
      {missedAthletes.length > 0 && (
        <section>
          <div className="glass-panel rounded-2xl border-l-4 border-l-amber-400 p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-amber-800">
                  {missedAthletes.length} sporcu üst üste 4+ antrenmana katılmadı
                </p>
                <p className="mt-0.5 text-xs text-amber-700">
                  Son kayıtlara göre bu sporcular son 4 veya daha fazla
                  antrenmana gelmemiş.
                </p>
                <ul className="mt-3 space-y-1.5">
                  {missedAthletes.map((m) => (
                    <li
                      key={m.id}
                      className="flex items-center justify-between rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs"
                    >
                      <span className="font-medium text-slate-800">
                        {m.name}
                      </span>
                      <span className="text-brand-muted">
                        {m.groupName} · {m.missedCount} kez
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>
      )}

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
