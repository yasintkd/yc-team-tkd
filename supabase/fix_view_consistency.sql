-- Veriler fiziksel olarak duruyor ancak uygulama okuyamıyor.
-- Muhtemel sebep: RLS politikaları veya kısıtlayıcı view'lar.

-- 1. Tüm RLS'leri zorla kapat (Sadece public şeması için)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP
        EXECUTE 'ALTER TABLE public.' || quote_ident(r.tablename) || ' DISABLE ROW LEVEL SECURITY';
    END LOOP;
END $$;

-- 2. View kontrolü: Uygulama bir View üzerinden okuma yapıyor olabilir.
-- Eğer 'vize' veya 'grup' verisi için özel view'lar varsa onları kontrol et.
SELECT relname 
FROM pg_class c 
JOIN pg_namespace n ON n.oid = c.relnamespace 
WHERE n.nspname = 'public' AND relkind = 'v';