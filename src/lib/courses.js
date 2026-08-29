import { supabase, hasSupabase } from "./supabase";
import { myCourses, courseSections } from "../data/mock";

/**
 * Daftar course. Bentuk: { id, title, description, icon }[]
 */
export async function getCourses() {
  if (!hasSupabase) return myCourses;

  const { data, error } = await supabase
    .from("coaching_courses")
    .select("id, title, description, icon")
    .order("created_at");

  if (error) throw error;
  return data;
}

/**
 * Satu course + sections + lessons.
 * Bentuk sama dengan gabungan myCourses + courseSections di mock,
 * jadi CourseDetailPage nggak perlu ubah struktur.
 */
export async function getCourse(id) {
  if (!hasSupabase) {
    const course = myCourses.find((c) => c.id === id);
    return course ? { ...course, sections: courseSections[id] ?? [] } : null;
  }

  const { data, error } = await supabase
    .from("coaching_courses")
    .select(
      `id, title, description, icon,
       sections:coaching_course_sections (
         id, title, position,
         items:coaching_lessons ( id, type, title, duration, url, question_set_id, position )
       )`
    )
    .eq("id", id)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  // Urutkan berdasarkan position, lalu buang field position dari hasil.
  data.sections.sort((a, b) => a.position - b.position);
  for (const section of data.sections) {
    section.items.sort((a, b) => a.position - b.position);
    delete section.position;
    for (const item of section.items) delete item.position;
  }

  return data;
}

// ── Admin: tulis katalog (butuh login + role admin, dijaga RLS) ──────

const COURSE_COLS = "id, title, description, icon";

/**
 * Buat course baru. `payload`: { id, title, description, icon }
 */
export async function createCourse(payload) {
  if (!hasSupabase) throw new Error("Supabase belum dikonfigurasi.");

  const { data, error } = await supabase
    .from("coaching_courses")
    .insert(payload)
    .select(COURSE_COLS)
    .single();

  if (error) throw error;
  return data;
}

/**
 * Ubah metadata course. `patch`: { title, description, icon }
 */
export async function updateCourse(id, patch) {
  if (!hasSupabase) throw new Error("Supabase belum dikonfigurasi.");

  const { data, error } = await supabase
    .from("coaching_courses")
    .update(patch)
    .eq("id", id)
    .select(COURSE_COLS)
    .single();

  if (error) throw error;
  return data;
}

/**
 * Hapus course. Section & lesson ikut terhapus (ON DELETE CASCADE).
 */
export async function deleteCourse(id) {
  if (!hasSupabase) throw new Error("Supabase belum dikonfigurasi.");

  const { error } = await supabase.from("coaching_courses").delete().eq("id", id);
  if (error) throw error;
}

// ── Admin: kurikulum (section + lesson) ─────────────────────────────

function ensureSupabase() {
  if (!hasSupabase) throw new Error("Supabase belum dikonfigurasi.");
}

async function runAll(promises) {
  const results = await Promise.all(promises);
  const failed = results.find((r) => r?.error);
  if (failed) throw failed.error;
}

export async function createSection(courseId, { title, position }) {
  ensureSupabase();
  const { data, error } = await supabase
    .from("coaching_course_sections")
    .insert({ id: crypto.randomUUID(), course_id: courseId, title, position })
    .select("id, title")
    .single();
  if (error) throw error;
  return data;
}

export async function updateSection(id, patch) {
  ensureSupabase();
  const { error } = await supabase
    .from("coaching_course_sections")
    .update(patch)
    .eq("id", id);
  if (error) throw error;
}

export async function deleteSection(id) {
  ensureSupabase();
  const { error } = await supabase
    .from("coaching_course_sections")
    .delete()
    .eq("id", id);
  if (error) throw error;
}

export async function reorderSections(orderedIds) {
  ensureSupabase();
  await runAll(
    orderedIds.map((id, i) =>
      supabase
        .from("coaching_course_sections")
        .update({ position: i })
        .eq("id", id)
    )
  );
}

export async function createLesson(
  sectionId,
  { type, title, duration, url, questionSetId, position }
) {
  ensureSupabase();
  const { data, error } = await supabase
    .from("coaching_lessons")
    .insert({
      id: crypto.randomUUID(),
      section_id: sectionId,
      type,
      title,
      duration: duration || null,
      url: url || null,
      question_set_id: questionSetId || null,
      position,
    })
    .select("id, type, title, duration, url, question_set_id")
    .single();
  if (error) throw error;
  return data;
}

export async function updateLesson(id, patch) {
  ensureSupabase();
  const clean = { ...patch };
  if ("duration" in clean) clean.duration = clean.duration || null;
  if ("url" in clean) clean.url = clean.url?.trim() || null;
  if ("question_set_id" in clean) clean.question_set_id = clean.question_set_id || null;
  const { error } = await supabase
    .from("coaching_lessons")
    .update(clean)
    .eq("id", id);
  if (error) throw error;
}

export async function deleteLesson(id) {
  ensureSupabase();
  const { error } = await supabase.from("coaching_lessons").delete().eq("id", id);
  if (error) throw error;
}

export async function reorderLessons(orderedIds) {
  ensureSupabase();
  await runAll(
    orderedIds.map((id, i) =>
      supabase.from("coaching_lessons").update({ position: i }).eq("id", id)
    )
  );
}
