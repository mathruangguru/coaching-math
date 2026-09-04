import { supabase, hasSupabase } from "./supabase";

function ensure() {
  if (!hasSupabase) throw new Error("Supabase belum dikonfigurasi.");
}

async function runAll(promises) {
  const results = await Promise.all(promises);
  const failed = results.find((r) => r?.error);
  if (failed) throw failed.error;
}

// ── Set soal ────────────────────────────────────────────────────────

export async function getQuestionSets() {
  ensure();
  const { data, error } = await supabase
    .from("coaching_question_sets")
    .select("id, title, description, time_limit_min, created_at")
    .order("created_at");
  if (error) throw error;
  return data;
}

/** Normalisasi jawaban jadi array index urut. number -> [n], null -> []. */
export function toAnswerArray(v) {
  if (Array.isArray(v)) return [...new Set(v)].sort((a, b) => a - b);
  if (v == null) return [];
  return [v];
}

/** Dua himpunan jawaban sama persis (dan nggak kosong)? */
export function sameAnswerSet(a, b) {
  const x = toAnswerArray(a);
  const y = toAnswerArray(b);
  return x.length > 0 && x.length === y.length && x.every((v, i) => v === y[i]);
}

/**
 * Set + soal-soalnya (tanpa kunci jawaban). Buat halaman murid.
 */
export async function getQuestionSet(id) {
  ensure();
  const { data, error } = await supabase
    .from("coaching_question_sets")
    .select(
      `id, title, description, time_limit_min, intro,
       questions:coaching_questions ( id, code, type, prompt, options, position )`
    )
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  data.questions.sort((a, b) => a.position - b.position);
  for (const q of data.questions) {
    delete q.position;
    q.type = q.type ?? "single";
  }
  return data;
}

/**
 * Sama dengan getQuestionSet tapi tiap soal disertai `answers` (array index).
 * Butuh caller = admin (RLS coaching_question_keys).
 */
export async function getQuestionSetAdmin(id) {
  ensure();
  const set = await getQuestionSet(id);
  if (!set) return null;
  const ids = set.questions.map((q) => q.id);
  if (ids.length) {
    const { data: keys, error } = await supabase
      .from("coaching_question_keys")
      .select("question_id, answer, answers")
      .in("question_id", ids);
    if (error) throw error;
    const m = new Map(
      keys.map((k) => [
        k.question_id,
        k.answers?.length ? k.answers : [k.answer ?? 0],
      ])
    );
    for (const q of set.questions) {
      q.answers = toAnswerArray(m.get(q.id) ?? [0]);
      q.answer = q.answers[0] ?? 0; // legacy
    }
  }
  return set;
}

export async function createQuestionSet({ title, description }) {
  ensure();
  const { data, error } = await supabase
    .from("coaching_question_sets")
    .insert({
      id: crypto.randomUUID(),
      title: title.trim() || "Set soal baru",
      description: description?.trim() || null,
    })
    .select("id, title, description")
    .single();
  if (error) throw error;
  return data;
}

export async function updateQuestionSet(
  id,
  { title, description, timeLimitMin, intro }
) {
  ensure();
  const patch = {
    title: title.trim() || "Set soal baru",
    description: description?.trim() || null,
  };
  if (timeLimitMin !== undefined) {
    const n = Number(timeLimitMin);
    patch.time_limit_min = Number.isFinite(n) && n > 0 ? Math.round(n) : null;
  }
  if (intro !== undefined) patch.intro = intro?.trim() || null;
  const { error } = await supabase
    .from("coaching_question_sets")
    .update(patch)
    .eq("id", id);
  if (error) throw error;
}

export async function deleteQuestionSet(id) {
  ensure();
  const { error } = await supabase
    .from("coaching_question_sets")
    .delete()
    .eq("id", id);
  if (error) throw error;
}

// ── Soal (pilihan ganda) ────────────────────────────────────────────

const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // tanpa 0/O/1/I
function randomCode() {
  let s = "";
  for (let i = 0; i < 8; i++)
    s += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  return s;
}

