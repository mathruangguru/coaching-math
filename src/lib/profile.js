import { supabase, hasSupabase } from "./supabase";

function assertReady() {
  if (!hasSupabase) throw new Error("Supabase belum dikonfigurasi.");
}

/**
 * Update nama depan / belakang milik user yang sedang login.
 * Dijaga RLS "update own"; kolom role dilindungi trigger.
 */
export async function updateMyProfile({ firstName, lastName }) {
  assertReady();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Belum login.");

  const { data, error } = await supabase
    .from("coaching_profiles")
    .update({
      first_name: firstName.trim() || null,
      last_name: lastName.trim() || null,
    })
    .eq("id", user.id)
    .select("id, email, first_name, last_name, role")
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
