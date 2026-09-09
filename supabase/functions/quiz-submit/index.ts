// Edge Function: murid submit jawaban kuis -> dinilai pakai kunci jawaban
// (service_role, murid nggak pernah lihat kunci) -> attempt disimpan.
//
// 1 attempt per (user, set). Kalau udah pernah, balikin hasil lama +
// alreadyDone:true (nggak insert lagi).
//
// Deploy (--no-verify-jwt wajib, auth dicek di dalam):
//   supabase functions deploy quiz-submit --no-verify-jwt
//
// durationMs di body cuma fallback — durasi utama dihitung server dari
// coaching_quiz_progress.started_at, lalu baris progress-nya dihapus.
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

  const admin = createClient(url, serviceKey);

  const clearProgress = () =>
    admin
      .from("coaching_quiz_progress")
      .delete()
      .eq("user_id", user.id)
      .eq("set_id", setId);

  // Sudah pernah ngerjain set ini? -> balikin hasil lama, jangan insert.
  const { data: prev } = await admin
    .from("coaching_quiz_attempts")
    .select("answers, results, score, total, duration_sec")
    .eq("user_id", user.id)
    .eq("set_id", setId)
    .maybeSingle();
  if (prev) {
    await clearProgress();
    return json({
      score: prev.score,
      total: prev.total,
      results: prev.results ?? {},
      duration_sec: prev.duration_sec ?? null,
      alreadyDone: true,
    });
  }

  // Batas waktu set. Durasi di atas batas (+ grace 60 dtk) -> disimpan null.
  // Tanpa batas -> sanity cap 24 jam.
  const { data: setRow } = await admin
    .from("coaching_question_sets")
    .select("time_limit_min")
    .eq("id", setId)
    .maybeSingle();
  const capSec = setRow?.time_limit_min
    ? setRow.time_limit_min * 60 + 60
    : 24 * 3600;
  const clampSec = (s: number | null) =>
    s != null && Number.isFinite(s) && s >= 0 && s <= capSec
      ? Math.round(s)
      : null;

  // Durasi authoritative: server_now - started_at dari baris progress.
  // Fallback ke durationMs client kalau baris progress nggak ada.
  const { data: prog } = await admin
    .from("coaching_quiz_progress")
    .select("started_at")
    .eq("user_id", user.id)
    .eq("set_id", setId)
    .maybeSingle();
  const durationSec = prog?.started_at
    ? clampSec((Date.now() - new Date(prog.started_at).getTime()) / 1000)
    : clampSec(
        Number.isFinite(Number(durationMs)) ? Number(durationMs) / 1000 : null
      );

  const { data: questions, error: qErr } = await admin
    .from("coaching_questions")
    .select("id, type")
    .eq("set_id", setId);
  if (qErr) return json({ error: qErr.message }, 400);
  if (!questions?.length) return json({ error: "Set soal kosong" }, 400);

  const ids = questions.map((q) => q.id);
  const typeMap = new Map(questions.map((q) => [q.id, q.type ?? "single"]));
  const { data: keys, error: kErr } = await admin
    .from("coaching_question_keys")
    .select("question_id, answer, answers, answer_num, answer_tol, row_keys")
    .in("question_id", ids);
  if (kErr) return json({ error: kErr.message }, 400);

  // Normalisasi ke array index urut. Benar = himpunan sama persis.
  const norm = (v: unknown): number[] => {
    const a = Array.isArray(v) ? v : v == null ? [] : [v];
    return [...new Set(a.map(Number))].sort((x, y) => x - y);
  };
  const same = (a: number[], b: number[]) =>
    a.length > 0 && a.length === b.length && a.every((v, i) => v === b[i]);

  // "3,14" / " 3.14 " -> 3.14 ; kalau nggak bisa diparse -> NaN.
  const parseNum = (v: unknown): number => {
    if (typeof v === "number") return v;
    if (typeof v !== "string") return NaN;
    const s = v.trim().replace(",", ".");
    return s === "" ? NaN : Number(s);
  };

  const idxKeys = new Map(
    (keys ?? []).map((k) => [
      k.question_id,
      norm(k.answers?.length ? k.answers : [k.answer ?? 0]),
    ])
  );
  const numKeys = new Map(
    (keys ?? []).map((k) => [
      k.question_id,
      {
        num: k.answer_num == null ? NaN : Number(k.answer_num),
        tol: Math.abs(Number(k.answer_tol) || 0),
      },
    ])
  );
  // Tipe 'table': row_keys[i] = index kolom benar buat baris i.
  const rowKeys = new Map(
    (keys ?? []).map((k) => [
      k.question_id,
      Array.isArray(k.row_keys) ? k.row_keys.map(Number) : [],
    ])
  );
  const results: Record<string, boolean> = {};
  let score = 0;
  for (const qid of ids) {
    let ok: boolean;
    const t = typeMap.get(qid);
    if (t === "number") {
      const key = numKeys.get(qid);
      const v = parseNum(answers[qid]);
      ok =
        !!key &&
        Number.isFinite(key.num) &&
        Number.isFinite(v) &&
        Math.abs(v - key.num) <= key.tol;
    } else if (t === "table") {
      const rk = rowKeys.get(qid) ?? [];
      const picked = Array.isArray(answers[qid]) ? answers[qid] : [];
      // Benar cuma kalau SEMUA baris cocok (all-or-nothing).
      ok = rk.length > 0 && rk.every((k, i) => Number(picked[i]) === k);
    } else {
      ok = same(norm(answers[qid]), idxKeys.get(qid) ?? []);
    }
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
        await clearProgress();
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

  await clearProgress();
  return json({ score, total, results, duration_sec: durationSec });
});
