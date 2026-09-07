import { supabase, hasSupabase } from "./supabase";

const BUCKET = "lesson-images";
export const IMAGE_MAX_MB = 10;

const OK_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"];
const EXT = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
};

/** Upload gambar ke storage, balikin public URL buat dipasang di <img>. */
export async function uploadLessonImage(lessonId, file) {
  if (!hasSupabase) throw new Error("Supabase belum dikonfigurasi.");
  if (file.type && !OK_TYPES.includes(file.type))
    throw new Error("File harus gambar (PNG, JPG, WEBP, atau GIF).");
  if (file.size > IMAGE_MAX_MB * 1024 * 1024)
    throw new Error(`Ukuran gambar maksimal ${IMAGE_MAX_MB} MB.`);

  const path = `${lessonId}/${crypto.randomUUID()}.${EXT[file.type] ?? "png"}`;
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, {
      contentType: file.type || "image/png",
      upsert: false,
    });
  if (error) throw error;
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

/** Hapus file dari storage berdasarkan public URL-nya. Best-effort. */
export async function deleteLessonImage(url) {
  if (!hasSupabase || !url) return;
  const m = String(url).match(/\/lesson-images\/(.+?)(?:\?|$)/);
  if (!m) return;
  await supabase.storage
    .from(BUCKET)
    .remove([decodeURIComponent(m[1])])
    .catch(() => {});
}
