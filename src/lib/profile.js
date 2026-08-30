import { supabase, hasSupabase } from "./supabase";

function assertReady() {
  if (!hasSupabase) throw new Error("Supabase belum dikonfigurasi.");
}

/**
 * Update sebagian profil milik user yang login. Terima subset dari
 * { firstName, lastName, branchId }. Dijaga RLS "update own"; kolom role
 * dilindungi trigger.
 */
export async function updateMyProfile(patch) {
  assertReady();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Belum login.");

  const fields = {};
  if ("firstName" in patch) fields.first_name = patch.firstName.trim() || null;
  if ("lastName" in patch) fields.last_name = patch.lastName.trim() || null;
  if ("branchId" in patch) fields.branch_id = patch.branchId || null;

  const { data, error } = await supabase
    .from("coaching_profiles")
    .update(fields)
    .eq("id", user.id)
    .select("id, email, first_name, last_name, role, branch_id")
    .single();

  if (error) throw error;
  return data;
}

/**
 * Ganti password sendiri. Client Supabase boleh update user yang login.
 */
export async function changeMyPassword(newPassword) {
  assertReady();
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw error;
}
