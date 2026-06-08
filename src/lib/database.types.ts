// ─── Auto-generated — tüm tablolar şema + migration'lardan derlendi ───

// ──────────────────────────────────────────────
// ENUMS / CONST
// ──────────────────────────────────────────────

export type ExamStatus = 'planlandi' | 'tamamlandi'
export type ExamResult = 'bekliyor' | 'gecti' | 'kaldi'
export type AttendanceStatus = 'geldi' | 'gelmedi'
export type PaymentStatus = 'odendi' | 'odenmedi'
export type AthleteOrderPayment = 'odendi' | 'kismi' | 'bekliyor'
export type Gender = 'erkek' | 'kiz'

// ──────────────────────────────────────────────
// ROW TYPES (tablo satırları, Supabase'den dönen)
// ──────────────────────────────────────────────

export interface AthleteRow {
  id: string
  first_name: string
  last_name: string
  birth_date: string | null
  phone: string | null
  belt: string
  branch: string
  is_active: boolean
  gender: Gender | null
  tc_no: string | null
  mother_name: string | null
  father_name: string | null
  parent_name: string | null
  parent_phone: string | null
  parent_type: 'anne' | 'baba' | null
  training_group_id: string | null
  created_at: string
  updated_at: string
}

export interface TrainingGroupRow {
  id: string
  name: string
  notes: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface GroupScheduleRow {
  id: string
  group_id: string
  day_of_week: number // 1=Pazartesi … 7=Pazar
  start_time: string // HH:mm
  end_time: string // HH:mm
  created_at: string
}

export interface BeltExamRow {
  id: string
  title: string
  exam_date: string
  fee_amount: number
  status: ExamStatus
  notes: string | null
  created_at: string
  updated_at: string
}

export interface BeltExamParticipantRow {
  id: string
  exam_id: string
  athlete_id: string
  belt_before: string
  target_belt: string
  result: ExamResult
  fee_paid: boolean
  created_at: string
  updated_at: string
}

export interface CompetitionRow {
  id: string
  title: string
  competition_date: string
  birth_year_min: number | null
  birth_year_max: number | null
  min_belt_index: number
  status: ExamStatus
  weight_categories_male: string[] | null
  weight_categories_female: string[] | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface CompetitionParticipantRow {
  id: string
  competition_id: string
  athlete_id: string
  weight_category: string | null
  ranking: string | null
  created_at: string
  updated_at: string
}

export interface ProductRow {
  id: string
  name: string
  category: string | null
  price: number
  requires_boy: boolean
  requires_kilo: boolean
  requires_shoe_size: boolean
  requires_gender: boolean
  created_at: string
  updated_at: string
}

export interface AthleteOrderRow {
  id: string
  athlete_id: string
  total_amount: number
  payment_status: AthleteOrderPayment
  paid_amount: number | null
  note: string | null
  is_ordered: boolean
  is_delivered: boolean
  delivered_at: string | null
  created_at: string
  updated_at: string
}

export interface AthleteOrderItemRow {
  id: string
  order_id: string
  product_id: string
  boy_cm: number | null
  kilo: number | null
  shoe_size: number | null
  created_at: string
}

export interface AttendanceRecordRow {
  id: string
  athlete_id: string
  session_date: string
  training_group: string | null
  status: AttendanceStatus
  notes: string | null
  created_at: string
  updated_at: string
}

export interface FeePaymentRow {
  id: string
  athlete_id: string
  period_year: number
  period_month: number
  amount: number | null
  status: PaymentStatus
  paid_at: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

// ──────────────────────────────────────────────
// INSERT / UPDATE TYPES (Supabase'ye gönderilen)
// ──────────────────────────────────────────────

export type AthleteInsert = Omit<Partial<AthleteRow>, 'id' | 'created_at' | 'updated_at'>
export type AthleteUpdate = Partial<AthleteRow>

export type TrainingGroupInsert = Omit<Partial<TrainingGroupRow>, 'id' | 'created_at' | 'updated_at'>
export type TrainingGroupUpdate = Partial<TrainingGroupRow>

export type GroupScheduleInsert = Omit<Partial<GroupScheduleRow>, 'id' | 'created_at'>
export type GroupScheduleUpdate = Partial<GroupScheduleRow>

export type BeltExamInsert = Omit<Partial<BeltExamRow>, 'id' | 'created_at' | 'updated_at'>
export type BeltExamUpdate = Partial<BeltExamRow>

export type BeltExamParticipantInsert = Omit<Partial<BeltExamParticipantRow>, 'id' | 'created_at' | 'updated_at'>
export type BeltExamParticipantUpdate = Partial<BeltExamParticipantRow>

export type CompetitionInsert = Omit<Partial<CompetitionRow>, 'id' | 'created_at' | 'updated_at'>
export type CompetitionUpdate = Partial<CompetitionRow>

export type CompetitionParticipantInsert = Omit<Partial<CompetitionParticipantRow>, 'id' | 'created_at' | 'updated_at'>
export type CompetitionParticipantUpdate = Partial<CompetitionParticipantRow>

export type ProductInsert = Omit<Partial<ProductRow>, 'id' | 'created_at' | 'updated_at'>
export type ProductUpdate = Partial<ProductRow>

export type AthleteOrderInsert = Omit<Partial<AthleteOrderRow>, 'id' | 'created_at' | 'updated_at'>
export type AthleteOrderUpdate = Partial<AthleteOrderRow>

export type AthleteOrderItemInsert = Omit<Partial<AthleteOrderItemRow>, 'id' | 'created_at'>

export type AttendanceRecordInsert = Omit<Partial<AttendanceRecordRow>, 'id' | 'created_at' | 'updated_at'>
export type AttendanceRecordUpdate = Partial<AttendanceRecordRow>

// ──────────────────────────────────────────────
// JOIN HELPERS (select + expand)
// ──────────────────────────────────────────────

export interface AthleteWithGroup extends AthleteRow {
  training_groups: { name: string } | { name: string }[] | null
}

export interface BeltExamWithParticipants extends BeltExamRow {
  participants?: BeltExamParticipantWithAthlete[]
}

export interface BeltExamParticipantWithAthlete extends BeltExamParticipantRow {
  athletes: { first_name: string; last_name: string } | { first_name: string; last_name: string }[] | null
}

export interface CompetitionParticipantWithAthlete extends CompetitionParticipantRow {
  athletes:
    | { first_name: string; last_name: string; belt: string; gender: string | null }
    | { first_name: string; last_name: string; belt: string; gender: string | null }[]
    | null
}

export interface AthleteOrderWithItems extends AthleteOrderRow {
  athletes: { first_name: string; last_name: string } | null
  items: AthleteOrderItemWithProduct[]
}

export interface AthleteOrderItemWithProduct extends AthleteOrderItemRow {
  products: { name: string; price: number } | null
}
