import { supabase } from "./src/lib/supabase";
supabase.from("athlete_orders").select("*").then(({ data, error }) => {
  if (error) console.error(error);
  else console.log(JSON.stringify(data, null, 2));
  process.exit();
});
