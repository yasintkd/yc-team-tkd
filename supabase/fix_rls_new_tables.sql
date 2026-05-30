-- ============================================================
-- RLS düzeltmesi: yeni tablolar için authenticated erişimi
-- Hata: "new row violates row-level security policy for table training_groups"
-- Supabase Dashboard → SQL Editor → Run
-- ============================================================

-- Eski anon politikalarını kaldır (varsa)
drop policy if exists "training_groups_anon" on public.training_groups;
drop policy if exists "group_schedules_anon" on public.group_schedules;
drop policy if exists "belt_exams_anon" on public.belt_exams;
drop policy if exists "belt_exam_participants_anon" on public.belt_exam_participants;

-- Giriş yapmış kullanıcılar (authenticated) için tam erişim
drop policy if exists "training_groups_crud_auth" on public.training_groups;
create policy "training_groups_crud_auth"
on public.training_groups
for all
to authenticated
using (true)
with check (true);

drop policy if exists "group_schedules_crud_auth" on public.group_schedules;
create policy "group_schedules_crud_auth"
on public.group_schedules
for all
to authenticated
using (true)
with check (true);

drop policy if exists "belt_exams_crud_auth" on public.belt_exams;
create policy "belt_exams_crud_auth"
on public.belt_exams
for all
to authenticated
using (true)
with check (true);

drop policy if exists "belt_exam_participants_crud_auth" on public.belt_exam_participants;
create policy "belt_exam_participants_crud_auth"
on public.belt_exam_participants
for all
to authenticated
using (true)
with check (true);
