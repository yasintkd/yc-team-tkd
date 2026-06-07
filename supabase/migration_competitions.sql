-- ============================================================
-- YÇ Team Taekwondo — Yarışma Takibi (migration)
-- Mevcut projeye eklemek için SQL Editor'de çalıştırın.
-- ============================================================

-- Önce eski tabloyu temizle
drop table if exists public.competitions cascade;

create table public.competitions (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  competition_date date not null,
  birth_year_min integer,
  birth_year_max integer,
  min_belt_index integer default 0,
  status text not null default 'planlandi'
    check (status in ('planlandi', 'tamamlandi')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists competitions_set_updated_at on public.competitions;
create trigger competitions_set_updated_at
  before update on public.competitions
  for each row execute function public.set_updated_at();

create table if not exists public.competition_participants (
  id uuid primary key default gen_random_uuid(),
  competition_id uuid not null references public.competitions (id) on delete cascade,
  athlete_id uuid not null references public.athletes (id) on delete cascade,
  weight_category text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (competition_id, athlete_id)
);

create index if not exists competition_participants_competition_id_idx
  on public.competition_participants (competition_id);

drop trigger if exists competition_participants_set_updated_at on public.competition_participants;
create trigger competition_participants_set_updated_at
  before update on public.competition_participants
  for each row execute function public.set_updated_at();

-- RLS
alter table public.competitions enable row level security;
alter table public.competition_participants enable row level security;

drop policy if exists "competitions_crud_auth" on public.competitions;
create policy "competitions_crud_auth"
  on public.competitions for all to authenticated using (true) with check (true);

drop policy if exists "competition_participants_crud_auth" on public.competition_participants;
create policy "competition_participants_crud_auth"
  on public.competition_participants for all to authenticated using (true) with check (true);

-- Schema cache'i yenile (Supabase REST API'nin yeni kolonları görmesi için)
notify pgrst, 'reload schema';
