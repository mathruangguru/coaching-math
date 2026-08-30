import { useEffect, useState } from "react";
import { useAuth } from "../context/auth-context";
import { updateMyProfile, changeMyPassword } from "../lib/profile";
import { getBranches } from "../lib/branches";

const inputCls =
  "mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 outline-none transition-colors focus:border-brand-500";

const card = "rounded-2xl border border-zinc-200/80 bg-white p-5 sm:p-6";
const btn =
  "rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-600 disabled:opacity-50";

export default function ProfilePage() {
  const { profile, refreshProfile } = useAuth();

  return (
    <div className="mx-auto flex max-w-[560px] flex-col gap-5">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-zinc-900">Profil</h1>
        <p className="mt-1 text-xs text-zinc-400">{profile?.email}</p>
      </div>

      <NameForm profile={profile} onSaved={refreshProfile} />
      <BranchForm profile={profile} onSaved={refreshProfile} />
      <PasswordForm />
    </div>
  );
}

function BranchForm({ profile, onSaved }) {
  const [branches, setBranches] = useState([]);
  const [branchId, setBranchId] = useState(profile?.branch_id ?? "");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  useEffect(() => {
    let alive = true;
    getBranches()
      .then((d) => alive && setBranches(d))
      .catch((err) => console.error("[profile] gagal memuat cabang:", err));
    return () => {
      alive = false;
    };
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      await updateMyProfile({ branchId: branchId || null });
      await onSaved?.();
      setMsg({ ok: true, text: "Cabang tersimpan." });
    } catch (err) {
      setMsg({ ok: false, text: err?.message ?? "Gagal menyimpan." });
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className={card}>
      <p className="text-sm font-bold tracking-tight text-zinc-900">Cabang</p>
      <label className="mt-3 block text-xs font-medium text-zinc-600">
        Cabang
        <select
          value={branchId}
          onChange={(e) => setBranchId(e.target.value)}
          className={inputCls}
        >
          <option value="">— pilih cabang —</option>
          {branches.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
      </label>

      {msg && (
        <p
          className={`mt-3 text-xs ${
            msg.ok ? "text-emerald-600" : "text-rose-600"
          }`}
        >
          {msg.text}
        </p>
      )}

      <button type="submit" disabled={busy} className={`mt-4 ${btn}`}>
        {busy ? "Menyimpan…" : "Simpan"}
      </button>
    </form>
  );
}

function NameForm({ profile, onSaved }) {
  const [firstName, setFirstName] = useState(profile?.first_name ?? "");
  const [lastName, setLastName] = useState(profile?.last_name ?? "");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null); // { ok, text }

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      await updateMyProfile({ firstName, lastName });
      await onSaved?.();
      setMsg({ ok: true, text: "Nama tersimpan." });
    } catch (err) {
      setMsg({ ok: false, text: err?.message ?? "Gagal menyimpan." });
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className={card}>
      <p className="text-sm font-bold tracking-tight text-zinc-900">Nama</p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="block text-xs font-medium text-zinc-600">
          Nama depan
          <input
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            required
            className={inputCls}
          />
        </label>
        <label className="block text-xs font-medium text-zinc-600">
          Nama belakang
          <input
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            required
            className={inputCls}
          />
        </label>
      </div>

      {msg && (
        <p
          className={`mt-3 text-xs ${
            msg.ok ? "text-emerald-600" : "text-rose-600"
          }`}
        >
          {msg.text}
        </p>
      )}

      <button type="submit" disabled={busy} className={`mt-4 ${btn}`}>
        {busy ? "Menyimpan…" : "Simpan"}
      </button>
    </form>
  );
}

function PasswordForm() {
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  const submit = async (e) => {
    e.preventDefault();
    setMsg(null);

    if (pw.length < 6) {
      setMsg({ ok: false, text: "Password minimal 6 karakter." });
      return;
    }
    if (pw !== pw2) {
      setMsg({ ok: false, text: "Konfirmasi password nggak cocok." });
      return;
    }

    setBusy(true);
    try {
      await changeMyPassword(pw);
      setPw("");
      setPw2("");
      setMsg({ ok: true, text: "Password diganti." });
    } catch (err) {
      setMsg({ ok: false, text: err?.message ?? "Gagal ganti password." });
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className={card}>
      <p className="text-sm font-bold tracking-tight text-zinc-900">Password</p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="block text-xs font-medium text-zinc-600">
          Password baru
          <input
            type="password"
            autoComplete="new-password"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            required
            className={inputCls}
          />
        </label>
        <label className="block text-xs font-medium text-zinc-600">
          Ulangi password baru
          <input
            type="password"
            autoComplete="new-password"
            value={pw2}
            onChange={(e) => setPw2(e.target.value)}
            required
            className={inputCls}
          />
        </label>
      </div>

      {msg && (
        <p
          className={`mt-3 text-xs ${
            msg.ok ? "text-emerald-600" : "text-rose-600"
          }`}
        >
          {msg.text}
        </p>
      )}

      <button type="submit" disabled={busy} className={`mt-4 ${btn}`}>
        {busy ? "Menyimpan…" : "Ganti password"}
      </button>
    </form>
  );
}
