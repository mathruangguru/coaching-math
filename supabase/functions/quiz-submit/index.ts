// Edge Function: murid submit jawaban kuis -> dinilai pakai kunci jawaban
// (service_role, murid nggak pernah lihat kunci) -> attempt disimpan.
//
// Deploy (--no-verify-jwt wajib, auth dicek di dalam):
//   supabase functions deploy quiz-submit --no-verify-jwt
//
// Body: { lessonId, setId, answers: { [questionId]: chosenIndex } }
// Return: { score, total, results: { [questionId]: boolean } }

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

  const caller = createClient(url, anonKey, {
    global: {
      headers: { Authorization: req.headers.get("Authorization") ?? "" },
    },
  });
  const {
    data: { user },
    error: userErr,
  } = await caller.auth.getUser();
  if (userErr || !user) return json({ error: "Unauthorized" }, 401);

  const { lessonId, setId, answers } = await req.json().catch(() => ({}));
  if (!lessonId || !setId || typeof answers !== "object" || answers === null) {
    return json({ error: "lessonId, setId, answers wajib" }, 400);
  }

  const admin = createClient(url, serviceKey);

  const { data: questions, error: qErr } = await admin
    .from("coaching_questions")
    .select("id")
    .eq("set_id", setId);
  if (qErr) return json({ error: qErr.message }, 400);
  if (!questions?.length) return json({ error: "Set soal kosong" }, 400);

  const ids = questions.map((q) => q.id);
  const { data: keys, error: kErr } = await admin
    .from("coaching_question_keys")
    .select("question_id, answer")
    .in("question_id", ids);
  if (kErr) return json({ error: kErr.message }, 400);

  const keyMap = new Map(keys?.map((k) => [k.question_id, k.answer]));
  const results: Record<string, boolean> = {};
  let score = 0;
  for (const qid of ids) {
    const ok = keyMap.get(qid) === answers[qid];
    results[qid] = ok;
    if (ok) score += 1;
  }
  const total = ids.length;

  const { error: insErr } = await admin.from("coaching_quiz_attempts").insert({
    user_id: user.id,
    lesson_id: lessonId,
    set_id: setId,
    answers,
    score,
    total,
  });
  if (insErr) return json({ error: insErr.message }, 400);

  return json({ score, total, results });
});
