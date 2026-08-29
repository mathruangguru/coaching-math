import { useEffect, useState } from "react";
import { supabase, hasSupabase } from "../lib/supabase";
import { AuthContext } from "./auth-context";

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  // Sudah selesai cek session awal? (kalau Supabase mati, nggak ada yang dicek)
  const [sessionChecked, setSessionChecked] = useState(!hasSupabase);
  const [profile, setProfile] = useState(null);
  const [profileUserId, setProfileUserId] = useState(null);

  // Ikuti perubahan session (login / logout / refresh token).
  useEffect(() => {
    if (!hasSupabase) return;

    let alive = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!alive) return;
      setSession(data.session);
      setSessionChecked(true);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      if (!alive) return;
      setSession(next);
      setSessionChecked(true);
    });

    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  // Ambil profile (buat tahu role) tiap kali user berganti.
  const userId = session?.user?.id ?? null;
  useEffect(() => {
    if (!hasSupabase || !userId) return;

    let alive = true;

    supabase
      .from("coaching_profiles")
      .select("id, email, role")
      .eq("id", userId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (!alive) return;
        if (error) console.error("[auth] gagal ambil profil:", error);
        setProfile(data ?? null);
        setProfileUserId(userId);
      });

    return () => {
      alive = false;
    };
  }, [userId]);

  // Profile-nya sudah nyambung sama user yang sekarang?
  const profileReady = userId !== null && profileUserId === userId;

  const value = {
    session,
    profile: profileReady ? profile : null,
    loading:
      hasSupabase && (!sessionChecked || (userId !== null && !profileReady)),
    isAdmin: profileReady && profile?.role === "admin",
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
