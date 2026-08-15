-- Hata Logu ve View Analizi
-- 1. Material sayfasında kullanılan sorgu:
-- supabase.from('athlete_orders').select('*, athletes(first_name, last_name, gender), items:athlete_order_items(*, products(name, price))')

-- Sorun muhtemelen Foreign Key veya join edilen tablolardan birindeki RLS.
-- Tüm bağlı tabloların RLS durumunu kontrol et:
SELECT relname, relrowsecurity 
FROM pg_class 
WHERE relname IN ('athlete_orders', 'athlete_order_items', 'products', 'athletes');

-- 2. Eğer view varsa ve o bozuyorsa:
SELECT definition FROM pg_views WHERE viewname = 'athlete_order_items'; -- Eğer view ise