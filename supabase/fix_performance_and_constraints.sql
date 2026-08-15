-- Performans iyileştirme: Sık kullanılan sorgular için index ekle
CREATE INDEX IF NOT EXISTS idx_athlete_order_items_order_id ON public.athlete_order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_athlete_orders_athlete_id ON public.athlete_orders(athlete_id);

-- Tutarlılık kontrolü: Athlete_orders tablosunda yanlışlıkla NULL olan toplam tutarları sıfırla
UPDATE public.athlete_orders SET total_amount = 0 WHERE total_amount IS NULL;

-- Eksik Foreign Key kontrolü (Eğer eksikse ekle - güvenli)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_athlete_orders_athlete') THEN
        ALTER TABLE public.athlete_orders 
        ADD CONSTRAINT fk_athlete_orders_athlete 
        FOREIGN KEY (athlete_id) REFERENCES public.athletes(id) ON DELETE CASCADE;
    END IF;
END $$;