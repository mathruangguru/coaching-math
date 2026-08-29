import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { hasSupabase } from "../lib/supabase";
import { signIn } from "../lib/auth";
import { useAuth } from "../context/auth-context";
import ruangguruLogo from "../assets/ruangguru.png";

const inputCls =
  "mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 outline-none transition-colors focus:border-brand-500";

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { session, loading } = useAuth();

  const dest = location.state?.from && location.state.from !== "/login"
    ? location.state.from
    : "/";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // Sudah login -> keluar dari halaman login.
  useEffect(() => {
    if (!loading && session) navigate(dest, { replace: true });
  }, [loading, session, dest, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await signIn(email, password);
      navigate(dest, { replace: true });
    } catch (err) {
      setError(err?.message ?? "Gagal masuk.");
      setBusy(false);
    }
  };

  return (
    <div className="grid min-h-screen place-items-center bg-[#f4f4f5] px-6">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm rounded-2xl border border-zinc-200 bg-white p-6"
      >
        <div className="flex items-center gap-2.5">
          <img src={ruangguruLogo} alt="Ruangguru" className="h-7 w-auto" />
          <span className="h-6 w-px bg-zinc-200" />
          <span className="text-xs font-extrabold uppercase tracking-wide text-zinc-900">
            Coaching Matematika
          </span>
        </div>
        <h1 className="mt-4 text-lg font-bold tracking-tight text-zinc-900">
          LOGIN
        </h1>

        {!hasSupabase && (
          <p className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
            Supabase belum dikonfigurasi (VITE_SUPABASE_URL / ANON_KEY). Login
            nonaktif.
          </p>
        )}

        <label className="mt-4 block text-xs font-medium text-zinc-600">
          Email
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={inputCls}
          />
        </label>

        <label className="mt-3 block text-xs font-medium text-zinc-600">
          Password
          <input
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={inputCls}
          />
        </label>

        {error && <p className="mt-3 text-xs text-rose-600">{error}</p>}

        <button
          type="submit"
          disabled={busy || !hasSupabase}
          className="mt-5 w-full rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-600 disabled:opacity-50"
        >
          {busy ? "Memproses…" : "LOGIN"}
        </button>
      </form>
    </div>
  );
}
