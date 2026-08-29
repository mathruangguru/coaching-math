import { supabase, hasSupabase } from "./supabase";

function assertReady() {
  if (!hasSupabase) throw new Error("Supabase belum dikonfigurasi.");
}

/**
 * Panggil Edge Function `admin-users`. Semua operasi user yang butuh
 * service_role lewat sini (create / set_password / delete).
 */
async function callAdminUsers(body) {
  assertReady();
  const { data, error } = await supabase.functions.invoke("admin-users", {
    body,
  });
  if (error) {
    let detail = "";
    try {
      const res = await error.context?.json();
      detail = res?.error ?? "";
    } catch {
      // biarin — pakai pesan default
    }
    throw new Error(
      detail ||
        "Gagal. Pastikan Edge Function 'admin-users' sudah di-deploy."
    );
  }
  return data;
}

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
 * Lewat Admin API di Edge Function -> nggak kirim email (nggak kena rate
 * limit), "Allow signups" boleh OFF.
 */
export async function createUser({
  email,
  password,
  role = "student",
  firstName = "",
  lastName = "",
}) {
  return callAdminUsers({
    action: "create",
    email: email.trim(),
    password,
    role,
    firstName: firstName.trim(),
    lastName: lastName.trim(),
  });
}

/**
 * Ganti role user. Update biasa — dijaga RLS "update admin".
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
 * Set password user lain (kasus lupa password). Butuh Edge Function.
 */
export async function setUserPassword(userId, password) {
  return callAdminUsers({ action: "set_password", userId, password });
}

/**
 * Hapus user (auth.users). Profile & progress ikut kehapus (cascade).
 */
export async function deleteUser(userId) {
  return callAdminUsers({ action: "delete", userId });
}
