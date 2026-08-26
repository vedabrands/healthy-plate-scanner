import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";

const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL ||
  process.env.VITE_SUPABASE_URL ||
  "https://picrurxloqxpszvsrgwf.supabase.co";

const SUPABASE_ANON_KEY =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  "sb_publishable_MA03QkWtbfy6tBfI9PkHPg_AuLZEjrH";

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
