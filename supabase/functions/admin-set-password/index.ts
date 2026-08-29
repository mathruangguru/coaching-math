// Edge Function: admin set password user lain.
// Butuh service_role key (di-inject otomatis oleh Supabase saat deploy),
// jadi TIDAK bisa dilakukan dari frontend biasa.
//
// Deploy:
//   supabase functions deploy admin-set-password
// atau paste file ini di Dashboard -> Edge Functions -> New function.
//
// Dipanggil dari app lewat: supabase.functions.invoke("admin-set-password",
//   { body: { userId, password } })  — header Authorization ikut otomatis.

import { createClient } from "jsr:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
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

  // Client sebagai si pemanggil — buat cek dia siapa.
  const authHeader = req.headers.get("Authorization") ?? "";
  const caller = createClient(url, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const {
    data: { user },
    error: userErr,
  } = await caller.auth.getUser();
  if (userErr || !user) return json({ error: "Unauthorized" }, 401);

  const { data: profile } = await caller
    .from("coaching_profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (profile?.role !== "admin") return json({ error: "Bukan admin" }, 403);

  const { userId, password } = await req.json().catch(() => ({}));
  if (!userId || typeof password !== "string" || password.length < 6) {
    return json({ error: "userId & password (min 6 karakter) wajib" }, 400);
  }

  const admin = createClient(url, serviceKey);
  const { error } = await admin.auth.admin.updateUserById(userId, { password });
  if (error) return json({ error: error.message }, 400);

  return json({ ok: true });
});
