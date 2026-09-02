import { supabase, hasSupabase } from "./supabase";

function ensure() {
  if (!hasSupabase) throw new Error("Supabase belum dikonfigurasi.");
}

async function uid() {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}

// ── Presensi ────────────────────────────────────────────────────────

/** Waktu (ISO) presensi user ini di lesson, atau null kalau belum. */
export async function getMyAttendance(lessonId) {
  if (!hasSupabase) return null;
  const id = await uid();
  if (!id) return null;
  const { data, error } = await supabase
    .from("coaching_attendance")
    .select("checked_in_at")
    .eq("lesson_id", lessonId)
    .eq("user_id", id)
    .maybeSingle();
  if (error) throw error;
  return data?.checked_in_at ?? null;
}

/** Presensi diri sendiri. Idempoten (23505 = udah presensi -> anggap sukses). */
export async function checkIn(lessonId) {
  ensure();
  const id = await uid();
  if (!id) throw new Error("Belum login.");
  const { error } = await supabase
    .from("coaching_attendance")
    .insert({ lesson_id: lessonId, user_id: id });
  if (error && error.code !== "23505") throw error;
}

/** Semua presensi sebuah lesson — buat rekap admin (RLS admin read). */
export async function getLessonAttendance(lessonId) {
  ensure();
  const { data, error } = await supabase
    .from("coaching_attendance")
    .select("user_id, checked_in_at")
    .eq("lesson_id", lessonId)
    .order("checked_in_at");
  if (error) throw error;
  return data;
}

// ── Refleksi ────────────────────────────────────────────────────────

export async function getMyReflection(lessonId) {
  if (!hasSupabase) return null;
  const id = await uid();
  if (!id) return null;
  const { data, error } = await supabase
    .from("coaching_reflections")
    .select("body, updated_at")
    .eq("lesson_id", lessonId)
    .eq("user_id", id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function saveReflection(lessonId, body) {
  ensure();
  const id = await uid();
  if (!id) throw new Error("Belum login.");
  const { error } = await supabase.from("coaching_reflections").upsert(
    {
      lesson_id: lessonId,
      user_id: id,
      body: (body ?? "").trim(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "lesson_id,user_id" }
  );
  if (error) throw error;
}

/** Semua refleksi sebuah lesson — rekap admin (RLS admin read). */
export async function getLessonReflections(lessonId) {
  ensure();
  const { data, error } = await supabase
    .from("coaching_reflections")
    .select("user_id, body, updated_at")
    .eq("lesson_id", lessonId)
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return data;
}
