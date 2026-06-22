-- ============================================================
-- YÇ Team Taekwondo — attendance_records schedule_id FK + birth_date fix
-- ============================================================

-- 1. attendance_records'ta schedule_id varsa ekle
alter table public.attendance_records
  add column if not exists schedule_id uuid references public.group_schedules (id) on delete set null;

create index if not exists attendance_records_schedule_id_idx
  on public.attendance_records (schedule_id);

-- 2. athletes.birth_date text → date (schema'da zaten date, migration'la uyum)
-- Eğer birth_date string olarak text tipinde tutuluyorsa dönüştür
-- (Supabase'de kolon tipi date ise zaten doğru)
-- Sadece emin olmak için check ekle
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_name = 'athletes' and column_name = 'birth_date' and data_type = 'text'
  ) then
    alter table public.athletes
      alter column birth_date type date using birth_date::date;
  end if;
end $$;