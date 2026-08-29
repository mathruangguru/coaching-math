// Edge Function: operasi user yang butuh service_role (nggak boleh di frontend).
//   action "create"        -> { email, password, firstName, lastName, role }
//   action "set_password"  -> { userId, password }
//   action "delete"        -> { userId }
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
  if (profile?.role !== "admin") return json({ error: "Bukan admin" }, 403);

  const body = await req.json().catch(() => ({}));
  const admin = createClient(url, serviceKey);

  if (body.action === "create") {
    const {
      email,
      password,
      firstName = "",
      lastName = "",
      role = "student",
    } = body;
    if (!email || typeof password !== "string" || password.length < 6) {
      return json({ error: "email & password (min 6 karakter) wajib" }, 400);
    }

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
      if (role === "admin") patch.role = "admin";
      const { error: patchErr } = await admin
        .from("coaching_profiles")
        .update(patch)
        .eq("id", id);
      if (patchErr) return json({ error: patchErr.message }, 400);
    }
    return json({ ok: true, id });
  }

  if (body.action === "set_password") {
    const { userId, password } = body;
    if (!userId || typeof password !== "string" || password.length < 6) {
      return json({ error: "userId & password (min 6 karakter) wajib" }, 400);
    }
    const { error } = await admin.auth.admin.updateUserById(userId, { password });
    if (error) return json({ error: error.message }, 400);
    return json({ ok: true });
  }

  if (body.action === "delete") {
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
