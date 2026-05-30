-- ============================================================
-- YÇ Team Taekwondo — Gruplar & Kuşak Sınavı (migration)
-- Mevcut projeye eklemek için SQL Editor'de çalıştırın.
-- ============================================================

create table if not exists public.training_groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists training_groups_set_updated_at on public.training_groups;
create trigger training_groups_set_updated_at
  before update on public.training_groups
  for each row execute function public.set_updated_at();

alter table public.athletes
  add column if not exists training_group_id uuid references public.training_groups (id) on delete set null;

create index if not exists athletes_training_group_id_idx on public.athletes (training_group_id);

create table if not exists public.group_schedules (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.training_groups (id) on delete cascade,
  day_of_week integer not null check (day_of_week between 1 and 7),
  start_time time not null,
  end_time time not null,
  created_at timestamptz not null default now(),
  check (end_time > start_time)
);

create index if not exists group_schedules_group_id_idx on public.group_schedules (group_id);

create table if not exists public.belt_exams (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  exam_date date not null,
  status text not null default 'planlandi'
    check (status in ('planlandi', 'tamamlandi')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists belt_exams_set_updated_at on public.belt_exams;
create trigger belt_exams_set_updated_at
  before update on public.belt_exams
  for each row execute function public.set_updated_at();

create table if not exists public.belt_exam_participants (
  id uuid primary key default gen_random_uuid(),
  exam_id uuid not null references public.belt_exams (id) on delete cascade,
  athlete_id uuid not null references public.athletes (id) on delete cascade,
  belt_before text not null,
  target_belt text not null,
  result text not null default 'bekliyor'
    check (result in ('bekliyor', 'gecti', 'kaldi')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (exam_id, athlete_id)
);

create index if not exists belt_exam_participants_exam_id_idx on public.belt_exam_participants (exam_id);

drop trigger if exists belt_exam_participants_set_updated_at on public.belt_exam_participants;
create trigger belt_exam_participants_set_updated_at
  before update on public.belt_exam_participants
  for each row execute function public.set_updated_at();

alter table public.training_groups enable row level security;
alter table public.group_schedules enable row level security;
alter table public.belt_exams enable row level security;
alter table public.belt_exam_participants enable row level security;

-- Giriş yapmış kullanıcılar (authenticated) — anon değil
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
