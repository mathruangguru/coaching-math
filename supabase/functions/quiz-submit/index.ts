// Edge Function: murid submit jawaban kuis -> dinilai pakai kunci jawaban
// (service_role, murid nggak pernah lihat kunci) -> attempt disimpan.
//
// 1 attempt per (user, set). Kalau udah pernah, balikin hasil lama +
// alreadyDone:true (nggak insert lagi).
//
// Deploy (--no-verify-jwt wajib, auth dicek di dalam):
//   supabase functions deploy quiz-submit --no-verify-jwt
//
// Body: { lessonId, setId, answers: { [questionId]: chosenIndex }, durationMs? }
// Return: { score, total, results: { [questionId]: boolean }, duration_sec, alreadyDone? }

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

  const { lessonId, setId, answers, durationMs } = await req
    .json()
    .catch(() => ({}));
  if (!lessonId || !setId || typeof answers !== "object" || answers === null) {
    return json({ error: "lessonId, setId, answers wajib" }, 400);
  }

  // Durasi dikirim client -> clamp di server (0 .. 24 jam). null kalau nggak masuk akal.
  const durNum = Number(durationMs);
  const durationSec = Number.isFinite(durNum)
    ? Math.min(Math.max(0, Math.round(durNum / 1000)), 86400)
    : null;

  const admin = createClient(url, serviceKey);

  // Sudah pernah ngerjain set ini? -> balikin hasil lama, jangan insert.
  const { data: prev } = await admin
    .from("coaching_quiz_attempts")
    .select("answers, results, score, total, duration_sec")
    .eq("user_id", user.id)
    .eq("set_id", setId)
    .maybeSingle();
  if (prev) {
    return json({
      score: prev.score,
      total: prev.total,
      results: prev.results ?? {},
      duration_sec: prev.duration_sec ?? null,
      alreadyDone: true,
    });
  }

  const { data: questions, error: qErr } = await admin
    .from("coaching_questions")
    .select("id")
    .eq("set_id", setId);
  if (qErr) return json({ error: qErr.message }, 400);
  if (!questions?.length) return json({ error: "Set soal kosong" }, 400);

  const ids = questions.map((q) => q.id);
  const { data: keys, error: kErr } = await admin
    .from("coaching_question_keys")
    .select("question_id, answer, answers")
    .in("question_id", ids);
  if (kErr) return json({ error: kErr.message }, 400);

  // Normalisasi ke array index urut. Benar = himpunan sama persis.
  const norm = (v: unknown): number[] => {
    const a = Array.isArray(v) ? v : v == null ? [] : [v];
    return [...new Set(a.map(Number))].sort((x, y) => x - y);
  };
  const same = (a: number[], b: number[]) =>
    a.length > 0 && a.length === b.length && a.every((v, i) => v === b[i]);

  const keyMap = new Map(
    (keys ?? []).map((k) => [
      k.question_id,
      norm(k.answers?.length ? k.answers : [k.answer ?? 0]),
    ])
  );
  const results: Record<string, boolean> = {};
  let score = 0;
  for (const qid of ids) {
    const ok = same(norm(answers[qid]), keyMap.get(qid) ?? []);
    results[qid] = ok;
    if (ok) score += 1;
  }
  const total = ids.length;

  const { error: insErr } = await admin.from("coaching_quiz_attempts").insert({
    user_id: user.id,
    lesson_id: lessonId,
    set_id: setId,
    answers,
    results,
    score,
    total,
    duration_sec: durationSec,
  });
  if (insErr) {
    // 23505 = unique (user, set) -> race; ambil yang barusan masuk.
    if (insErr.code === "23505") {
      const { data: race } = await admin
        .from("coaching_quiz_attempts")
        .select("results, score, total, duration_sec")
        .eq("user_id", user.id)
        .eq("set_id", setId)
        .maybeSingle();
      if (race) {
        return json({
          score: race.score,
          total: race.total,
          results: race.results ?? {},
          duration_sec: race.duration_sec ?? null,
          alreadyDone: true,
        });
      }
    }
    return json({ error: insErr.message }, 400);
  }

  return json({ score, total, results, duration_sec: durationSec });
});
