import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Users, UsersRound, Award, CalendarClock, AlertTriangle } from 'lucide-react'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts'
import StatCard from '../components/StatCard'
import LoadingSkeleton from '../components/LoadingSkeleton'
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

/** Saf kuşak renkleri */
const BELT_COLORS: Record<string, string> = {
  'Beyaz': '#f1f5f9',
  'Beyaz-Sarı': '#fde68a',
  'Sarı': '#eab308',
  'Sarı-Yeşil': '#a3e635',
  'Yeşil': '#22c55e',
  'Yeşil-Mavi': '#2dd4bf',
  'Mavi': '#3b82f6',
  'Mavi-Kırmızı': '#fb7185',
  'Kırmızı': '#ef4444',
  'Kırmızı-Siyah': '#a855f7',
  'Siyah': '#1e293b',
  '1. Dan': '#0f172a',
  '2. Dan': '#020617',
}

/** Bileşik kuşak çiftleri — hangi iki renk arasında geçiş */
const COMPOUND_BELTS: Record<string, [string, string]> = {
  'Beyaz-Sarı':   ['#f1f5f9', '#eab308'],
  'Sarı-Yeşil':   ['#eab308', '#22c55e'],
  'Yeşil-Mavi':   ['#22c55e', '#3b82f6'],
  'Mavi-Kırmızı': ['#3b82f6', '#ef4444'],
  'Kırmızı-Siyah':['#ef4444', '#1e293b'],
}

/** Bileşik kuşak için pattern ID üret */
function beltPatternId(belt: string): string {
  return `pat-${belt.replace(/\s/g, '')}`
}

/** Bir kuşak için fill — bileşikse pattern url, değilse düz renk */
function beltFill(belt: string): string {
  return COMPOUND_BELTS[belt] ? `url(#${beltPatternId(belt)})` : (BELT_COLORS[belt] ?? '#94a3b8')
}

const THIRTY_DAYS_AGO = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
  .toISOString()
  .slice(0, 10)

/** SVG arc path (Recharts custom activeShape) */
function getArcPath(
  cx: number, cy: number,
  innerRadius: number, outerRadius: number,
  startAngle: number, endAngle: number,
): string {
  const rad = (a: number) => (a * Math.PI) / 180
  const polar = (r: number, a: number) => [cx + r * Math.cos(rad(a)), cy + r * Math.sin(rad(a))]
  const s = polar(outerRadius, startAngle)
  const e = polar(outerRadius, endAngle)
  const si = polar(innerRadius, endAngle)
  const ei = polar(innerRadius, startAngle)
  const large = endAngle - startAngle > 180 ? 1 : 0
  return [
    `M${s[0]},${s[1]}`,
    `A${outerRadius},${outerRadius},0,${large},1,${e[0]},${e[1]}`,
    `L${si[0]},${si[1]}`,
    `A${innerRadius},${innerRadius},0,${large},0,${ei[0]},${ei[1]}`,
    'Z',
  ].join(' ')
}

function groupName(
  a: { training_groups: { name: string } | { name: string }[] | null },
): string {
  const g = Array.isArray(a.training_groups) ? a.training_groups[0] : a.training_groups
  return g?.name ?? '—'
}

