-- Tabloların varlığını ve kolonlarını kontrol eden otomatik SQL
DO $$
BEGIN
    -- 1. Tablo varlık kontrolü
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'athlete_orders') THEN
        RAISE NOTICE 'TABLO EKSİK: athlete_orders';
    ELSE
        RAISE NOTICE 'TABLO MEVCUT: athlete_orders';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'athlete_order_items') THEN
        RAISE NOTICE 'TABLO EKSİK: athlete_order_items';
    ELSE
        RAISE NOTICE 'TABLO MEVCUT: athlete_order_items';
    END IF;
END $$;

-- 2. Eğer tablo varsa, kolon yapısını (özellikle materials.tsx beklentisi) listele
SELECT table_name, column_name, data_type 
FROM information_schema.columns 
WHERE table_name IN ('athlete_orders', 'athlete_order_items')
ORDER BY table_name, column_name;