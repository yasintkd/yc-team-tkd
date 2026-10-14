import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
// env dosyası varsa yükle, yoksa doğrudan config kullanmaya çalış
// Genellikle src/lib/supabase.ts içerisinde bir supabase instance'ı zaten var.

import { supabase } from './src/lib/supabase.ts'; 

async function check() {
  const { data, error } = await supabase.from("athlete_orders").select("*");
  if (error) console.error("Hata:", error);
  else console.log("Veri:", JSON.stringify(data, null, 2));
}
check();