export async function createQuestion(
  setId,
  { prompt, options, type = "single", answers, position }
) {
  ensure();
  const id = crypto.randomUUID();
  const code = randomCode();
  const ans = toAnswerArray(answers).length ? toAnswerArray(answers) : [0];
  const { error } = await supabase
    .from("coaching_questions")
    .insert({ id, set_id: setId, code, type, prompt, options, position });
  if (error) throw error;
  const { error: keyErr } = await supabase
    .from("coaching_question_keys")
    .insert({ question_id: id, answers: ans, answer: ans[0] });
  if (keyErr) throw keyErr;
  return { id, code, type, prompt, options, answers: ans, answer: ans[0] };
}

// "B" / 2 / "opsi persis" -> index; -1 kalau nggak ketemu.
function toOptionIndex(v, options) {
  if (typeof v === "number") return v;
  const s = String(v).trim();
  if (/^[A-Za-z]$/.test(s)) return s.toUpperCase().charCodeAt(0) - 65;
  if (/^\d+$/.test(s)) return Number(s);
  return options.indexOf(s);
}

/**
 * Parse + validasi array JSON soal. Terima array langsung atau
 * { questions: [...] }. Tiap item butuh:
 *   prompt  : string
 *   options : string[] (>= 2)
 *   answer  : index / huruf "A".. / teks opsi. Boleh ARRAY buat checklist.
 *   type    : "single" (default) / "multi" — atau otomatis "multi" kalau
 *             answer array isinya > 1.
 * Balikin { items: normalized[], errors: string[] }.
 */
export function parseQuestionsJson(text) {
  let raw;
  try {
    raw = JSON.parse(text);
  } catch (e) {
    return { items: [], errors: [`JSON tidak valid: ${e.message}`] };
  }
  const arr = Array.isArray(raw) ? raw : raw?.questions;
  if (!Array.isArray(arr)) {
    return { items: [], errors: ['Harus berupa array, atau { "questions": [...] }.'] };
  }

  const items = [];
  const errors = [];
  arr.forEach((q, i) => {
    const n = i + 1;
    const prompt = typeof q?.prompt === "string" ? q.prompt.trim() : "";
    const options = Array.isArray(q?.options)
      ? q.options.map((o) => String(o))
      : [];
    if (!prompt) errors.push(`Soal ${n}: "prompt" wajib string.`);
    if (options.length < 2) errors.push(`Soal ${n}: minimal 2 "options".`);

    const rawAns = Array.isArray(q?.answer) ? q.answer : [q?.answer];
    const answers = toAnswerArray(
      rawAns.map((v) => toOptionIndex(v, options))
    );
    const bad = answers.some(
      (a) => !Number.isInteger(a) || a < 0 || a >= options.length
    );
    if (!answers.length || bad) {
      errors.push(`Soal ${n}: "answer" harus index/huruf opsi yang valid.`);
    }
    const type =
      q?.type === "multi" || q?.type === "single"
        ? q.type
        : answers.length > 1
          ? "multi"
          : "single";

    if (prompt && options.length >= 2 && answers.length && !bad) {
      items.push({ prompt, options, type, answers });
    }
  });

  if (!items.length && !errors.length) errors.push("Tidak ada soal.");
  return { items, errors };
}

/**
 * Tambah banyak soal sekaligus (2 insert batch: questions + keys).
 */
export async function bulkCreateQuestions(setId, items, startPosition = 0) {
  ensure();
  const meta = items.map((it, i) => {
    const answers = toAnswerArray(it.answers ?? it.answer).length
      ? toAnswerArray(it.answers ?? it.answer)
      : [0];
    return {
      id: crypto.randomUUID(),
      code: randomCode(),
      type: it.type ?? (answers.length > 1 ? "multi" : "single"),
      answers,
      prompt: it.prompt,
      options: it.options,
      position: startPosition + i,
    };
  });

  const { error } = await supabase.from("coaching_questions").insert(
    meta.map((m) => ({
      id: m.id,
      set_id: setId,
      code: m.code,
      type: m.type,
      prompt: m.prompt,
      options: m.options,
      position: m.position,
    }))
  );
  if (error) throw error;

  const { error: keyErr } = await supabase.from("coaching_question_keys").insert(
    meta.map((m) => ({
      question_id: m.id,
      answers: m.answers,
      answer: m.answers[0],
    }))
  );
  if (keyErr) throw keyErr;

  return meta.map((m) => ({
    id: m.id,
    code: m.code,
    type: m.type,
    prompt: m.prompt,
    options: m.options,
    answers: m.answers,
    answer: m.answers[0],
  }));
}

