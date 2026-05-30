-- ============================================================
-- YÇ Team Taekwondo Salon Yönetim Sistemi — Supabase Tabloları
-- Project ID: zmgqvararkclptcwafzh
--
-- Kullanım: Supabase Dashboard → SQL Editor → New query
-- Bu dosyanın tamamını yapıştırıp Run ile çalıştırın.
-- ============================================================

-- Güncelleme zamanı için yardımcı fonksiyon
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ------------------------------------------------------------
-- 1) SPORCULAR (athletes)
-- ------------------------------------------------------------
create table if not exists public.athletes (
  id uuid primary key default gen_random_uuid(),
  first_name text not null,
  last_name text not null,
  birth_date date,
  phone text,
  belt text not null,
  branch text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists athletes_last_name_idx on public.athletes (last_name);
create index if not exists athletes_is_active_idx on public.athletes (is_active);

drop trigger if exists athletes_set_updated_at on public.athletes;
create trigger athletes_set_updated_at
  before update on public.athletes
  for each row
  execute function public.set_updated_at();

comment on table public.athletes is 'Akademi sporcuları';
comment on column public.athletes.belt is 'Kuşak derecesi (Gıp / Dan)';
comment on column public.athletes.branch is 'Branş (Poomsae, Kyorugi vb.)';

-- ------------------------------------------------------------
-- 2) AİDAT ÖDEMELERİ (fee_payments)
-- ------------------------------------------------------------
create table if not exists public.fee_payments (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references public.athletes (id) on delete cascade,
  period_year integer not null check (period_year >= 2000),
  period_month integer not null check (period_month between 1 and 12),
  amount numeric(10, 2),
  status text not null default 'odenmedi'
    check (status in ('odendi', 'odenmedi')),
  paid_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (athlete_id, period_year, period_month)
);

create index if not exists fee_payments_athlete_id_idx on public.fee_payments (athlete_id);
create index if not exists fee_payments_period_idx on public.fee_payments (period_year, period_month);
create index if not exists fee_payments_status_idx on public.fee_payments (status);

drop trigger if exists fee_payments_set_updated_at on public.fee_payments;
create trigger fee_payments_set_updated_at
  before update on public.fee_payments
  for each row
  execute function public.set_updated_at();

comment on table public.fee_payments is 'Sporcu aylık aidat ödemeleri';
comment on column public.fee_payments.status is 'odendi | odenmedi';

-- ------------------------------------------------------------
-- 3) YOKLAMA (attendance_records)
-- ------------------------------------------------------------
create table if not exists public.attendance_records (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references public.athletes (id) on delete cascade,
  session_date date not null default current_date,
  training_group text,
  status text not null default 'gelmedi'
    check (status in ('geldi', 'gelmedi')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (athlete_id, session_date, training_group)
);

create index if not exists attendance_records_athlete_id_idx on public.attendance_records (athlete_id);
create index if not exists attendance_records_session_date_idx on public.attendance_records (session_date);
create index if not exists attendance_records_status_idx on public.attendance_records (status);

drop trigger if exists attendance_records_set_updated_at on public.attendance_records;
create trigger attendance_records_set_updated_at
  before update on public.attendance_records
  for each row
  execute function public.set_updated_at();

comment on table public.attendance_records is 'Günlük antrenman yoklamaları';
comment on column public.attendance_records.status is 'geldi | gelmedi';

-- ------------------------------------------------------------
-- Row Level Security (RLS)
-- Not: Auth kurulumundan önce geliştirme için anon erişim açıktır.
-- Üretimde mutlaka Auth + kısıtlayıcı politikalar kullanın.
-- ------------------------------------------------------------
alter table public.athletes enable row level security;
alter table public.fee_payments enable row level security;
alter table public.attendance_records enable row level security;

-- Mevcut politikaları temizle (yeniden çalıştırılabilir olması için)
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

-- Geliştirme: anon key ile tam erişim (Auth ekledikten sonra kaldırın)
create policy "athletes_select_anon" on public.athletes for select to anon using (true);
create policy "athletes_insert_anon" on public.athletes for insert to anon with check (true);
create policy "athletes_update_anon" on public.athletes for update to anon using (true) with check (true);
create policy "athletes_delete_anon" on public.athletes for delete to anon using (true);

create policy "fee_payments_select_anon" on public.fee_payments for select to anon using (true);
create policy "fee_payments_insert_anon" on public.fee_payments for insert to anon with check (true);
create policy "fee_payments_update_anon" on public.fee_payments for update to anon using (true) with check (true);
create policy "fee_payments_delete_anon" on public.fee_payments for delete to anon using (true);

create policy "attendance_select_anon" on public.attendance_records for select to anon using (true);
create policy "attendance_insert_anon" on public.attendance_records for insert to anon with check (true);
create policy "attendance_update_anon" on public.attendance_records for update to anon using (true) with check (true);
create policy "attendance_delete_anon" on public.attendance_records for delete to anon using (true);

-- ------------------------------------------------------------
-- Örnek veri (isteğe bağlı — test için)
-- ------------------------------------------------------------
-- insert into public.athletes (first_name, last_name, birth_date, phone, belt, branch)
-- values
--   ('Ali', 'Yılmaz', '2012-05-10', '05551234567', 'Sarı (9. Gıp)', 'Kyorugi'),
--   ('Zeynep', 'Demir', '2010-08-22', '05559876543', 'Mavi (4. Gıp)', 'Poomsae');
