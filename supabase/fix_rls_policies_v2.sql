-- 1. RLS tamamen kapat (Erişimi acilen geri getir)
ALTER TABLE public.athletes DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.training_groups DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_records DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.athlete_licenses DISABLE ROW LEVEL SECURITY;

-- 2. Vize bilgilerini kontrol et (Eksikse lisans kaydı yok demektir)
-- Vizesi yok görününenlerin license tablosunda kaydı var mı?
SELECT count(*) 
FROM public.athletes a 
LEFT JOIN public.athlete_licenses al ON a.id = al.athlete_id 
WHERE al.id IS NULL;

-- 3. Grup eşleşmesini kontrol et
-- training_group_id'si olup da training_groups tablosunda kaydı olmayanlar
SELECT count(*) 
FROM public.athletes a 
LEFT JOIN public.training_groups tg ON a.training_group_id = tg.id 
WHERE a.training_group_id IS NOT NULL AND tg.id IS NULL;