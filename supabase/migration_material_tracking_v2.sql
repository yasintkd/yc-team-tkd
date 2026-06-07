-- ============================================================
-- Malzeme Takip Sistemi — Yeni Yapı (Tedarikçisiz, Varyantsız)
-- ============================================================

-- Eski tabloları temizle (CASCADE ile bağımlılıkları da sil)
drop table if exists public.stock_moves;
drop table if exists public.distributions cascade;
drop table if exists public.order_items cascade;
drop table if exists public.orders cascade;
drop table if exists public.product_variants cascade;
drop table if exists public.suppliers cascade;

-- ------------------------------------------------------------
-- 1) ÜRÜNLER (özellikleri güncelle)
-- ------------------------------------------------------------
alter table public.products
  drop column if exists supplier_id,
  add column if not exists price numeric(10,2) not null default 0,
  add column if not exists requires_boy boolean not null default false,
  add column if not exists requires_kilo boolean not null default false,
  add column if not exists requires_shoe_size boolean not null default false,
  add column if not exists requires_gender boolean not null default false;

-- ------------------------------------------------------------
-- 2) SPORCU SİPARİŞLERİ
-- ------------------------------------------------------------
create table if not exists public.athlete_orders (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references public.athletes (id) on delete cascade,
  total_amount numeric(10,2) not null default 0,
  payment_status text not null default 'odendi'
    check (payment_status in ('odendi', 'kismi', 'bekliyor')),
  paid_amount numeric(10,2),
  note text,
  is_ordered boolean not null default false,
  is_delivered boolean not null default false,
  delivered_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Mevcut veritabanında delivered_at kolonunu ekle (güvenli tekrar)
alter table public.athlete_orders add column if not exists delivered_at timestamptz;

create index if not exists athlete_orders_athlete_id_idx on public.athlete_orders (athlete_id);

drop trigger if exists athlete_orders_set_updated_at on public.athlete_orders;
create trigger athlete_orders_set_updated_at
  before update on public.athlete_orders
  for each row
  execute function public.set_updated_at();

-- ------------------------------------------------------------
-- 3) SİPARİŞ KALEMLERİ (ürünler)
-- ------------------------------------------------------------
create table if not exists public.athlete_order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.athlete_orders (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete cascade,
  boy_cm numeric(5,1),
  kilo numeric(5,1),
  shoe_size numeric(4,1),
  created_at timestamptz not null default now()
);

create index if not exists athlete_order_items_order_id_idx on public.athlete_order_items (order_id);

-- ------------------------------------------------------------
-- RLS
-- ------------------------------------------------------------
alter table public.products enable row level security;
alter table public.athlete_orders enable row level security;
alter table public.athlete_order_items enable row level security;

do $$ begin
  -- products (v1'den kalan RLS var, politikaları yeniden oluştur)
  drop policy if exists "products_select_anon" on public.products;
  create policy "products_select_anon" on public.products for select to anon using (true);
  drop policy if exists "products_insert_anon" on public.products;
  create policy "products_insert_anon" on public.products for insert to anon with check (true);
  drop policy if exists "products_update_anon" on public.products;
  create policy "products_update_anon" on public.products for update to anon using (true) with check (true);
  drop policy if exists "products_delete_anon" on public.products;
  create policy "products_delete_anon" on public.products for delete to anon using (true);

  drop policy if exists "athlete_orders_select" on public.athlete_orders;
  create policy "athlete_orders_select" on public.athlete_orders for select to anon using (true);
  drop policy if exists "athlete_orders_insert" on public.athlete_orders;
  create policy "athlete_orders_insert" on public.athlete_orders for insert to anon with check (true);
  drop policy if exists "athlete_orders_update" on public.athlete_orders;
  create policy "athlete_orders_update" on public.athlete_orders for update to anon using (true) with check (true);
  drop policy if exists "athlete_orders_delete" on public.athlete_orders;
  create policy "athlete_orders_delete" on public.athlete_orders for delete to anon using (true);

  drop policy if exists "order_items_select" on public.athlete_order_items;
  create policy "order_items_select" on public.athlete_order_items for select to anon using (true);
  drop policy if exists "order_items_insert" on public.athlete_order_items;
  create policy "order_items_insert" on public.athlete_order_items for insert to anon with check (true);
  drop policy if exists "order_items_delete" on public.athlete_order_items;
  create policy "order_items_delete" on public.athlete_order_items for delete to anon using (true);
end $$;

-- ------------------------------------------------------------
-- Örnek ürünler
-- ------------------------------------------------------------
insert into public.products (name, price, requires_boy, requires_kilo, requires_shoe_size, requires_gender) values
  ('Taekwondo Kıyafeti (Dobok)', 1000, true, true, false, true),
  ('Dişlik (Mouthguard)', 200, false, false, false, false),
  ('Kol Kaval Koruyucu', 350, true, true, false, false),
  ('Ayaküstü Koruyucu', 300, false, false, true, false),
  ('Eldiven', 250, true, true, false, false),
  ('Kasık Koruyucu', 180, true, true, false, true)
on conflict do nothing;
