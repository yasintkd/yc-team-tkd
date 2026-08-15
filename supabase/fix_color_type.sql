-- Hata kaynağı: 'color' sütunu USER-DEFINED (enum) tipinde, uygulama ise 'text' bekliyor veya enum değerlerini (mavi/kırmızı) kabul etmiyor.
-- Geçici çözüm: Sütunu 'text' tipine çevirip kısıtlamayı kaldır.

ALTER TABLE public.athlete_order_items 
ALTER COLUMN color TYPE text USING color::text;