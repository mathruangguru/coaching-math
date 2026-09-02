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

// ── Presensi (per ronde) ────────────────────────────────────────────

/** Semua ronde presensi sebuah lesson (urut dibuat). */
export async function getRounds(lessonId) {
  if (!hasSupabase) return [];
  const { data, error } = await supabase
    .from("coaching_attendance_rounds")
    .select("id, label, is_open, created_at")
    .eq("lesson_id", lessonId)
    .order("created_at");
  if (error) throw error;
  return data;
}

/** round_id[] yang udah di-check-in user ini (dari daftar ronde yang dikasih). */
export async function getMyCheckins(roundIds) {
  if (!hasSupabase || !roundIds?.length) return [];
  const id = await uid();
  if (!id) return [];
  const { data, error } = await supabase
    .from("coaching_attendance")
    .select("round_id")
    .eq("user_id", id)
    .in("round_id", roundIds);
  if (error) throw error;
  return data.map((r) => r.round_id);
}

/** Check-in ke satu ronde. Idempoten (23505 = udah). */
export async function checkInRound(roundId) {
  ensure();
  const id = await uid();
  if (!id) throw new Error("Belum login.");
  const { error } = await supabase
    .from("coaching_attendance")
    .insert({ round_id: roundId, user_id: id });
  if (error && error.code !== "23505") throw error;
}

// Admin
export async function createRound(lessonId, label) {
  ensure();
  const { data, error } = await supabase
    .from("coaching_attendance_rounds")
    .insert({
      id: crypto.randomUUID(),
      lesson_id: lessonId,
      label: label?.trim() || "Presensi",
    })
    .select("id, label, is_open, created_at")
    .single();
  if (error) throw error;
  return data;
}

export async function setRoundOpen(roundId, isOpen) {
  ensure();
  const { error } = await supabase
    .from("coaching_attendance_rounds")
    .update({ is_open: !!isOpen })
    .eq("id", roundId);
  if (error) throw error;
}

export async function deleteRound(roundId) {
  ensure();
  const { error } = await supabase
    .from("coaching_attendance_rounds")
    .delete()
    .eq("id", roundId);
  if (error) throw error;
}

/** Siapa aja yang hadir di satu ronde — rekap admin. */
export async function getRoundAttendance(roundId) {
  ensure();
  const { data, error } = await supabase
    .from("coaching_attendance")
    .select("user_id, checked_in_at")
    .eq("round_id", roundId)
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
