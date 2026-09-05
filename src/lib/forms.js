import { supabase, hasSupabase } from "./supabase";

function ensure() {
  if (!hasSupabase) throw new Error("Supabase belum dikonfigurasi.");
}

async function runAll(promises) {
  const results = await Promise.all(promises);
  const failed = results.find((r) => r?.error);
  if (failed) throw failed.error;
}

export const fieldTypeLabels = {
  short: "Isian pendek",
  long: "Isian panjang",
  single: "Pilihan tunggal",
  multi: "Pilihan ganda",
  check: "Checklist pernyataan",
  name: "Nama (auto)",
  email: "Email (auto)",
  date: "Tanggal (auto hari ini)",
  rating: "Rating (bintang)",
};
export const FIELD_TYPES = Object.keys(fieldTypeLabels);

// Field yang punya daftar opsi/pernyataan.
export const OPTION_TYPES = ["single", "multi", "check"];

// ── Forms ──────────────────────────────────────────────────────────

export async function getForms() {
  if (!hasSupabase) return [];
  const { data, error } = await supabase
    .from("coaching_forms")
    .select("id, title, description, open, created_at")
    .order("created_at");
  if (error) throw error;
  return data;
}

/** Form + field-nya, urut posisi. */
export async function getForm(id) {
  ensure();
  const { data, error } = await supabase
    .from("coaching_forms")
    .select(
      `id, title, description, open,
       fields:coaching_form_fields ( id, type, label, options, required, position )`
    )
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  data.fields.sort((a, b) => a.position - b.position);
  for (const f of data.fields) delete f.position;
  return data;
}

export async function createForm({ title, description }) {
  ensure();
  const { data, error } = await supabase
    .from("coaching_forms")
    .insert({
      id: crypto.randomUUID(),
      title: title?.trim() || "Form baru",
      description: description?.trim() || null,
    })
    .select("id, title, description")
    .single();
  if (error) throw error;
  return data;
}

export async function updateForm(id, patch) {
  ensure();
  const fields = {};
  if ("title" in patch) fields.title = patch.title?.trim() || "Form baru";
  if ("description" in patch)
    fields.description = patch.description?.trim() || null;
  if ("open" in patch) fields.open = !!patch.open;
  const { error } = await supabase
    .from("coaching_forms")
    .update(fields)
    .eq("id", id);
  if (error) throw error;
}

export async function deleteForm(id) {
  ensure();
  const { error } = await supabase.from("coaching_forms").delete().eq("id", id);
  if (error) throw error;
}

// ── Fields ─────────────────────────────────────────────────────────

export async function createField(formId, { type, label, options, required, position }) {
  ensure();
  const id = crypto.randomUUID();
  const { error } = await supabase.from("coaching_form_fields").insert({
    id,
    form_id: formId,
    type: type ?? "short",
    label: label ?? "",
    options: options ?? [],
    required: !!required,
    position,
  });
  if (error) throw error;
  return {
    id,
    type: type ?? "short",
    label: label ?? "",
    options: options ?? [],
    required: !!required,
  };
}

export async function updateField(id, { type, label, options, required }) {
  ensure();
  const patch = {};
  if (type !== undefined) patch.type = type;
  if (label !== undefined) patch.label = label;
  if (options !== undefined) patch.options = options;
  if (required !== undefined) patch.required = !!required;
  const { error } = await supabase
    .from("coaching_form_fields")
    .update(patch)
    .eq("id", id);
  if (error) throw error;
}

export async function deleteField(id) {
  ensure();
  const { error } = await supabase
    .from("coaching_form_fields")
    .delete()
    .eq("id", id);
  if (error) throw error;
}

export async function reorderFields(orderedIds) {
  ensure();
  await runAll(
    orderedIds.map((id, i) =>
      supabase.from("coaching_form_fields").update({ position: i }).eq("id", id)
    )
  );
}

// ── Responses ──────────────────────────────────────────────────────

export async function submitFormResponse(formId, lessonId, answers) {
  ensure();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Belum login.");
  const { error } = await supabase.from("coaching_form_responses").insert({
    form_id: formId,
    lesson_id: lessonId || null,
    user_id: user.id,
    answers,
  });
  if (error) throw error;
}

/**
 * Waktu (ISO) respons user ini buat sebuah form, atau null kalau belum ngisi.
 * Kalau `lessonId` dikasih, di-scope ke lesson itu — satu form yang dipakai
 * di beberapa lesson dihitung sendiri-sendiri (isi di lesson X, lesson Y
 * masih kosong). Non-null = udah pernah ngisi (sekali doang, nggak ada
 * cooldown).
 */
export async function getMyLastFormResponseAt(formId, lessonId) {
  ensure();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  let q = supabase
    .from("coaching_form_responses")
    .select("created_at")
    .eq("form_id", formId)
    .eq("user_id", user.id);
  if (lessonId) q = q.eq("lesson_id", lessonId);
  const { data, error } = await q
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data?.created_at ?? null;
}

/**
 * Dari daftar lesson id, balikin yang mana aja yang user ini udah pernah
 * kirim respons form-nya. Buat badge "sudah diisi" di daftar materi.
 */
