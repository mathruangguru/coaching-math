import { supabase, hasSupabase } from "./supabase";

// Coret-coretan kuis (foto) yang dikumpulkan murid setelah submit.
// Butuh supabase/quiz-scratch.sql. Bucket privat -> akses lewat signed URL.
const BUCKET = "quiz-scratch";
export const SCRATCH_MAX_FILES = 10;
const OK_TYPES = ["image/png", "image/jpeg", "image/webp"];
const EXT = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" };
const SIGN_TTL_SEC = 3600;

function ensure() {
  if (!hasSupabase) throw new Error("Supabase belum dikonfigurasi.");
}

/**
 * Status upload buat satu lesson soal (attempt milik murid yang login).
 * null = fitur nggak aktif / belum submit. Selain itu:
 * { attemptId, windowMin, remainingMs } — remainingMs dihitung dari jam
 * SERVER (closes_at - server_now), jadi nggak tergantung jam perangkat.
 */
export async function getScratchStatus(lessonId) {
  ensure();
  const { data, error } = await supabase.rpc("quiz_scratch_status", {
    p_lesson_id: lessonId,
  });
  if (error) throw error;
  if (!data) return null;
  return {
    attemptId: data.attempt_id,
    windowMin: data.window_min,
    remainingMs: Math.max(
      0,
      new Date(data.closes_at).getTime() - new Date(data.server_now).getTime()
    ),
  };
}

async function withUrls(rows) {
  if (!rows.length) return [];
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrls(
      rows.map((r) => r.path),
      SIGN_TTL_SEC
    );
  if (error) throw error;
  const byPath = new Map(data.map((d) => [d.path, d.signedUrl]));
  return rows.map((r) => ({ ...r, url: byPath.get(r.path) ?? null }));
}

/** File coret-coretan satu attempt (urut upload), lengkap dengan signed URL. */
export async function listScratch(attemptId) {
  ensure();
  const { data, error } = await supabase
    .from("coaching_quiz_scratch")
    .select("id, path, created_at")
    .eq("attempt_id", attemptId)
    .order("created_at");
  if (error) throw error;
  return withUrls(data);
}

/**
 * Jumlah file per attempt di satu set: Map(attempt_id -> n). Admin-only (RLS).
 */
export async function getScratchCounts(setId) {
  ensure();
  const { data, error } = await supabase
    .from("coaching_quiz_scratch")
    .select("attempt_id, attempt:coaching_quiz_attempts!inner(set_id)")
    .eq("attempt.set_id", setId);
  if (error) throw error;
  const out = new Map();
  for (const r of data) out.set(r.attempt_id, (out.get(r.attempt_id) ?? 0) + 1);
  return out;
}

// Foto HP bisa 5-10 MB. Kecilin dulu (maks 1600 px sisi terpanjang, JPEG) —
// cukup buat coretan tulisan tangan, upload lebih cepat di jendela 5 menit.
// Gagal decode / hasilnya malah lebih besar -> pakai file aslinya.
async function shrink(file, maxPx = 1600, quality = 0.85) {
  try {
    const bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
    const scale = Math.min(1, maxPx / Math.max(bmp.width, bmp.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bmp.width * scale);
    canvas.height = Math.round(bmp.height * scale);
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    bmp.close?.();
    const blob = await new Promise((res) =>
      canvas.toBlob(res, "image/jpeg", quality)
    );
    return blob && blob.size < file.size ? blob : file;
  } catch {
    return file;
  }
}

/** Upload satu foto buat attempt ini. Balikin baris + signed URL. */
export async function uploadScratch(attemptId, file) {
  ensure();
  if (file.type && !OK_TYPES.includes(file.type))
    throw new Error("File harus gambar (PNG, JPG, atau WEBP).");
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Belum login.");

  const body = await shrink(file);
  const type = OK_TYPES.includes(body.type) ? body.type : "image/jpeg";
  const path = `${user.id}/${attemptId}/${crypto.randomUUID()}.${EXT[type]}`;

  const { error: upErr } = await supabase.storage
    .from(BUCKET)
    .upload(path, body, { contentType: type, upsert: false });
  if (upErr) throw upErr;

  const { data, error } = await supabase
    .from("coaching_quiz_scratch")
    .insert({ attempt_id: attemptId, path })
    .select("id, path, created_at")
    .single();
  if (error) {
    await supabase.storage.from(BUCKET).remove([path]).catch(() => {});
    throw error;
  }
  const [withUrl] = await withUrls([data]);
  return withUrl;
}

/** Hapus satu foto (murid: cuma selama window masih buka — dijaga RLS). */
export async function deleteScratch(item) {
  ensure();
  const { data, error } = await supabase
    .from("coaching_quiz_scratch")
    .delete()
    .eq("id", item.id)
    .select("id");
  if (error) throw error;
  // RLS yang nolak (window habis) nggak error, cuma 0 baris kehapus.
  if (!data?.length) throw new Error("Waktu upload sudah habis.");
  await supabase.storage.from(BUCKET).remove([item.path]).catch(() => {});
}
