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
    .select(
      "id, email, first_name, last_name, role, created_at, branch:coaching_branches(name)"
    )
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

const ROLES = ["student", "admin", "super_admin"];

/**
 * Parse teks bulk jadi { items, errors }. Dua format diterima:
 *   - JSON array: [{ email, firstName, lastName, password?, role? }, ...]
 *   - Baris (CSV-ish), 1 user per baris:
 *       email, nama depan, nama belakang, password?, role?
 * `password` boleh kosong -> digenerate server-side. `role` default student.
 */
export function parseUsersInput(text) {
  const raw = (text ?? "").trim();
  if (!raw) return { items: [], errors: ["Kosong."] };

  let rows;
  if (raw.startsWith("[")) {
    try {
      const arr = JSON.parse(raw);
      if (!Array.isArray(arr)) return { items: [], errors: ["JSON harus array."] };
      rows = arr.map((o, i) => ({
        _line: i + 1,
        email: o.email ?? o.Email ?? "",
        firstName: o.firstName ?? o.first_name ?? o.nama_depan ?? "",
        lastName: o.lastName ?? o.last_name ?? o.nama_belakang ?? "",
        password: o.password ?? "",
        role: o.role ?? "",
      }));
    } catch (err) {
      return { items: [], errors: [`JSON invalid: ${err.message}`] };
    }
  } else {
    rows = raw
      .split(/\r?\n/)
      .map((l, i) => ({ line: i + 1, cols: l.split(",").map((c) => c.trim()) }))
      .filter((r) => r.cols.some(Boolean))
      .map((r) => ({
        _line: r.line,
        email: r.cols[0] ?? "",
        firstName: r.cols[1] ?? "",
        lastName: r.cols[2] ?? "",
        password: r.cols[3] ?? "",
        role: r.cols[4] ?? "",
      }));
  }

  const items = [];
  const errors = [];
  const seen = new Set();
  for (const r of rows) {
    const email = String(r.email).trim().toLowerCase();
    const where = `baris ${r._line}`;
    if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      errors.push(`${where}: email nggak valid ("${r.email}")`);
      continue;
    }
    if (seen.has(email)) {
      errors.push(`${where}: email dobel ("${email}")`);
      continue;
    }
    seen.add(email);
    if (!String(r.firstName).trim() || !String(r.lastName).trim()) {
      errors.push(`${where}: nama depan & belakang wajib`);
      continue;
    }
    const password = String(r.password ?? "").trim();
    if (password && password.length < 6) {
      errors.push(`${where}: password < 6 karakter`);
      continue;
    }
    let role = String(r.role ?? "").trim().toLowerCase();
    if (role && !ROLES.includes(role)) {
      errors.push(`${where}: role "${role}" nggak dikenal`);
      continue;
    }
    items.push({
      email,
      firstName: String(r.firstName).trim(),
      lastName: String(r.lastName).trim(),
      password,
      role: role || "student",
    });
  }
  return { items, errors };
}

/**
 * Bikin banyak user sekaligus lewat Edge Function. Balikannya:
 * { results: [{ email, ok, password?, role?, error? }] }
 * Non-super-admin: semua role dipaksa "student".
 */
export async function createUsersBulk(items) {
  return callAdminUsers({ action: "create_bulk", users: items });
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
