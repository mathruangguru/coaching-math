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

/** true kalau course butuh passcode buat enroll. */
export async function isCourseEnrollLocked(courseId) {
  if (!hasSupabase) return false;
  const { data, error } = await supabase.rpc("course_enroll_locked", {
    p_course_id: courseId,
  });
  if (error) throw error;
  return !!data;
}

const ENROLL_ERRORS = {
  PASSCODE_SALAH: "Passcode salah.",
  BELUM_LOGIN: "Kamu belum login.",
  COURSE_TIDAK_ADA: "Course-nya nggak ditemukan.",
};

export async function enroll(courseId, passcode) {
  if (!hasSupabase) throw new Error("Supabase belum dikonfigurasi.");

  const { error } = await supabase.rpc("enroll_course", {
    p_course_id: courseId,
    p_passcode: passcode ?? null,
  });
  if (!error) return;

  const key = Object.keys(ENROLL_ERRORS).find((k) =>
    (error.message || "").includes(k)
  );
  throw new Error(key ? ENROLL_ERRORS[key] : (error.message ?? "Gagal enroll."));
}