export async function updateQuestion(id, { prompt, options, type, answers }) {
  ensure();
  const ans = toAnswerArray(answers).length ? toAnswerArray(answers) : [0];
  const { error } = await supabase
    .from("coaching_questions")
    .update({ prompt, options, type: type ?? "single" })
    .eq("id", id);
  if (error) throw error;
  const { error: keyErr } = await supabase
    .from("coaching_question_keys")
    .upsert({ question_id: id, answers: ans, answer: ans[0] });
  if (keyErr) throw keyErr;
}

export async function deleteQuestion(id) {
  ensure();
  const { error } = await supabase
    .from("coaching_questions")
    .delete()
    .eq("id", id);
  if (error) throw error;
}

export async function reorderQuestions(orderedIds) {
  ensure();
  await runAll(
    orderedIds.map((id, i) =>
      supabase.from("coaching_questions").update({ position: i }).eq("id", id)
    )
  );
}

// ── Murid ngerjakan ─────────────────────────────────────────────────

/**
 * Mulai / lanjut sesi kuis. Bikin baris progress kalau belum ada
 * (started_at cuma di-stamp sekali), balikin { started_at, answers }.
 * Ini yang bikin timer & draft jawaban lanjut walau pindah device.
 *
 * Lewat RPC open_quiz_progress (security definer) -- kalau lesson-nya
 * access_open = false DAN murid ini belum pernah mulai, ditolak
 * (AKSES_DITUTUP). Murid yang udah mulai/submit tetap bisa lanjut.
 */
export async function openQuizProgress(lessonId) {
  if (!hasSupabase) return null;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase.rpc("open_quiz_progress", {
    p_lesson_id: lessonId,
  });
  if (error) {
    if ((error.message || "").includes("AKSES_DITUTUP")) {
      throw new Error(
        "Akses latihan ini ditutup karena sesi pengerjaan belum dimulai atau sudah berakhir."
      );
    }
    throw error;
  }
  return data;
}