export default function Dashboard() {
  const [dashboardLoading, setDashboardLoading] = useState(true)
  const [athleteCount, setAthleteCount] = useState('—')
  const [groupCount, setGroupCount] = useState('—')
  const [upcomingExam, setUpcomingExam] = useState('—')
  const [examHint, setExamHint] = useState('Planlanan kuşak sınavı')
  const [todaySessions, setTodaySessions] = useState<TodaySession[]>([])
  const [beltSummary, setBeltSummary] = useState<BeltCount[]>([])
  const [monthlyAttendance, setMonthlyAttendance] = useState<{ date: string; count: number }[]>([])
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

      // ── Aylık katılım ─────────────────────────────────────────────
      const { data: monthlyData } = await supabase
        .from('attendance_records')
        .select('session_date, status')
        .eq('status', 'geldi')
        .gte('session_date', THIRTY_DAYS_AGO)

      const dayCount = new Map<string, number>()
      for (const r of monthlyData ?? []) {
        const key = r.session_date.slice(5, 10) // MM-DD
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
        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <LoadingSkeleton variant="card" count={4} />
        </section>
      </div>
    )
  }

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

        {/* Kuşak dağılımı – PieChart */}
        <div className="glass-panel rounded-2xl p-4">
          <h2 className="text-sm font-semibold">Kuşak Dağılımı</h2>
          {beltSummary.length === 0 ? (
            <p className="mt-3 text-xs text-brand-muted">Henüz sporcu kaydı yok.</p>
          ) : (
            <div className="mt-3">
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <defs>
                    {Object.entries(COMPOUND_BELTS).map(([belt, [c1, c2]]) => {
                      if (!beltSummary.some((b) => b.belt === belt)) return null
                      const id = beltPatternId(belt)
                      return (
                        <pattern key={id} id={id} patternUnits="userSpaceOnUse" width="10" height="10" patternTransform="rotate(45)">
                          <rect width="5" height="10" fill={c1} />
                          <rect x="5" width="5" height="10" fill={c2} />
                        </pattern>
                      )
                    })}
                  </defs>
                  <Pie
                    data={beltSummary}
                    dataKey="count"
                    nameKey="belt"
                    cx="50%"
                    cy="50%"
                    innerRadius={58}
                    outerRadius={92}
                    paddingAngle={3}
                    strokeWidth={2}
                    stroke="#fff"
                    isAnimationActive
                    animationBegin={200}
                    animationDuration={1200}
                    animationEasing="ease-out"
                    activeShape={(props: any) => {
                      const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill } = props
                      return (
                        <g>
                          <defs>
                            <filter id={`glow-${props.belt?.replace(/\s/g, '') ?? 'belt'}`}>
                              <feGaussianBlur stdDeviation="3" result="coloredBlur" />
                              <feMerge>
                                <feMergeNode in="coloredBlur" />
                                <feMergeNode in="SourceGraphic" />
                              </feMerge>
                            </filter>
                          </defs>
                          <path
                            d={getArcPath(cx, cy, innerRadius - 2, outerRadius + 4, startAngle, endAngle)}
                            fill={fill}
                            opacity={0.25}
                            filter={`url(#glow-${props.belt?.replace(/\s/g, '') ?? 'belt'})`}
                          />
                          <path
                            d={getArcPath(cx, cy, innerRadius, outerRadius + 3, startAngle, endAngle)}
                            fill={fill}
                            opacity={0.9}
                            stroke="#fff"
                            strokeWidth={2}
                          />
                        </g>
                      )
                    }}
                  >
                    {beltSummary.map((e) => (
                      <Cell
                        key={e.belt}
                        fill={beltFill(e.belt)}
                        stroke="rgba(255,255,255,0.6)"
                        strokeWidth={2}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      borderRadius: 12,
                      border: '1px solid #e2e8f0',
                      background: 'rgba(255,255,255,0.97)',
                      fontSize: 12,
                      boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
                    }}
                    formatter={(value, name) => [`${value} sporcu`, name]}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="mt-3 flex flex-wrap justify-center gap-x-5 gap-y-1.5 text-xs text-slate-600">
                {beltSummary.map(({ belt, count }) => (
                  <span key={belt} className="flex items-center gap-1.5 transition hover:scale-105">
                    <span
                      className="inline-block h-3 w-3 rounded-full ring-1 ring-black/5 transition-transform"
                      style={{ background: COMPOUND_BELTS[belt] ? `linear-gradient(135deg, ${COMPOUND_BELTS[belt][0]} 50%, ${COMPOUND_BELTS[belt][1]} 50%)` : (BELT_COLORS[belt] ?? '#94a3b8') }}
                    />
                    {belt} <span className="font-semibold text-slate-800">{count}</span>
                  </span>
                ))}
              </div>
              <Link
                to="/kusak-sinavi"
                className="mt-4 inline-block text-xs font-medium text-brand-red hover:underline"
              >
                Kuşak sınavı listesi oluştur →
              </Link>
            </div>
          )}
        </div>
      </section>

      {/* Aylık katılım grafiği */}
      {monthlyAttendance.length > 0 && (
        <section className="glass-panel rounded-2xl p-4">
          <h2 className="mb-3 text-sm font-semibold">Son 30 Günlük Katılım</h2>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={monthlyAttendance}>
              <CartesianGrid strokeDasharray="3 3" stroke="#b8d4e8" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 11 }}
                tickLine={false}
                axisLine={{ stroke: '#b8d4e8' }}
              />
              <YAxis
                allowDecimals={false}
                tick={{ fontSize: 11 }}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip
                contentStyle={{
                  borderRadius: 12,
                  border: '1px solid #b8d4e8',
                  background: 'rgba(255,255,255,0.95)',
                  fontSize: 12,
                }}
                formatter={(val) => [`${val} katılım`, 'Gelen']}
                labelFormatter={(lbl) => `Tarih: ${lbl}`}
              />
              <Bar dataKey="count" radius={[4, 4, 0, 0]} maxBarSize={32}>
                {monthlyAttendance.map((e) => (
                  <Cell
                    key={e.date}
                    fill={e.count > 5 ? '#0097a7' : '#facc15'}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </section>
      )}
    </div>
  )
}
