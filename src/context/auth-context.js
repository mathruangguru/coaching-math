import { createContext, useContext } from "react";

/**
 * { session, profile, loading, isAdmin, isSuperAdmin, refreshProfile }
 * isAdmin = role admin ATAU super_admin. isSuperAdmin = super_admin doang.
 * Di-provide oleh <AuthProvider> (src/context/AuthProvider.jsx).
 */
export const AuthContext = createContext(null);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth harus dipakai di dalam <AuthProvider>");
  return ctx;
}
