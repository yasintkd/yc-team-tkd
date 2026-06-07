import { supabase } from './supabase'

export type Notification = {
  id: string
  type: 'exam_upcoming' | 'exam_passed' | 'missed_attendance'
  title: string
  description: string
  link?: string
}

export async function fetchNotifications(): Promise<Notification[]> {
  const notes: Notification[] = []
  const today = new Date().toISOString().slice(0, 10)

  // Yaklaşan sınavlar (7 gün içinde)
  const { data: exams } = await supabase
    .from('belt_exams')
    .select('id, title, exam_date')
    .eq('status', 'planlandi')
    .gte('exam_date', today)
    .lte('exam_date', new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10))
    .order('exam_date')

  for (const e of exams ?? []) {
    notes.push({
      id: `exam-${e.id}`,
      type: 'exam_upcoming',
      title: 'Yaklaşan sınav',
      description: `${e.title} – ${new Date(e.exam_date).toLocaleDateString('tr-TR')}`,
      link: '/kusak-sinavi',
    })
  }

  // Geçmiş sınavlar (bugün)
  const { data: passedExams } = await supabase
    .from('belt_exams')
    .select('id, title')
    .eq('exam_date', today)
    .neq('status', 'planlandi')

  for (const e of passedExams ?? []) {
    notes.push({
      id: `passed-${e.id}`,
      type: 'exam_passed',
      title: 'Bugün sınav var',
      description: e.title,
      link: '/kusak-sinavi',
    })
  }

  return notes
}
