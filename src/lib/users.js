import { createClient } from "@supabase/supabase-js";
import {
  supabase,
  hasSupabase,
  supabaseUrl,
  supabaseAnonKey,
} from "./supabase";

function assertReady() {
  if (!hasSupabase) throw new Error("Supabase belum dikonfigurasi.");
}

/**
 * Client Supabase terpisah khusus buat bikin user.
 * `persistSession: false` + storageKey sendiri -> `signUp` di sini nggak
 * menimpa sesi admin yang lagi login di client utama.
 */
const signupClient = hasSupabase
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        storageKey: "sb-signup-scratch",
      },
    })
  : null;

/**
 * Daftar semua user + role. Butuh caller = admin (dijaga RLS).
 */
export async function getUsers() {
  assertReady();
  const { data, error } = await supabase
    .from("coaching_profiles")
    .select("id, email, role, created_at")
    .order("created_at");
  if (error) throw error;
  return data;
}

/**
 * Bikin user baru. `payload`: { email, password, role }
 * Trigger DB otomatis bikin baris coaching_profiles (role 'student');
 * kalau role 'admin' diminta, langsung di-update lewat client admin.
 */
export async function createUser({ email, password, role = "student" }) {
  assertReady();

  const clean = email.trim();
  const { data, error } = await signupClient.auth.signUp({
    email: clean,
    password,
  });
  if (error) throw error;

  // Buang sesi user baru dari scratch client.
  await signupClient.auth.signOut().catch(() => {});

  const id = data.user?.id ?? null;
  if (role === "admin" && id) {
    const { error: roleErr } = await supabase
      .from("coaching_profiles")
      .update({ role: "admin" })
      .eq("id", id);
    if (roleErr) throw roleErr;
  }

  return { id, email: clean, role };
}

/**
 * Ganti role user. Butuh caller = admin (dijaga RLS).
 */
export async function setUserRole(id, role) {
  assertReady();
  const { error } = await supabase
    .from("coaching_profiles")
    .update({ role })
    .eq("id", id);
  if (error) throw error;
}
