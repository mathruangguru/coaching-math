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
    .select("id, email, first_name, last_name, role, created_at")
    .order("created_at");
  if (error) throw error;
  return data;
}

/**
 * Bikin user baru. `payload`: { email, password, role, firstName, lastName }
 * Trigger DB bikin baris coaching_profiles (role 'student') dari user
 * metadata; nama & role admin ditulis ulang lewat client admin biar pasti.
 */
export async function createUser({
  email,
  password,
  role = "student",
  firstName = "",
  lastName = "",
}) {
  assertReady();

  const clean = email.trim();
  const first = firstName.trim();
  const last = lastName.trim();

  const { data, error } = await signupClient.auth.signUp({
    email: clean,
    password,
    options: { data: { first_name: first, last_name: last } },
  });
  if (error) throw error;

  // Buang sesi user baru dari scratch client.
  await signupClient.auth.signOut().catch(() => {});

  const id = data.user?.id ?? null;
  if (id) {
    const patch = { first_name: first || null, last_name: last || null };
    if (role === "admin") patch.role = "admin";
    const { error: patchErr } = await supabase
      .from("coaching_profiles")
      .update(patch)
      .eq("id", id);
    if (patchErr) throw patchErr;
  }

  return { id, email: clean, role, firstName: first, lastName: last };
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

/**
 * Set password user lain (buat kasus lupa password).
 * Lewat Edge Function `admin-set-password` — butuh service_role, jadi
 * nggak bisa dari client biasa. Deploy dulu function-nya (lihat
 * supabase/functions/admin-set-password/).
 */
export async function setUserPassword(userId, password) {
  assertReady();
  const { data, error } = await supabase.functions.invoke("admin-set-password", {
    body: { userId, password },
  });
  if (error) {
    // Pesan error dari function ada di body response-nya.
    let detail = "";
    try {
      const body = await error.context?.json();
      detail = body?.error ?? "";
    } catch {
      // biarin — pakai pesan default di bawah
    }
    throw new Error(
      detail ||
        "Gagal set password. Pastikan Edge Function 'admin-set-password' sudah di-deploy."
    );
  }
  return data;
}
