import { supabase, hasSupabase } from "./supabase";

function ensure() {
  if (!hasSupabase) throw new Error("Supabase belum dikonfigurasi.");
}

/** Daftar cabang, urut nama. [] kalau Supabase belum dikonfigurasi. */
export async function getBranches() {
  if (!hasSupabase) return [];
  const { data, error } = await supabase
    .from("coaching_branches")
    .select("id, name")
    .order("name");
  if (error) throw error;
  return data;
}

export async function createBranch(name) {
  ensure();
  const { data, error } = await supabase
    .from("coaching_branches")
    .insert({ id: crypto.randomUUID(), name: name.trim() })
    .select("id, name")
    .single();
  if (error) {
    if (error.code === "23505") throw new Error("Cabang itu sudah ada.");
    throw error;
  }
  return data;
}

export async function updateBranch(id, name) {
  ensure();
  const { error } = await supabase
    .from("coaching_branches")
    .update({ name: name.trim() })
    .eq("id", id);
  if (error) {
    if (error.code === "23505") throw new Error("Nama cabang itu sudah dipakai.");
    throw error;
  }
}

export async function deleteBranch(id) {
  ensure();
  const { error } = await supabase
    .from("coaching_branches")
    .delete()
    .eq("id", id);
  if (error) throw error;
}

/**
 * Teks (1 nama per baris) -> { items } nama unik & non-kosong.
 * Duplikat di dalam input diabaikan diam-diam.
 */
export function parseBranchesInput(text) {
  const seen = new Set();
  const items = [];
  for (const raw of (text ?? "").split(/\r?\n/)) {
    const name = raw.trim();
    if (!name) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    items.push(name);
  }
  return { items };
}

/**
 * Insert banyak cabang. Yang bentrok (sudah ada / dobel) dilewati diam-diam.
 * Balikin baris yang beneran ke-insert.
 */
export async function createBranchesBulk(names) {
  ensure();
  const added = [];
  for (const name of names) {
    const { data, error } = await supabase
      .from("coaching_branches")
      .insert({ id: crypto.randomUUID(), name })
      .select("id, name")
      .single();
    if (error) {
      if (error.code === "23505") continue; // sudah ada -> skip
      throw error;
    }
    added.push(data);
  }
  return added;
}
