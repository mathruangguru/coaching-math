// Edge Function: operasi user yang butuh service_role (nggak boleh di frontend).
//   action "create"        -> { email, password, firstName, lastName, role }
//                             admin biasa: role dipaksa "student".
//   action "create_bulk"   -> { users: [{ email, firstName, lastName, password?, role? }] }
//                             password kosong -> digenerate; balik di results.
//   action "set_password"  -> { userId, password }   (super_admin only)
//   action "delete"        -> { userId }             (super_admin only)
//
// createUser lewat Admin API = TIDAK kirim email -> nggak kena email rate
// limit, dan "Allow new users to sign up" boleh OFF.
//
// Deploy (--no-verify-jwt wajib, kalau nggak preflight CORS ditolak 401;
// auth tetap dicek di dalam function):
//   supabase functions deploy admin-users --no-verify-jwt
// atau paste file ini di Dashboard -> Edge Functions -> Deploy a new function
// lalu matikan toggle "Verify JWT" di tab Settings.
//
// Dipanggil dari app: supabase.functions.invoke("admin-users", { body: {...} })
// — header Authorization ikut otomatis.

import { createClient } from "jsr:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "content-type": "application/json" },
  });
}

// Password acak yang kebaca — tanpa 0/O/1/l biar nggak ambigu.
function genPassword(len = 10) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  const buf = new Uint32Array(len);
  crypto.getRandomValues(buf);
  let out = "";
  for (let i = 0; i < len; i++) out += chars[buf[i] % chars.length];
  return out;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const url = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !anonKey || !serviceKey) {
    return json({ error: "Env function belum lengkap" }, 500);
  }

  // Client sebagai si pemanggil — buat cek dia admin.
  const caller = createClient(url, anonKey, {
    global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
  });
  const {
    data: { user },
    error: userErr,
  } = await caller.auth.getUser();
  if (userErr || !user) return json({ error: "Unauthorized" }, 401);

  const { data: profile, error: profileErr } = await caller
    .from("coaching_profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (profileErr) return json({ error: profileErr.message }, 400);
  const callerRole = profile?.role;
  const isAdmin = callerRole === "admin" || callerRole === "super_admin";
  const isSuperAdmin = callerRole === "super_admin";
  if (!isAdmin) return json({ error: "Bukan admin" }, 403);

  const body = await req.json().catch(() => ({}));
  const admin = createClient(url, serviceKey);
  const ROLES = ["student", "admin", "super_admin"];

  if (body.action === "create") {
    const { email, password, firstName = "", lastName = "" } = body;
    if (!email || typeof password !== "string" || password.length < 6) {
      return json({ error: "email & password (min 6 karakter) wajib" }, 400);
    }
    // Admin biasa cuma boleh bikin murid. Cuma super admin yang boleh
    // menetapkan role admin / super_admin.
    let role = ROLES.includes(body.role) ? body.role : "student";
    if (!isSuperAdmin) role = "student";

    const { data, error } = await admin.auth.admin.createUser({
      email: String(email).trim(),
      password,
      email_confirm: true,
      user_metadata: { first_name: firstName, last_name: lastName },
    });
    if (error) return json({ error: error.message }, 400);

    const id = data.user?.id;
    if (id) {
      const patch: Record<string, string | null> = {
        first_name: firstName || null,
        last_name: lastName || null,
      };
      if (role !== "student") patch.role = role;
      const { error: patchErr } = await admin
        .from("coaching_profiles")
        .update(patch)
        .eq("id", id);
      if (patchErr) return json({ error: patchErr.message }, 400);
    }
    return json({ ok: true, id });
  }

  if (body.action === "create_bulk") {
    const rows = Array.isArray(body.users) ? body.users : [];
    if (rows.length === 0) return json({ error: "users kosong" }, 400);
    if (rows.length > 200) return json({ error: "maks 200 user per batch" }, 400);

    const results: Array<Record<string, unknown>> = [];
    for (const r of rows) {
      const email = String(r?.email ?? "").trim();
      if (!email) {
        results.push({ email: r?.email ?? "", ok: false, error: "email kosong" });
        continue;
      }
      let role = ROLES.includes(r?.role) ? r.role : "student";
      if (!isSuperAdmin) role = "student";
      const password =
        typeof r?.password === "string" && r.password.length >= 6
          ? r.password
          : genPassword();
      const firstName = String(r?.firstName ?? "");
      const lastName = String(r?.lastName ?? "");

      const { data, error } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { first_name: firstName, last_name: lastName },
      });
      if (error) {
        results.push({ email, ok: false, error: error.message });
        continue;
      }
      const id = data.user?.id;
      if (id) {
        const patch: Record<string, string | null> = {
          first_name: firstName || null,
          last_name: lastName || null,
        };
        if (role !== "student") patch.role = role;
        const { error: patchErr } = await admin
          .from("coaching_profiles")
          .update(patch)
          .eq("id", id);
        if (patchErr) {
          results.push({ email, ok: false, error: patchErr.message });
          continue;
        }
      }
      results.push({ email, ok: true, password, role });
    }
    return json({ results });
  }

  // set_password & delete = super admin only.
  if (body.action === "set_password") {
    if (!isSuperAdmin) return json({ error: "Perlu super admin" }, 403);
    const { userId, password } = body;
    if (!userId || typeof password !== "string" || password.length < 6) {
      return json({ error: "userId & password (min 6 karakter) wajib" }, 400);
    }
    const { error } = await admin.auth.admin.updateUserById(userId, { password });
    if (error) return json({ error: error.message }, 400);
    return json({ ok: true });
  }

  if (body.action === "delete") {
    if (!isSuperAdmin) return json({ error: "Perlu super admin" }, 403);
    const { userId } = body;
    if (!userId) return json({ error: "userId wajib" }, 400);
    if (userId === user.id) {
      return json({ error: "Nggak bisa hapus akun sendiri" }, 400);
    }
    const { error } = await admin.auth.admin.deleteUser(userId);
    if (error) return json({ error: error.message }, 400);
    return json({ ok: true });
  }

  return json({ error: "action nggak dikenal" }, 400);
});
