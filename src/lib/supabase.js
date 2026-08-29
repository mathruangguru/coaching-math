import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// `hasSupabase` false = env belum diisi -> app fallback ke data mock.
export const hasSupabase = Boolean(url && anonKey);

if (!hasSupabase && import.meta.env.DEV) {
  console.warn(
    "[supabase] VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY belum diset. " +
      "Sementara pakai data mock. Isi .env (lihat .env.example)."
  );
}

export const supabase = hasSupabase ? createClient(url, anonKey) : null;
