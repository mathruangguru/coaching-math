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
         items:coaching_lessons ( id, type, title, duration, position )
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
