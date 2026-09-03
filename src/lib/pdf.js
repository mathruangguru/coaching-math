import { supabase, hasSupabase } from "./supabase";

const BUCKET = "lesson-files";
export const PDF_MAX_MB = 50;

/** Upload PDF ke storage, balikin public URL yang bisa dipasang di <iframe>. */
export async function uploadLessonPdf(lessonId, file) {
  if (!hasSupabase) throw new Error("Supabase belum dikonfigurasi.");
  if (file.type && file.type !== "application/pdf")
    throw new Error("File harus PDF.");
  if (file.size > PDF_MAX_MB * 1024 * 1024)
    throw new Error(`Ukuran PDF maksimal ${PDF_MAX_MB} MB.`);

  const path = `${lessonId}/${crypto.randomUUID()}.pdf`;
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { contentType: "application/pdf", upsert: false });
  if (error) throw error;
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

/** Hapus file dari storage berdasarkan public URL-nya. Best-effort. */
export async function deleteLessonPdf(url) {
  if (!hasSupabase || !url) return;
  const m = String(url).match(/\/lesson-files\/(.+?)(?:\?|$)/);
  if (!m) return;
  await supabase.storage
    .from(BUCKET)
    .remove([decodeURIComponent(m[1])])
    .catch(() => {});
}
