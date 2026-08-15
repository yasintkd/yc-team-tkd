-- 1. Malzeme tablosu RLS'ini de kapat
ALTER TABLE public.products DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.athlete_orders DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.athlete_order_items DISABLE ROW LEVEL SECURITY;

-- 2. Hata sebebi: Tip uyumsuzluğu (color enum)
-- Eğer color sütununa veritabanında 'mavi' veya 'kırmızı' dışında bir şey geliyorsa (veya boşsa) hata verir.
-- public.product_color tipini doğrula ve gerekirse NULL'a izin ver.
ALTER TABLE public.athlete_order_items 
ALTER COLUMN color DROP NOT NULL;

-- 3. Veri bütünlüğü: products tablosunda silinmiş ürünlere referans veren item var mı?
DELETE FROM public.athlete_order_items 
WHERE product_id NOT IN (SELECT id FROM public.products);

-- 4. Orphan sipariş temizliği (items içermeyen boş siparişleri temizle)
DELETE FROM public.athlete_orders 
WHERE id NOT IN (SELECT order_id FROM public.athlete_order_items);