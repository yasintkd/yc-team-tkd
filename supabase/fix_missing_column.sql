-- Eksik olan 'color' sütununu athlete_order_items tablosuna ekle
alter table if exists public.athlete_order_items 
add column if not exists color public.product_color;