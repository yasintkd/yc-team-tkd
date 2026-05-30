-- ============================================================
-- RLS: Anon erişimi kapat, sadece authenticated izin ver
-- Supabase Dashboard → SQL Editor → New query → Run
-- ============================================================

-- Önce anon politikalarını kaldır
drop policy if exists "athletes_select_anon" on public.athletes;
drop policy if exists "athletes_insert_anon" on public.athletes;
drop policy if exists "athletes_update_anon" on public.athletes;
drop policy if exists "athletes_delete_anon" on public.athletes;

drop policy if exists "fee_payments_select_anon" on public.fee_payments;
drop policy if exists "fee_payments_insert_anon" on public.fee_payments;
drop policy if exists "fee_payments_update_anon" on public.fee_payments;
drop policy if exists "fee_payments_delete_anon" on public.fee_payments;

drop policy if exists "attendance_select_anon" on public.attendance_records;
drop policy if exists "attendance_insert_anon" on public.attendance_records;
drop policy if exists "attendance_update_anon" on public.attendance_records;
drop policy if exists "attendance_delete_anon" on public.attendance_records;

-- Authenticated kullanıcılara (giriş yapmış) CRUD izni ver
drop policy if exists "athletes_crud_auth" on public.athletes;
create policy "athletes_crud_auth"
on public.athletes
for all
to authenticated
using (true)
with check (true);

drop policy if exists "fee_payments_crud_auth" on public.fee_payments;
create policy "fee_payments_crud_auth"
on public.fee_payments
for all
to authenticated
using (true)
with check (true);

drop policy if exists "attendance_crud_auth" on public.attendance_records;
create policy "attendance_crud_auth"
on public.attendance_records
for all
to authenticated
using (true)
with check (true);

-- Antrenman grupları & kuşak sınavı tabloları
drop policy if exists "training_groups_anon" on public.training_groups;
drop policy if exists "training_groups_crud_auth" on public.training_groups;
create policy "training_groups_crud_auth"
on public.training_groups for all to authenticated using (true) with check (true);

drop policy if exists "group_schedules_anon" on public.group_schedules;
drop policy if exists "group_schedules_crud_auth" on public.group_schedules;
create policy "group_schedules_crud_auth"
on public.group_schedules for all to authenticated using (true) with check (true);

drop policy if exists "belt_exams_anon" on public.belt_exams;
drop policy if exists "belt_exams_crud_auth" on public.belt_exams;
create policy "belt_exams_crud_auth"
on public.belt_exams for all to authenticated using (true) with check (true);

drop policy if exists "belt_exam_participants_anon" on public.belt_exam_participants;
drop policy if exists "belt_exam_participants_crud_auth" on public.belt_exam_participants;
create policy "belt_exam_participants_crud_auth"
on public.belt_exam_participants for all to authenticated using (true) with check (true);
