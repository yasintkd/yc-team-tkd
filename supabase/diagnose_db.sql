-- 1. Tablo şema ve kayıt sayılarını listele
SELECT 
    schemaname, 
    relname AS table_name, 
    n_live_tup AS estimated_row_count
FROM pg_stat_user_tables
ORDER BY n_live_tup DESC;

-- 2. Son 10 hata veya uyarı (genel görünüm)
SELECT 
    relname, 
    relkind, 
    relhasrules, 
    relrowsecurity
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND relkind = 'r';

-- 3. Geçersiz (orphan) kayıt kontrolü (athlete_order_items tablosunda parent'ı olmayan kayıtlar)
SELECT count(*) as orphan_items
FROM public.athlete_order_items aoi
LEFT JOIN public.athlete_orders ao ON aoi.order_id = ao.id
WHERE ao.id IS NULL;