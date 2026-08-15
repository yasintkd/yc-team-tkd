-- Uzak veritabanı için güvenli özet
SELECT table_name, count(*) as row_count 
FROM information_schema.tables 
WHERE table_schema = 'public' 
GROUP BY table_name;
