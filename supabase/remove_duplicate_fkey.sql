-- Çakışan foreign key'i silerek belirsizliği gider
-- athlete_orders tablosundaki fk_athlete_orders_athlete constraint'ini kaldırıyoruz
-- athlete_orders_athlete_id_fkey kalacak.

ALTER TABLE public.athlete_orders 
DROP CONSTRAINT IF EXISTS fk_athlete_orders_athlete;