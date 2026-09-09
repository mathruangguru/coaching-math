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
       questions:coaching_questions ( id, code, type, prompt, options, table_rows, position )`
    )
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  data.questions.sort((a, b) => a.position - b.position);
  for (const q of data.questions) {
    delete q.position;
    q.type = q.type ?? "single";
    q.table_rows = Array.isArray(q.table_rows) ? q.table_rows : [];
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
      .select("question_id, answer, answers, answer_num, answer_tol, row_keys")
      .in("question_id", ids);
    if (error) throw error;
    const m = new Map(keys.map((k) => [k.question_id, k]));
    for (const q of set.questions) {
      const k = m.get(q.id);
      q.answers = toAnswerArray(
        k?.answers?.length ? k.answers : [k?.answer ?? 0]
      );
      q.answer = q.answers[0] ?? 0; // legacy
      q.answer_num = k?.answer_num ?? null;
      q.answer_tol = k?.answer_tol ?? 0;
      q.row_keys = Array.isArray(k?.row_keys) ? k.row_keys : [];
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

/** number | null (buat kunci isian angka). "3,5" -> 3.5. */
export function toNum(v) {
  if (v == null || v === "") return null;
  const n = typeof v === "number" ? v : Number(String(v).trim().replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

// Normalisasi kunci per baris (tipe 'table') -> array int non-negatif.
function normRowKeys(v) {
  return Array.isArray(v) ? v.map((n) => Math.max(0, Math.trunc(Number(n)) || 0)) : [];
}

export async function createQuestion(
  setId,
  {
    prompt,
    options,
    type = "single",
    answers,
    answerNum,
    answerTol,
    tableRows,
    rowKeys,
    position,
  }
) {
  ensure();
  const id = crypto.randomUUID();
  const code = randomCode();
  const ans = toAnswerArray(answers).length ? toAnswerArray(answers) : [0];
  const numKey =
    type === "number"
      ? { answer_num: toNum(answerNum), answer_tol: Math.abs(toNum(answerTol) ?? 0) }
      : { answer_num: null, answer_tol: 0 };
  const rows = type === "table" && Array.isArray(tableRows) ? tableRows : [];
  const rKeys = type === "table" ? normRowKeys(rowKeys) : [];
  const { error } = await supabase
    .from("coaching_questions")
    .insert({ id, set_id: setId, code, type, prompt, options, table_rows: rows, position });
  if (error) throw error;
  const { error: keyErr } = await supabase
    .from("coaching_question_keys")
    .insert({ question_id: id, answers: ans, answer: ans[0], ...numKey, row_keys: rKeys });
  if (keyErr) throw keyErr;
  return {
    id,
    code,
    type,
    prompt,
    options,
    table_rows: rows,
    answers: ans,
    answer: ans[0],
    answer_num: numKey.answer_num,
    answer_tol: numKey.answer_tol,
    row_keys: rKeys,
  };
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
 *   -- pilihan ganda / checklist:
 *   options : string[] (>= 2)
 *   answer  : index / huruf "A".. / teks opsi. Boleh ARRAY buat checklist.
 *   type    : "single" (default) / "multi" — auto "multi" kalau answer > 1.
 *   -- isian angka:
 *   type: "number", answer: <angka>, tolerance?: <angka> (default 0)
 *   -- tabel pilihan ganda:
 *   type: "table", columns: string[] (>= 2), rows: string[] (>= 1),
 *   answers: (index/huruf/label kolom)[] sepanjang rows
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
    if (!prompt) errors.push(`Soal ${n}: "prompt" wajib string.`);

    if (q?.type === "number") {
      const answerNum = toNum(q?.answer);
      if (answerNum == null)
        errors.push(`Soal ${n}: "answer" harus angka buat type "number".`);
      const answerTol = Math.abs(toNum(q?.tolerance) ?? 0);
      if (prompt && answerNum != null) {
        items.push({ prompt, type: "number", answerNum, answerTol });
      }
      return;
    }

    if (q?.type === "table") {
      const cols = (
        Array.isArray(q?.columns) ? q.columns : q?.options
      );
      const columns = Array.isArray(cols) ? cols.map((c) => String(c)) : [];
      const rowsIn = Array.isArray(q?.rows) ? q.rows : [];
      const rowTexts = rowsIn.map((r) =>
        r && typeof r === "object" ? String(r.text ?? "") : String(r)
      );
      const ansIn = Array.isArray(q?.answers) ? q.answers : [];
      const rawRowAns = rowsIn.map((r, ri) =>
        r && typeof r === "object" && "answer" in r ? r.answer : ansIn[ri]
      );
      const rowKeys = rawRowAns.map((v) => toOptionIndex(v, columns));
      if (columns.length < 2)
        errors.push(`Soal ${n}: "columns" minimal 2 buat type "table".`);
      if (rowTexts.length < 1)
        errors.push(`Soal ${n}: "rows" minimal 1 buat type "table".`);
      const badKey =
        rowKeys.length !== rowTexts.length ||
        rowKeys.some((k) => !Number.isInteger(k) || k < 0 || k >= columns.length);
      if (badKey)
        errors.push(
          `Soal ${n}: tiap baris "table" butuh jawaban kolom yang valid.`
        );
      if (
        prompt &&
        columns.length >= 2 &&
        rowTexts.length >= 1 &&
        !badKey
      ) {
        items.push({
          prompt,
          type: "table",
          options: columns,
          tableRows: rowTexts,
          rowKeys,
        });
      }
      return;
    }

    const options = Array.isArray(q?.options)
      ? q.options.map((o) => String(o))
      : [];
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
 * Kebalikan dari parseQuestionsJson -- serialize soal (dari
 * getQuestionSetAdmin, yang udah bawa `.answers`) balik ke bentuk JSON
 * yang bisa di-import lagi apa adanya. `single` -> answer index tunggal,
 * `multi` -> answer array index.
 */
export function questionsToJson(questions) {
  return {
    questions: questions.map((q) => {
      if (q.type === "number") {
        const out = { prompt: q.prompt, type: "number", answer: q.answer_num };
        if (q.answer_tol) out.tolerance = q.answer_tol;
        return out;
      }
      if (q.type === "table") {
        const cols = q.options ?? [];
        return {
          prompt: q.prompt,
          type: "table",
          columns: cols,
          rows: q.table_rows ?? [],
          answers: (q.row_keys ?? []).map((i) => cols[i] ?? i),
        };
      }
      return {
        prompt: q.prompt,
        options: q.options,
        type: q.type === "multi" ? "multi" : "single",
        answer:
          q.type === "multi"
            ? (q.answers ?? [])
            : (q.answers?.[0] ?? q.answer ?? 0),
      };
    }),
  };
}

/**
 * Tambah banyak soal sekaligus (2 insert batch: questions + keys).
 */
export async function bulkCreateQuestions(setId, items, startPosition = 0) {
  ensure();
  const meta = items.map((it, i) => {
    const isNum = it.type === "number";
    const isTable = it.type === "table";
    const answers = toAnswerArray(it.answers ?? it.answer).length
      ? toAnswerArray(it.answers ?? it.answer)
      : [0];
    return {
      id: crypto.randomUUID(),
      code: randomCode(),
      type: it.type ?? (answers.length > 1 ? "multi" : "single"),
      answers: isNum || isTable ? [0] : answers,
      answer_num: isNum ? toNum(it.answerNum ?? it.answer) : null,
      answer_tol: isNum ? Math.abs(toNum(it.answerTol ?? it.tolerance) ?? 0) : 0,
      table_rows: isTable && Array.isArray(it.tableRows) ? it.tableRows : [],
      row_keys: isTable ? normRowKeys(it.rowKeys) : [],
      prompt: it.prompt,
      options: isNum ? [] : it.options,
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
      table_rows: m.table_rows,
      position: m.position,
    }))
  );
  if (error) throw error;

  const { error: keyErr } = await supabase.from("coaching_question_keys").insert(
    meta.map((m) => ({
      question_id: m.id,
      answers: m.answers,
      answer: m.answers[0],
      answer_num: m.answer_num,
      answer_tol: m.answer_tol,
      row_keys: m.row_keys,
    }))
  );
  if (keyErr) throw keyErr;

  return meta.map((m) => ({
    id: m.id,
    code: m.code,
    type: m.type,
    prompt: m.prompt,
    options: m.options,
    table_rows: m.table_rows,
    answers: m.answers,
    answer: m.answers[0],
    answer_num: m.answer_num,
    answer_tol: m.answer_tol,
    row_keys: m.row_keys,
  }));
}

export async function updateQuestion(
  id,
  { prompt, options, type, answers, answerNum, answerTol, tableRows, rowKeys }
) {
  ensure();
  const t = type ?? "single";
  const ans = toAnswerArray(answers).length ? toAnswerArray(answers) : [0];
  const numKey =
    t === "number"
      ? { answer_num: toNum(answerNum), answer_tol: Math.abs(toNum(answerTol) ?? 0) }
      : { answer_num: null, answer_tol: 0 };
  const rows = t === "table" && Array.isArray(tableRows) ? tableRows : [];
  const rKeys = t === "table" ? normRowKeys(rowKeys) : [];
  const { error } = await supabase
    .from("coaching_questions")
    .update({ prompt, options, type: t, table_rows: rows })
    .eq("id", id);
  if (error) throw error;
  const { error: keyErr } = await supabase
    .from("coaching_question_keys")
    .upsert({ question_id: id, answers: ans, answer: ans[0], ...numKey, row_keys: rKeys });
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
 * Status akses "sekarang" buat lesson soal -- cuma buat tampilan
 * (banner lobby / badge admin). Gate sungguhan ada di RPC
 * open_quiz_progress, dievaluasi server-side pakai now() Postgres.
 * `lesson`: { access_open, access_opens_at, access_closes_at }.
 * Balikin { open, reason, at }: reason "manual" = ditutup toggle,
 * "before"/"after" = di luar jadwal (`at` = batas jadwal terkait).
 */
export function quizAccessNow(lesson, now = Date.now()) {
  if (lesson?.access_open === false) return { open: false, reason: "manual" };
  const opensAt = lesson?.access_opens_at
    ? new Date(lesson.access_opens_at).getTime()
    : null;
  const closesAt = lesson?.access_closes_at
    ? new Date(lesson.access_closes_at).getTime()
    : null;
  if (opensAt != null && now < opensAt)
    return { open: false, reason: "before", at: opensAt };
  if (closesAt != null && now >= closesAt)
    return { open: false, reason: "after", at: closesAt };
  return { open: true, reason: null, at: null };
}

/**
 * Mulai / lanjut sesi kuis. Bikin baris progress kalau belum ada
 * (started_at cuma di-stamp sekali), balikin { started_at, answers }.
 * Ini yang bikin timer & draft jawaban lanjut walau pindah device.
 *
 * Lewat RPC open_quiz_progress (security definer) -- kalau lesson-nya
 * ditutup manual ATAU di luar jadwal (access_opens_at/access_closes_at)
 * DAN murid ini belum pernah mulai, ditolak (AKSES_DITUTUP). Murid yang
 * udah mulai/submit tetap bisa lanjut.
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
