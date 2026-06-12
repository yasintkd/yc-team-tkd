-- ─── Lisans Vize Tablosu ──────────────────────────────────────────
create table if not exists athlete_licenses (
  id          uuid default gen_random_uuid() primary key,
  athlete_id  uuid not null references athletes(id) on delete cascade,
  year        integer not null,
  created_at  timestamptz default now(),
  unique(athlete_id, year)
);

-- Index for quick lookups by year
create index if not exists idx_athlete_licenses_year on athlete_licenses(year);
create index if not exists idx_athlete_licenses_athlete on athlete_licenses(athlete_id);

-- RLS
alter table athlete_licenses enable row level security;

create policy "authenticated all"
  on athlete_licenses for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');