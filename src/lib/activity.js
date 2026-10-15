import { supabase, hasSupabase } from "./supabase";

// Keaktifan murid per sesi (jenis materi 'keaktifan'). Admin yang mencatat,
// murid cuma melihat. Butuh supabase/keaktifan.sql.

// key = nilai `kind` di DB. `label` = nama pendek (admin), `sentence` = yang
// dibaca murid ("Kamu …").
export const ACTIVITY_KINDS = [
  {
    key: "presentasi",
    label: "Presentasi",
    sentence: "Kamu melakukan presentasi pada sesi ini",
  },
  {
    key: "tanya_jawab",
    label: "Tanya Jawab",
    sentence:
      "Kamu aktif berdiskusi melalui sesi tanya jawab pada sesi ini",
  },
  {
    key: "on_chat",
    label: "On Chat",
    sentence: "Kamu aktif berdiskusi melalui chat pada sesi ini",
  },
  {
    key: "tanya_jawab_on_chat",
    label: "Tanya Jawab dan On Chat",
    sentence:
      "Kamu aktif berdiskusi melalui sesi tanya jawab maupun melalui chat pada sesi ini",
  },
];

export const activityKind = (key) =>
  ACTIVITY_KINDS.find((k) => k.key === key) ?? null;

function ensure() {
  if (!hasSupabase) throw new Error("Supabase belum dikonfigurasi.");
}

/** Catatan keaktifan milik user yang login: { [lessonId]: kind }. */
export async function getMyActivityMarks(lessonIds) {
  if (!hasSupabase || !lessonIds?.length) return {};
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return {};
  // Filter user_id eksplisit: admin lolos RLS ke SEMUA baris, jadi tanpa ini
  // catatan murid lain ikut kebaca sebagai milik admin.
  const { data, error } = await supabase
    .from("coaching_activity_marks")
    .select("lesson_id, kind")
    .eq("user_id", user.id)
    .in("lesson_id", lessonIds);
  if (error) throw error;
  return Object.fromEntries(data.map((r) => [r.lesson_id, r.kind]));
}

/** Admin: semua catatan buat daftar lesson. Bentuk: { lesson_id, user_id, kind }[]. */
export async function getActivityMarks(lessonIds) {
  ensure();
  if (!lessonIds?.length) return [];
  const { data, error } = await supabase
    .from("coaching_activity_marks")
    .select("lesson_id, user_id, kind")
    .in("lesson_id", lessonIds);
  if (error) throw error;
  return data;
}

/** Admin: set / ganti catatan seorang murid. `kind` null = hapus catatan. */
export async function setActivityMark(lessonId, userId, kind) {
  ensure();
  if (!kind) {
    const { error } = await supabase
      .from("coaching_activity_marks")
      .delete()
      .eq("lesson_id", lessonId)
      .eq("user_id", userId);
    if (error) throw error;
    return;
  }
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { error } = await supabase.from("coaching_activity_marks").upsert(
    {
      lesson_id: lessonId,
      user_id: userId,
      kind,
      marked_by: user?.id ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "lesson_id,user_id" }
  );
  if (error) throw error;
}
