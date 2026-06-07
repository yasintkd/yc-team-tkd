-- ============================================================
-- Malzeme Takip Sistemi — Tedarikçi, Ürün, Sipariş, Dağıtım
-- ============================================================

-- ------------------------------------------------------------
-- 1) TEDARİKÇİLER
-- ------------------------------------------------------------
create table if not exists public.suppliers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists suppliers_set_updated_at on public.suppliers;
create trigger suppliers_set_updated_at
  before update on public.suppliers
  for each row
  execute function public.set_updated_at();

-- ------------------------------------------------------------
-- 2) ÜRÜNLER
-- ------------------------------------------------------------
create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,                   -- "Taekwondo Kıyafeti", "Koruyucu Set"
  category text,                        -- giyim / koruyucu / ayak / aksesuar
  supplier_id uuid references public.suppliers (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists products_set_updated_at on public.products;
create trigger products_set_updated_at
  before update on public.products
  for each row
  execute function public.set_updated_at();

-- ------------------------------------------------------------
-- 3) ÜRÜN VARYANTLARI (beden, boy vb.)
-- ------------------------------------------------------------
create table if not exists public.product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  label text not null,                  -- "130 cm", "S", "M", "L"
  price numeric(10,2) not null default 0,  -- güncel fiyat
  stock integer not null default 0,        -- eldeki adet
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists product_variants_set_updated_at on public.product_variants;
create trigger product_variants_set_updated_at
  before update on public.product_variants
  for each row
  execute function public.set_updated_at();

-- ------------------------------------------------------------
-- 4) SİPARİŞLER (tedarikçiye verilen)
-- ------------------------------------------------------------
create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid not null references public.suppliers (id) on delete cascade,
  order_date date not null default current_date,
  delivery_status text not null default 'pending'
    check (delivery_status in ('pending', 'partial', 'delivered')),
  delivered_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists orders_set_updated_at on public.orders;
create trigger orders_set_updated_at
  before update on public.orders
  for each row
  execute function public.set_updated_at();

-- ------------------------------------------------------------
-- 5) SİPARİŞ KALEMLERİ
-- ------------------------------------------------------------
create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  variant_id uuid not null references public.product_variants (id) on delete cascade,
  quantity integer not null check (quantity > 0),
  unit_price numeric(10,2) not null,      -- sipariş anındaki birim fiyat
  created_at timestamptz not null default now()
);

create index if not exists order_items_order_id_idx on public.order_items (order_id);

-- ------------------------------------------------------------
-- 6) STOK HAREKETLERİ (giriş/çıkış/iade)
-- ------------------------------------------------------------
create table if not exists public.stock_moves (
  id uuid primary key default gen_random_uuid(),
  variant_id uuid not null references public.product_variants (id) on delete cascade,
  quantity integer not null,              -- (+) giriş / (-) çıkış
  reference_type text,                    -- 'order' | 'distribution' | 'return' | 'adjustment'
  reference_id uuid,                      -- order_items.id veya distributions.id
  note text,
  created_at timestamptz not null default now()
);

create index if not exists stock_moves_variant_id_idx on public.stock_moves (variant_id);

