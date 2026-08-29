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
       questions:coaching_questions ( id, prompt, options, position )`
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

export async function createQuestion(setId, { prompt, options, answer, position }) {
  ensure();
  const id = crypto.randomUUID();
  const { error } = await supabase
    .from("coaching_questions")
    .insert({ id, set_id: setId, prompt, options, position });
  if (error) throw error;
  const { error: keyErr } = await supabase
    .from("coaching_question_keys")
    .insert({ question_id: id, answer: answer ?? 0 });
  if (keyErr) throw keyErr;
  return { id, prompt, options, answer: answer ?? 0 };
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
