import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Supabase ortam değişkenleri eksik. .env dosyasında VITE_SUPABASE_URL ve VITE_SUPABASE_ANON_KEY tanımlayın.',
  )
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// ─── Tip güvenli helper'lar ─────────────────────────────────────
// Kullanım:
//   const { data, error } = await from('athletes').select('*')
//   → data tipi: AthleteRow[]

/** Tablo adı → Row tipi eşlemesi */
export interface Tables {
  athletes: import('./database.types').AthleteRow
  training_groups: import('./database.types').TrainingGroupRow
  group_schedules: import('./database.types').GroupScheduleRow
  belt_exams: import('./database.types').BeltExamRow
  belt_exam_participants: import('./database.types').BeltExamParticipantRow
  competitions: import('./database.types').CompetitionRow
  competition_participants: import('./database.types').CompetitionParticipantRow
  products: import('./database.types').ProductRow
  athlete_orders: import('./database.types').AthleteOrderRow
  athlete_order_items: import('./database.types').AthleteOrderItemRow
  attendance_records: import('./database.types').AttendanceRecordRow
  fee_payments: import('./database.types').FeePaymentRow
}

/** Tip güvenli `supabase.from()` — dönüş tipini manuel cast eder */
export function from<T extends keyof Tables>(table: T) {
  return supabase.from(table) as any
}

/**
 * Tek satır sorgusu: ilk eşleşmeyi döndürür, yoksa null.
 */
export async function getRow<T extends keyof Tables>(
  table: T,
  column: string,
  value: unknown,
): Promise<{ data: Tables[T] | null; error: any }> {
  const { data, error } = await supabase
    .from(table)
    .select('*')
    .eq(column, value as any)
    .maybeSingle()
  return { data: data as Tables[T] | null, error }
}
/** where + order sorgusu için yardımcı */
export async function queryRows<T extends keyof Tables>(
  table: T,
  options?: {
    column?: string
    value?: unknown
    orderBy?: string
    ascending?: boolean
    limit?: number
  },
): Promise<{ data: Tables[T][]; error: any }> {
  let query = supabase.from(table).select('*')
  if (options?.column && options?.value !== undefined) {
    query = query.eq(options.column as string, options.value as any)
  }
  if (options?.orderBy) {
    query = query.order(options.orderBy, { ascending: options.ascending ?? true })
  }
  if (options?.limit) {
    query = query.limit(options.limit)
  }
  const { data, error } = await query
  return { data: (data ?? []) as Tables[T][], error }
}
