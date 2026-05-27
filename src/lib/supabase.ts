import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Supabase ortam değişkenleri eksik. .env dosyasında VITE_SUPABASE_URL ve VITE_SUPABASE_ANON_KEY tanımlayın.',
  )
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