-- ------------------------------------------------------------
-- 7) SPORCU DAĞITIM
-- ------------------------------------------------------------
create table if not exists public.distributions (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references public.athletes (id) on delete cascade,
  variant_id uuid not null references public.product_variants (id) on delete cascade,
  order_item_id uuid references public.order_items (id) on delete set null,
  quantity integer not null default 1,
  total_price numeric(10,2) not null,     -- sporcuya maliyeti
  is_paid boolean not null default true,  -- varsayılan: ödendi
  paid_amount numeric(10,2),              -- kısmi ödeme varsa girilir
  note text,                              -- "200 borcu kaldı" gibi
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists distributions_athlete_id_idx on public.distributions (athlete_id);
create index if not exists distributions_variant_id_idx on public.distributions (variant_id);

drop trigger if exists distributions_set_updated_at on public.distributions;
create trigger distributions_set_updated_at
  before update on public.distributions
  for each row
  execute function public.set_updated_at();

-- ------------------------------------------------------------
-- RLS (geliştirme: anon erişim)
-- ------------------------------------------------------------
alter table public.suppliers enable row level security;
alter table public.products enable row level security;
alter table public.product_variants enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.stock_moves enable row level security;
alter table public.distributions enable row level security;

do $$ begin
  -- suppliers
  drop policy if exists "suppliers_select_anon" on public.suppliers;
  create policy "suppliers_select_anon" on public.suppliers for select to anon using (true);
  drop policy if exists "suppliers_insert_anon" on public.suppliers;
  create policy "suppliers_insert_anon" on public.suppliers for insert to anon with check (true);
  drop policy if exists "suppliers_update_anon" on public.suppliers;
  create policy "suppliers_update_anon" on public.suppliers for update to anon using (true) with check (true);
  drop policy if exists "suppliers_delete_anon" on public.suppliers;
  create policy "suppliers_delete_anon" on public.suppliers for delete to anon using (true);

  -- products
  drop policy if exists "products_select_anon" on public.products;
  create policy "products_select_anon" on public.products for select to anon using (true);
  drop policy if exists "products_insert_anon" on public.products;
  create policy "products_insert_anon" on public.products for insert to anon with check (true);
  drop policy if exists "products_update_anon" on public.products;
  create policy "products_update_anon" on public.products for update to anon using (true) with check (true);
  drop policy if exists "products_delete_anon" on public.products;
  create policy "products_delete_anon" on public.products for delete to anon using (true);

  -- product_variants
  drop policy if exists "variants_select_anon" on public.product_variants;
  create policy "variants_select_anon" on public.product_variants for select to anon using (true);
  drop policy if exists "variants_insert_anon" on public.product_variants;
  create policy "variants_insert_anon" on public.product_variants for insert to anon with check (true);
  drop policy if exists "variants_update_anon" on public.product_variants;
  create policy "variants_update_anon" on public.product_variants for update to anon using (true) with check (true);
  drop policy if exists "variants_delete_anon" on public.product_variants;
  create policy "variants_delete_anon" on public.product_variants for delete to anon using (true);

  -- orders
  drop policy if exists "orders_select_anon" on public.orders;
  create policy "orders_select_anon" on public.orders for select to anon using (true);
  drop policy if exists "orders_insert_anon" on public.orders;
  create policy "orders_insert_anon" on public.orders for insert to anon with check (true);
  drop policy if exists "orders_update_anon" on public.orders;
  create policy "orders_update_anon" on public.orders for update to anon using (true) with check (true);
  drop policy if exists "orders_delete_anon" on public.orders;
  create policy "orders_delete_anon" on public.orders for delete to anon using (true);

  -- order_items
  drop policy if exists "order_items_select_anon" on public.order_items;
  create policy "order_items_select_anon" on public.order_items for select to anon using (true);
  drop policy if exists "order_items_insert_anon" on public.order_items;
  create policy "order_items_insert_anon" on public.order_items for insert to anon with check (true);
  drop policy if exists "order_items_delete_anon" on public.order_items;
  create policy "order_items_delete_anon" on public.order_items for delete to anon using (true);

  -- stock_moves
  drop policy if exists "stock_moves_select_anon" on public.stock_moves;
  create policy "stock_moves_select_anon" on public.stock_moves for select to anon using (true);
  drop policy if exists "stock_moves_insert_anon" on public.stock_moves;
  create policy "stock_moves_insert_anon" on public.stock_moves for insert to anon with check (true);

  -- distributions
  drop policy if exists "distributions_select_anon" on public.distributions;
  create policy "distributions_select_anon" on public.distributions for select to anon using (true);
  drop policy if exists "distributions_insert_anon" on public.distributions;
  create policy "distributions_insert_anon" on public.distributions for insert to anon with check (true);
  drop policy if exists "distributions_update_anon" on public.distributions;
  create policy "distributions_update_anon" on public.distributions for update to anon using (true) with check (true);
  drop policy if exists "distributions_delete_anon" on public.distributions;
  create policy "distributions_delete_anon" on public.distributions for delete to anon using (true);
end $$;
