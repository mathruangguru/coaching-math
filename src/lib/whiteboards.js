import { supabase, hasSupabase } from "./supabase";

function ensure() {
  if (!hasSupabase) throw new Error("Supabase belum dikonfigurasi.");
}

export const EMPTY_BOARD = { bg: "blank", strokes: [] };

/** Daftar board (tanpa `data`), terbaru dulu. */
export async function getWhiteboards() {
  if (!hasSupabase) return [];
  const { data, error } = await supabase
    .from("coaching_whiteboards")
    .select("id, title, shared, updated_at")
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

/** Satu board lengkap dengan `data`. */
export async function getWhiteboard(id) {
  ensure();
  const { data, error } = await supabase
    .from("coaching_whiteboards")
    .select("id, title, data, shared, updated_at")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (data && (!data.data || typeof data.data !== "object")) {
    data.data = { ...EMPTY_BOARD };
  }
  return data;
}

export async function createWhiteboard(title = "Papan baru") {
  ensure();
  const { data, error } = await supabase
    .from("coaching_whiteboards")
    .insert({ title: title.trim() || "Papan baru", data: EMPTY_BOARD })
    .select("id, title, shared, updated_at")
    .single();
  if (error) throw error;
  return data;
}

/** patch: { title?, data?, shared? }. `updated_at` selalu di-bump. */
export async function updateWhiteboard(id, patch) {
  ensure();
  const row = { updated_at: new Date().toISOString() };
  if (patch.title !== undefined) row.title = patch.title.trim() || "Papan baru";
  if (patch.data !== undefined) row.data = patch.data;
  if (patch.shared !== undefined) row.shared = !!patch.shared;
  const { error } = await supabase
    .from("coaching_whiteboards")
    .update(row)
    .eq("id", id);
  if (error) throw error;
}

export async function deleteWhiteboard(id) {
  ensure();
  const { error } = await supabase
    .from("coaching_whiteboards")
    .delete()
    .eq("id", id);
  if (error) throw error;
}