export async function getMyFormResponseLessonIds(lessonIds) {
  if (!hasSupabase || !lessonIds?.length) return [];
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];
  const { data, error } = await supabase
    .from("coaching_form_responses")
    .select("lesson_id")
    .eq("user_id", user.id)
    .in("lesson_id", lessonIds);
  if (error) throw error;
  return [...new Set(data.map((r) => r.lesson_id).filter(Boolean))];
}

/**
 * Jawaban refleksi/form milik user ini sendiri buat sekumpulan lesson,
 * lengkap dengan label field-nya. Dipakai di lobby course buat nampilin
 * daftar refleksi yang pernah dikirim.
 * `lessons`: [{ id, title, form_id }]. Balikin entri urut terbaru:
 *   { lessonId, title, at, answers: [{ label, type, value }] }
 */
export async function getMyRefleksiEntries(lessons) {
  if (!hasSupabase || !lessons?.length) return [];
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const byId = new Map(lessons.map((l) => [l.id, l]));
  const { data: rows, error } = await supabase
    .from("coaching_form_responses")
    .select("lesson_id, answers, created_at")
    .eq("user_id", user.id)
    .in("lesson_id", [...byId.keys()])
    .order("created_at", { ascending: false });
  if (error) throw error;
  if (!rows.length) return [];

  const formIds = [...new Set(lessons.map((l) => l.form_id).filter(Boolean))];
  const forms = await Promise.all(
    formIds.map((id) => getForm(id).catch(() => null))
  );
  const fieldsByForm = new Map(
    forms.filter(Boolean).map((f) => [f.id, f.fields])
  );

  return rows.map((r) => {
    const lesson = byId.get(r.lesson_id);
    const fields = fieldsByForm.get(lesson?.form_id) ?? [];
    return {
      lessonId: r.lesson_id,
      title: lesson?.title ?? "Refleksi",
      at: r.created_at,
      answers: fields
        .filter((f) => f.type !== "name" && f.type !== "email")
        .map((f) => ({
          label: f.label || "Pertanyaan",
          type: f.type,
          value: r.answers?.[f.id],
        })),
    };
  });
}

/**
 * Feedback yang MASUK buat user ini (dia = target_user_id di lesson
 * tipe 'feedback'), satu course. Lewat RPC get_my_feedback (security
 * definer) yang SENGAJA nggak nyertain user_id sama sekali -- anonim
 * beneran, bukan cuma disembunyiin di tampilan. Balikin urut terbaru,
 * SATU ENTRI PER RESPONS (bukan per lesson -- satu ronde bisa punya
 * banyak pengirim):
 *   { lessonId, title, at, answers: [{ label, type, value }] }
 */
export async function getMyFeedback(courseId) {
  if (!hasSupabase || !courseId) return [];
  const { data: rows, error } = await supabase.rpc("get_my_feedback", {
    p_course_id: courseId,
  });
  if (error) throw error;
  if (!rows?.length) return [];

  const formIds = [...new Set(rows.map((r) => r.form_id).filter(Boolean))];
  const forms = await Promise.all(
    formIds.map((id) => getForm(id).catch(() => null))
  );
  const fieldsByForm = new Map(
    forms.filter(Boolean).map((f) => [f.id, f.fields])
  );

  return rows.map((r) => {
    const fields = fieldsByForm.get(r.form_id) ?? [];
    return {
      lessonId: r.lesson_id,
      title: r.lesson_title ?? "Feedback",
      at: r.created_at,
      answers: fields
        .filter((f) => f.type !== "name" && f.type !== "email")
        .map((f) => ({
          label: f.label || "Pertanyaan",
          type: f.type,
          value: r.answers?.[f.id],
        })),
    };
  });
}

/**
 * Semua respons sebuah form — buat rekap admin (RLS admin read).
 * Kalau `lessonId` dikasih, dibatasi ke respons yang masuk lewat lesson itu
 * (satu form bisa dipasang di beberapa lesson).
 */
export async function getFormResponses(formId, lessonId) {
  ensure();
  let q = supabase
    .from("coaching_form_responses")
    .select("id, user_id, answers, created_at")
    .eq("form_id", formId);
  if (lessonId) q = q.eq("lesson_id", lessonId);
  const { data, error } = await q.order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

export async function deleteFormResponse(id) {
  ensure();
  const { error } = await supabase
    .from("coaching_form_responses")
    .delete()
    .eq("id", id);
  if (error) throw error;
}

// ── CSV ────────────────────────────────────────────────────────────

function csvCell(v) {
  const s = Array.isArray(v) ? v.join("; ") : v == null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** form (dengan fields), responses[], usersById Map -> string CSV. */
export function responsesToCsv(form, responses, usersById) {
  const cols = ["Waktu", "Nama", "Email", ...form.fields.map((f) => f.label)];
  const rows = responses.map((r) => {
    const u = usersById?.get(r.user_id);
    const name = u
      ? [u.first_name, u.last_name].filter(Boolean).join(" ")
      : r.user_id;
    return [
      new Date(r.created_at).toLocaleString("id-ID"),
      name,
      u?.email ?? "",
      ...form.fields.map((f) => r.answers?.[f.id]),
    ];
  });
  return [cols, ...rows].map((row) => row.map(csvCell).join(",")).join("\n");
}
