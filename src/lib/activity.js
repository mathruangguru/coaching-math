import { supabase, hasSupabase } from "./supabase";

// Keaktifan murid per sesi (jenis materi 'keaktifan'). Admin yang mencatat,
// murid cuma melihat. Butuh supabase/keaktifan.sql.

// key = nilai di kolom `kinds` (array) di DB. Tiga toggle yang boleh
// dikombinasikan per murid per materi.
export const ACTIVITY_KINDS = [
  { key: "presentasi", label: "Presentasi" },
  { key: "tanya_jawab", label: "Tanya Jawab" },
  { key: "on_chat", label: "On Chat" },
];

const ORDER = ACTIVITY_KINDS.map((k) => k.key);

// ["a", "b", "c"] -> "a, b dan c"
const joinId = (xs) =>
  xs.length <= 1
    ? (xs[0] ?? "")
    : `${xs.slice(0, -1).join(", ")} dan ${xs[xs.length - 1]}`;

/**
 * Ringkasan buat murid dari kombinasi toggle: { label, sentence } atau null
 * kalau kosong. Contoh:
 *   [presentasi]                -> "Kamu melakukan presentasi pada sesi ini"
 *   [tanya_jawab, on_chat]      -> "Kamu aktif berdiskusi melalui sesi tanya
 *                                   jawab maupun melalui chat pada sesi ini"
 *   [presentasi, on_chat]       -> "Kamu melakukan presentasi dan aktif
 *                                   berdiskusi melalui chat pada sesi ini"
 */
export function activitySummary(kinds) {
  const set = new Set(Array.isArray(kinds) ? kinds : []);
  const picked = ORDER.filter((k) => set.has(k));
  if (picked.length === 0) return null;

  const tj = set.has("tanya_jawab");
  const chat = set.has("on_chat");
  const parts = [];
  if (set.has("presentasi")) parts.push("melakukan presentasi");
  if (tj && chat)
    parts.push("aktif berdiskusi melalui sesi tanya jawab maupun melalui chat");
  else if (tj) parts.push("aktif berdiskusi melalui sesi tanya jawab");
  else if (chat) parts.push("aktif berdiskusi melalui chat");

  return {
    label: joinId(
      picked.map((k) => ACTIVITY_KINDS.find((x) => x.key === k).label)
    ),
    sentence: `Kamu ${parts.join(" dan ")} pada sesi ini`,
  };
}

function ensure() {
  if (!hasSupabase) throw new Error("Supabase belum dikonfigurasi.");
}

/** Catatan keaktifan milik user yang login: { [lessonId]: kinds[] }. */
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
    .select("lesson_id, kinds")
    .eq("user_id", user.id)
    .in("lesson_id", lessonIds);
  if (error) throw error;
  return Object.fromEntries(data.map((r) => [r.lesson_id, r.kinds]));
}

/** Admin: semua catatan buat daftar lesson. Bentuk: { lesson_id, user_id, kinds[] }[]. */
export async function getActivityMarks(lessonIds) {
  ensure();
  if (!lessonIds?.length) return [];
  const { data, error } = await supabase
    .from("coaching_activity_marks")
    .select("lesson_id, user_id, kinds")
    .in("lesson_id", lessonIds);
  if (error) throw error;
  return data;
}

/** Admin: set / ganti catatan seorang murid. `kinds` kosong = hapus catatan. */
export async function setActivityMark(lessonId, userId, kinds) {
  ensure();
  const clean = ORDER.filter((k) => kinds?.includes(k));
  if (clean.length === 0) {
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
      kinds: clean,
      marked_by: user?.id ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "lesson_id,user_id" }
  );
  if (error) throw error;
}
