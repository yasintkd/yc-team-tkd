-- Tüm kısıtlamaları RLS dahil kaldır
-- Supabase arayüzündeki RLS ayarını da tablo bazında kapatır
alter table if exists public.athlete_orders disable row level security;
alter table if exists public.athlete_order_items disable row level security;
alter table if exists public.athletes disable row level security;
alter table if exists public.products disable row level security;

-- Tüm politikaları temizle
do $$
declare
  r record;
begin
  for r in (select policyname, tablename from pg_policies where schemaname = 'public') loop
    execute 'drop policy if exists ' || quote_ident(r.policyname) || ' on ' || quote_ident(r.tablename);
  end loop;
end $$;