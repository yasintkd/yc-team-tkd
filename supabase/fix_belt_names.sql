-- Sporcu kuşak değerlerini BELTS dizisine göre düzelt
-- Veritabanında: "Mavi (4. Gıp)" → "Mavi Kuşak (4. Gıp)"

update public.athletes
set belt =
  case
    when belt = 'Beyaz (10. Gıp)'          then 'Beyaz Kuşak (10. Gıp)'
    when belt = 'Sarı (8. Gıp)'             then 'Sarı Kuşak (8. Gıp)'
    when belt = 'Sarı Yeşil (7. Gıp)'       then 'Sarı Yeşil Kuşak (7. Gıp)'
    when belt = 'Yeşil (6. Gıp)'            then 'Yeşil Kuşak (6. Gıp)'
    when belt = 'Yeşil Mavi (5. Gıp)'       then 'Yeşil Mavi Kuşak (5. Gıp)'
    when belt = 'Mavi (4. Gıp)'             then 'Mavi Kuşak (4. Gıp)'
    when belt = 'Mavi Kırmızı (3. Gıp)'     then 'Mavi Kırmızı Kuşak (3. Gıp)'
    when belt = 'Kırmızı (2. Gıp)'          then 'Kırmızı Kuşak (2. Gıp)'
    when belt = 'Kırmızı Siyah (1. Gıp)'    then 'Kırmızı Siyah Kuşak (1. Gıp)'
    when belt = 'Kırmızı Siyah (1. Pum)'    then 'Kırmızı Siyah Kuşak (1. Pum)'
    when belt = 'Kırmızı Siyah (2. Pum)'    then 'Kırmızı Siyah Kuşak (2. Pum)'
    else belt
  end
where belt not like '%Kuşak%';