/** Baca sesi kuis yang lagi jalan (tanpa bikin baris baru). null = belum mulai. */
export async function getQuizProgress(setId) {
  if (!hasSupabase) return null;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data, error } = await supabase
    .from("coaching_quiz_progress")
    .select("started_at, answers")
    .eq("user_id", user.id)
    .eq("set_id", setId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

/**
 * Semua sesi kuis yang lagi jalan (belum disubmit) — buat panel
 * "sedang mengerjakan" di /admin/quiz-results. RLS admin read.
 * Bentuk: { user_id, set_id, started_at, updated_at, answers }[]
 */
export async function getAllQuizProgress() {
  ensure();
  const { data, error } = await supabase
    .from("coaching_quiz_progress")
    .select("user_id, set_id, started_at, updated_at, answers")
    .order("started_at", { ascending: false });
  if (error) throw error;
  return data;
}

/** Simpan draft jawaban ke server (dipanggil ter-debounce dari QuizPage). */
export async function saveQuizDraft(setId, answers) {
  if (!hasSupabase) return;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  const { error } = await supabase
    .from("coaching_quiz_progress")
    .update({ answers, updated_at: new Date().toISOString() })
    .eq("user_id", user.id)
    .eq("set_id", setId);
  if (error) throw error;
}

/**
 * Kirim jawaban -> dinilai di Edge Function -> { score, total, results }.
 */
export async function submitQuiz(lessonId, setId, answers, durationMs) {
  ensure();
  const { data, error } = await supabase.functions.invoke("quiz-submit", {
    body: { lessonId, setId, answers, durationMs },
  });
  if (error) {
    let detail = "";
    try {
      detail = (await error.context?.json())?.error ?? "";
    } catch {
      // pakai pesan default
    }
    throw new Error(
      detail || "Gagal submit. Pastikan Edge Function 'quiz-submit' sudah di-deploy."
    );
  }
  return data;
}

/**
 * Attempt user yang login buat set ini (1x per set). null kalau belum.
 * Bentuk: { score, total, answers, results, created_at }
 * Filter user_id eksplisit — admin/super_admin bypass RLS "select own",
 * jadi tanpa ini bisa ketarik attempt orang lain.
 */
export async function getMyAttempt(setId) {
  ensure();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data, error } = await supabase
    .from("coaching_quiz_attempts")
    .select("score, total, answers, results, duration_sec, created_at")
    .eq("set_id", setId)
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

/**
 * Semua attempt kuis — buat rekap admin. Dijaga RLS
 * "coaching_quiz_attempts admin read" (butuh caller = admin).
 * Bentuk: { id, user_id, lesson_id, set_id, answers, score, total, created_at }[]
 */
export async function getAllAttempts() {
  ensure();
  const { data, error } = await supabase
    .from("coaching_quiz_attempts")
    .select(
      "id, user_id, lesson_id, set_id, answers, score, total, duration_sec, created_at"
    )
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

/**
 * Semua attempt buat sekumpulan lesson soal (satu course) — buat gradebook
 * admin. Dijaga RLS "coaching_quiz_attempts admin read".
 * Bentuk: { id, user_id, lesson_id, set_id, score, total, duration_sec, created_at }[]
 * Urut terbaru dulu, jadi attempt pertama per (user, lesson) = yang terakhir.
 */
export async function getCourseAttempts(lessonIds) {
  if (!hasSupabase || !lessonIds?.length) return [];
  const { data, error } = await supabase
    .from("coaching_quiz_attempts")
    .select(
      "id, user_id, lesson_id, set_id, score, total, duration_sec, created_at"
    )
    .in("lesson_id", lessonIds)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

/**
 * user_id[] yang punya attempt submit di sebuah lesson soal (admin read).
 * Buat import kehadiran presensi dari "yang udah ngerjain latihan".
 */
export async function getAttemptUserIdsByLesson(lessonId) {
  ensure();
  const { data, error } = await supabase
    .from("coaching_quiz_attempts")
    .select("user_id")
    .eq("lesson_id", lessonId);
  if (error) throw error;
  return [...new Set(data.map((r) => r.user_id).filter(Boolean))];
}

/**
 * Statistik per soal buat halaman review murid — { [qid]: { total, correct } }.
 * Lewat RPC quiz_question_stats (security definer) biar murid bisa lihat
 * agregat tanpa akses attempt orang lain.
 */
export async function getQuestionStats(setId) {
  if (!hasSupabase || !setId) return {};
  const { data, error } = await supabase.rpc("quiz_question_stats", {
    p_set: setId,
  });
  if (error) throw error;
  const out = {};
  for (const r of data ?? []) {
    out[r.question_id] = { total: Number(r.total), correct: Number(r.correct) };
  }
  return out;
}

/**
 * Hapus 1 attempt (admin) — murid jadi bisa ngerjain set itu lagi.
 * Dijaga RLS "coaching_quiz_attempts admin delete".
 */
export async function deleteAttempt(id) {
  ensure();
  const { error } = await supabase
    .from("coaching_quiz_attempts")
    .delete()
    .eq("id", id);
  if (error) throw error;
}

/**
 * Dari daftar lesson soal, balikin { [lessonId]: { score, total } } — attempt
 * user ini per lesson (yang terakhir). Buat keterangan skor di daftar materi.
 */
export async function getMyAttemptsByLesson(lessonIds) {
  if (!hasSupabase || !lessonIds?.length) return {};
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return {};
  const { data, error } = await supabase
    .from("coaching_quiz_attempts")
    .select("lesson_id, score, total, created_at")
    .eq("user_id", user.id)
    .in("lesson_id", lessonIds)
    .order("created_at", { ascending: false });
  if (error) throw error;
  const out = {};
  for (const a of data) {
    if (a.lesson_id && !(a.lesson_id in out))
      out[a.lesson_id] = { score: a.score, total: a.total };
  }
  return out;
}

/**
 * set_id[] yang user ini punya sesi kuis lagi jalan (udah Mulai, belum
 * submit). Buat state "sedang dikerjakan" di daftar materi.
 */
export async function getMyQuizProgressSetIds() {
  if (!hasSupabase) return [];
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];
  const { data, error } = await supabase
    .from("coaching_quiz_progress")
    .select("set_id")
    .eq("user_id", user.id);
  if (error) throw error;
  return data.map((r) => r.set_id);
}

/**
 * Attempt terakhir user di lesson ini (buat nampilin skor sebelumnya).
 */
export async function getLastAttempt(lessonId) {
  ensure();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data, error } = await supabase
    .from("coaching_quiz_attempts")
    .select("score, total, answers, duration_sec, created_at")
    .eq("user_id", user.id)
    .eq("lesson_id", lessonId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}
