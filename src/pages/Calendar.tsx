import { useEffect, useMemo, useState } from 'react'
import { Calendar, momentLocalizer, type Event } from 'react-big-calendar'
import moment from 'moment'
import 'react-big-calendar/lib/css/react-big-calendar.css'
import '../styles/calendar-theme.css'
import { supabase } from '../lib/supabase'
import LoadingSkeleton from '../components/LoadingSkeleton'

const localizer = momentLocalizer(moment)
moment.locale('tr')

type TrainingGroup = { id: string; name: string }

type ScheduleRow = {
  id: string
  group_id: string
  day_of_week: number
  start_time: string
  end_time: string
}

type BeltExamRow = {
  id: string
  title: string
  exam_date: string
  status: string
}

type CompetitionRow = {
  id: string
  title: string
  competition_date: string
  status: string
}

function generateRecurringEvents(
  schedules: ScheduleRow[],
  groups: TrainingGroup[],
  weeksAhead = 8,
): Event[] {
  const events: Event[] = []
  const groupMap = new Map(groups.map((g) => [g.id, g.name]))
  const today = new Date()
  const startOfWeek = new Date(today)
  startOfWeek.setDate(today.getDate() - today.getDay() + 1) // Pazartesi

  for (let w = 0; w < weeksAhead; w++) {
    for (const s of schedules) {
      const dayOffset = s.day_of_week - 1 // 0=Pazartesi
      const date = new Date(startOfWeek)
      date.setDate(startOfWeek.getDate() + w * 7 + dayOffset)

      const [sh, sm] = s.start_time.split(':').map(Number)
      const [eh, em] = s.end_time.split(':').map(Number)

      const start = new Date(date)
      start.setHours(sh, sm, 0, 0)
      const end = new Date(date)
      end.setHours(eh, em, 0, 0)

      events.push({
        title: groupMap.get(s.group_id) ?? 'Antrenman',
        start,
        end,
        resource: { type: 'training' },
      })
    }
  }
  return events
}

export default function CalendarPage() {
  const [loading, setLoading] = useState(true)
  const [schedules, setSchedules] = useState<ScheduleRow[]>([])
  const [groups, setGroups] = useState<TrainingGroup[]>([])
  const [exams, setExams] = useState<BeltExamRow[]>([])
  const [competitions, setCompetitions] = useState<CompetitionRow[]>([])

  useEffect(() => {
    void (async () => {
      const [sRes, gRes, eRes, cRes] = await Promise.all([
        supabase.from('group_schedules').select('*').order('day_of_week'),
        supabase.from('training_groups').select('id, name').eq('is_active', true),
        supabase.from('belt_exams').select('*').gte('exam_date', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)),
        supabase.from('competitions').select('*').gte('competition_date', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)),
      ])

      setSchedules(sRes.data ?? [])
      setGroups(gRes.data ?? [])
      setExams(eRes.data ?? [])
      setCompetitions(cRes.data ?? [])
      setLoading(false)
    })()
  }, [])

  const events = useMemo(() => {
    const trainingEvents = generateRecurringEvents(schedules, groups)

    const examEvents: Event[] = exams.map((e) => ({
      title: `📝 ${e.title}`,
      start: new Date(e.exam_date + 'T09:00:00'),
      end: new Date(e.exam_date + 'T17:00:00'),
      allDay: true,
      resource: { type: 'exam', status: e.status },
    }))

    const compEvents: Event[] = competitions.map((c) => ({
      title: `🏆 ${c.title}`,
      start: new Date(c.competition_date + 'T09:00:00'),
      end: new Date(c.competition_date + 'T17:00:00'),
      allDay: true,
      resource: { type: 'competition', status: c.status },
    }))

    return [...trainingEvents, ...examEvents, ...compEvents]
  }, [schedules, groups, exams, competitions])

  const eventPropGetter = (event: Event) => {
    const type = (event.resource as any)?.type
    switch (type) {
      case 'exam':
        return { className: 'bg-amber-500 border-amber-600 text-white' }
      case 'competition':
        return { className: 'bg-violet-500 border-violet-600 text-white' }
      default:
        return { className: 'bg-brand-cyan border-cyan-700 text-white' }
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <LoadingSkeleton variant="card" count={3} />
      </div>
    )
  }

  return (
    <div className="glass-panel rounded-2xl p-4">
      <h1 className="mb-4 text-lg font-semibold text-slate-800">Takvim</h1>
      <div className="h-[600px] lg:h-[700px]">
        <Calendar
          localizer={localizer}
          events={events}
          startAccessor="start"
          endAccessor="end"
          eventPropGetter={eventPropGetter}
          defaultView="month"
          views={['month', 'week', 'day']}
          popup
          selectable={false}
          style={{ fontFamily: 'inherit' }}
        />
      </div>
    </div>
  )
}
