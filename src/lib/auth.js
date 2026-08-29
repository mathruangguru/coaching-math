import { supabase, hasSupabase } from "./supabase";

function assertReady() {
  if (!hasSupabase) throw new Error("Supabase belum dikonfigurasi.");
}

export async function signIn(email, password) {
  assertReady();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim(),
    password,
  });
  if (error) throw error;
  return data;
}

export async function signOut() {
  assertReady();
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}
