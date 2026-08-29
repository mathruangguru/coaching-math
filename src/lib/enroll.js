import { supabase, hasSupabase } from "./supabase";

/**
 * Daftar course_id yang sudah di-enroll user sekarang. Kalau Supabase
 * belum dikonfigurasi, anggap semua ke-enroll (biar mode mock jalan).
 */
export async function getMyEnrollments() {
  if (!hasSupabase) return null; // null = "abaikan gate"

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("coaching_enrollments")
    .select("course_id")
    .eq("user_id", user.id);
  if (error) throw error;
  return data.map((r) => r.course_id);
}

/**
 * Semua baris enrollment — buat rekap admin. Dijaga RLS
 * "coaching_enrollments admin read" (butuh caller = admin).
 * Bentuk: { user_id, course_id, created_at }[]
 */
export async function getAllEnrollments() {
  if (!hasSupabase) return [];

  const { data, error } = await supabase
    .from("coaching_enrollments")
    .select("user_id, course_id, created_at")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

export async function enroll(courseId) {
  if (!hasSupabase) throw new Error("Supabase belum dikonfigurasi.");
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Belum login.");

  const { error } = await supabase
    .from("coaching_enrollments")
    .insert({ user_id: user.id, course_id: courseId });
  // 23505 = sudah enroll -> anggap sukses
  if (error && error.code !== "23505") throw error;
}
