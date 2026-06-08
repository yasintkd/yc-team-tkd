-- ============================================================
-- YÇ Team Taekwondo — Yarışma Siklet ve Derece Takibi (migration)
-- Supabase SQL Editor'de çalıştırın.
-- ============================================================

-- 1) competitions tablosuna erkek ve kız sikletleri ekle (text array olarak)
ALTER TABLE public.competitions 
ADD COLUMN IF NOT EXISTS weight_categories_male text[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS weight_categories_female text[] DEFAULT '{}';

-- 2) competition_participants tablosuna derece (ranking) kolonunu ekle
ALTER TABLE public.competition_participants
ADD COLUMN IF NOT EXISTS ranking text;

-- Schema cache'i yenile
NOTIFY pgrst, 'reload schema';
