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
    .select("id, title, description, created_at")
    .order("created_at");
  if (error) throw error;
  return data;
}

/**
 * Set + soal-soalnya (tanpa kunci jawaban). Buat halaman murid.
 */
export async function getQuestionSet(id) {
  ensure();
  const { data, error } = await supabase
    .from("coaching_question_sets")
    .select(
      `id, title, description,
       questions:coaching_questions ( id, code, prompt, options, position )`
    )
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  data.questions.sort((a, b) => a.position - b.position);
  for (const q of data.questions) delete q.position;
  return data;
}

/**
 * Sama dengan getQuestionSet tapi tiap soal disertai `answer` (index).
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
      .select("question_id, answer")
      .in("question_id", ids);
    if (error) throw error;
    const m = new Map(keys.map((k) => [k.question_id, k.answer]));
    for (const q of set.questions) q.answer = m.get(q.id) ?? 0;
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

export async function updateQuestionSet(id, { title, description }) {
  ensure();
  const { error } = await supabase
    .from("coaching_question_sets")
    .update({
      title: title.trim() || "Set soal baru",
      description: description?.trim() || null,
    })
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

export async function createQuestion(setId, { prompt, options, answer, position }) {
  ensure();
  const id = crypto.randomUUID();
  const code = randomCode();
  const { error } = await supabase
    .from("coaching_questions")
    .insert({ id, set_id: setId, code, prompt, options, position });
  if (error) throw error;
  const { error: keyErr } = await supabase
    .from("coaching_question_keys")
    .insert({ question_id: id, answer: answer ?? 0 });
  if (keyErr) throw keyErr;
  return { id, code, prompt, options, answer: answer ?? 0 };
}

/**
 * Parse + validasi array JSON soal. Terima array langsung atau
 * { questions: [...] }. Tiap item butuh:
 *   prompt  : string
 *   options : string[] (>= 2)
 *   answer  : index 0-based, ATAU huruf "A".."Z", ATAU teks opsi yang persis
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

    let answer = q?.answer;
    if (typeof answer === "string") {
      const letter = answer.trim().toUpperCase();
      if (/^[A-Z]$/.test(letter)) answer = letter.charCodeAt(0) - 65;
      else answer = options.indexOf(answer);
    }
    if (!Number.isInteger(answer) || answer < 0 || answer >= options.length) {
      errors.push(`Soal ${n}: "answer" harus index/huruf opsi yang valid.`);
      answer = 0;
    }

    if (prompt && options.length >= 2) items.push({ prompt, options, answer });
  });

  if (!items.length && !errors.length) errors.push("Tidak ada soal.");
  return { items, errors };
}

/**
 * Tambah banyak soal sekaligus (2 insert batch: questions + keys).
 */
export async function bulkCreateQuestions(setId, items, startPosition = 0) {
  ensure();
  const meta = items.map((it, i) => ({
    id: crypto.randomUUID(),
    code: randomCode(),
    answer: it.answer ?? 0,
    prompt: it.prompt,
    options: it.options,
    position: startPosition + i,
  }));

  const { error } = await supabase.from("coaching_questions").insert(
    meta.map((m) => ({
      id: m.id,
      set_id: setId,
      code: m.code,
      prompt: m.prompt,
      options: m.options,
      position: m.position,
    }))
  );
  if (error) throw error;

  const { error: keyErr } = await supabase
    .from("coaching_question_keys")
    .insert(meta.map((m) => ({ question_id: m.id, answer: m.answer })));
  if (keyErr) throw keyErr;

  return meta.map((m) => ({
    id: m.id,
    code: m.code,
    prompt: m.prompt,
    options: m.options,
    answer: m.answer,
  }));
}

export async function updateQuestion(id, { prompt, options, answer }) {
  ensure();
  const { error } = await supabase
    .from("coaching_questions")
    .update({ prompt, options })
    .eq("id", id);
  if (error) throw error;
  const { error: keyErr } = await supabase
    .from("coaching_question_keys")
    .upsert({ question_id: id, answer: answer ?? 0 });
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
 * Kirim jawaban -> dinilai di Edge Function -> { score, total, results }.
 */
export async function submitQuiz(lessonId, setId, answers) {
  ensure();
  const { data, error } = await supabase.functions.invoke("quiz-submit", {
    body: { lessonId, setId, answers },
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
 * Semua attempt kuis — buat rekap admin. Dijaga RLS
 * "coaching_quiz_attempts admin read" (butuh caller = admin).
 * Bentuk: { id, user_id, lesson_id, set_id, score, total, created_at }[]
 */
export async function getAllAttempts() {
  ensure();
  const { data, error } = await supabase
    .from("coaching_quiz_attempts")
    .select("id, user_id, lesson_id, set_id, score, total, created_at")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
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
    .select("score, total, answers, created_at")
    .eq("user_id", user.id)
    .eq("lesson_id", lessonId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}
