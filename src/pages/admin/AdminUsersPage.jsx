import { useEffect, useState } from "react";
import { UserPlus, KeyRound, Trash2, Users, X } from "lucide-react";
import {
  getUsers,
  createUser,
  createUsersBulk,
  parseUsersInput,
  setUserRole,
  setUserPassword,
  deleteUser,
} from "../../lib/users";
import { useAuth } from "../../context/auth-context";
import Skeleton from "../../components/ui/Skeleton";

const BULK_EXAMPLE = `budi@sekolah.id, Budi, Santoso
siti@sekolah.id, Siti, Aminah, rahasia123
adi@sekolah.id, Adi, Nugroho, , admin`;

const inputCls =
  "w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 outline-none transition-colors focus:border-brand-500";

const emptyForm = {
  firstName: "",
  lastName: "",
  email: "",
  password: "",
  role: "student",
};

const roleLabels = {
  student: "student",
  admin: "admin",
  super_admin: "super admin",
};

function fullName(u) {
  return [u.first_name, u.last_name].filter(Boolean).join(" ");
}

function BulkModal({ isSuperAdmin, onClose, onDone }) {
  const [text, setText] = useState("");
  const [parsed, setParsed] = useState(null); // { items, errors }
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState(null); // [{ email, ok, password, role, error }]

  const check = () => {
    setResults(null);
    setParsed(parseUsersInput(text));
  };

  const run = async () => {
    const p = parsed ?? parseUsersInput(text);
    setParsed(p);
    if (!p.items.length) return;
    setBusy(true);
    try {
      const { results: res } = await createUsersBulk(p.items);
      setResults(res ?? []);
    } catch (err) {
      window.alert(err?.message ?? "Gagal membuat user.");
    } finally {
      setBusy(false);
    }
  };

  const okCount = results?.filter((r) => r.ok).length ?? 0;
  const tsv = results
    ?.filter((r) => r.ok)
    .map((r) => `${r.email}\t${r.password}`)
    .join("\n");

  const close = () => {
    onClose();
    if (results?.some((r) => r.ok)) onDone();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-zinc-900/40 p-4 sm:p-8"
      onClick={close}
    >
      <div
        className="w-full max-w-xl rounded-2xl border border-zinc-200 bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 border-b border-zinc-100 px-5 py-3.5">
          <h3 className="text-sm font-bold text-zinc-900">Tambah banyak user</h3>
          <button
            type="button"
            onClick={close}
            aria-label="Tutup"
            className="grid h-8 w-8 place-items-center rounded-lg text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700"
          >
            <X size={16} />
          </button>
        </div>

        <div className="max-h-[70vh] overflow-y-auto p-5">
          {!results && (
            <>
              <p className="text-xs text-zinc-500">
                Satu user per baris:{" "}
                <code className="rounded bg-zinc-100 px-1">
                  email, nama depan, nama belakang, password?, role?
                </code>
                . Password kosong = digenerate.
                {!isSuperAdmin && " Semua dibuat sebagai student."}
              </p>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={8}
                spellCheck={false}
                placeholder={BULK_EXAMPLE}
                className="mt-2 w-full rounded-lg border border-zinc-300 px-3 py-2 font-mono text-xs text-zinc-900 outline-none focus:border-brand-500"
              />

              {parsed && (
                <div className="mt-3 text-xs">
                  <p className="font-semibold text-zinc-700">
                    {parsed.items.length} user siap dibuat
                    {parsed.errors.length > 0 &&
                      ` · ${parsed.errors.length} baris dilewati`}
                  </p>
                  {parsed.errors.length > 0 && (
                    <ul className="mt-1 list-inside list-disc text-rose-600">
                      {parsed.errors.map((e, i) => (
                        <li key={i}>{e}</li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              <div className="mt-4 flex gap-2">
                <button
                  type="button"
                  onClick={check}
                  className="rounded-lg border border-zinc-200 px-3 py-2 text-xs font-medium text-zinc-600 transition-colors hover:bg-zinc-50"
                >
                  Cek
                </button>
                <button
                  type="button"
                  onClick={run}
                  disabled={busy || !parsed?.items.length}
                  className="rounded-lg bg-brand-500 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-brand-600 disabled:opacity-50"
                >
                  {busy
                    ? "Membuat…"
                    : parsed?.items.length
                      ? `Buat ${parsed.items.length} user`
                      : "Buat user"}
                </button>
              </div>
            </>
          )}

          {results && (
            <>
              <p className="text-xs font-semibold text-zinc-700">
                {okCount} dari {results.length} user dibuat
              </p>
              <ul className="mt-2 flex flex-col gap-1">
                {results.map((r, i) => (
                  <li
                    key={i}
                    className="flex items-center justify-between gap-3 rounded-md border border-zinc-100 px-2.5 py-1.5 text-xs"
                  >
                    <span className="min-w-0 truncate text-zinc-700">
                      {r.email}
                    </span>
                    {r.ok ? (
                      <span className="shrink-0 font-mono text-emerald-600">
                        {r.password}
                      </span>
                    ) : (
                      <span className="shrink-0 text-rose-600">{r.error}</span>
                    )}
                  </li>
                ))}
              </ul>

              {tsv && (
                <label className="mt-3 block text-xs font-medium text-zinc-600">
                  Email &amp; password (copy buat dibagikan)
                  <textarea
                    readOnly
                    value={tsv}
                    rows={Math.min(okCount + 1, 8)}
                    onFocus={(e) => e.target.select()}
                    className="mt-1 w-full rounded-lg border border-zinc-300 bg-zinc-50 px-3 py-2 font-mono text-xs text-zinc-900"
                  />
                </label>
              )}

              <div className="mt-4">
                <button
                  type="button"
                  onClick={close}
                  className="rounded-lg bg-zinc-900 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-zinc-700"
                >
                  Selesai
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function AdminUsersPage() {
  const { session, isSuperAdmin } = useAuth();
  const myId = session?.user?.id ?? null;

  const [users, setUsers] = useState([]);
  const [status, setStatus] = useState("loading"); // loading | error | ready

  const [form, setForm] = useState(emptyForm);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState("");
  const [formOk, setFormOk] = useState("");
  const [rowBusyId, setRowBusyId] = useState(null);
  const [showBulk, setShowBulk] = useState(false);

  const fetchUsers = () =>
    getUsers()
      .then((data) => {
        setUsers(data);
        setStatus("ready");
      })
      .catch((err) => {
        console.error("[admin] gagal memuat user:", err);
        setStatus("error");
      });

  useEffect(() => {
    let alive = true;
    getUsers()
      .then((data) => {
        if (!alive) return;
        setUsers(data);
        setStatus("ready");
      })
      .catch((err) => {
        if (!alive) return;
        console.error("[admin] gagal memuat user:", err);
        setStatus("error");
      });
    return () => {
      alive = false;
    };
  }, []);

  const set = (key, val) => setForm((f) => ({ ...f, [key]: val }));

  const handleCreate = async (e) => {
    e.preventDefault();
    setFormError("");
    setFormOk("");

    if (!form.firstName.trim() || !form.lastName.trim()) {
      setFormError("Nama depan & belakang wajib diisi.");
      return;
    }
    if (form.password.length < 6) {
      setFormError("Password minimal 6 karakter.");
      return;
    }

    setBusy(true);
    try {
      // Admin biasa cuma boleh bikin murid (Edge Function juga memaksa ini).
      await createUser({ ...form, role: isSuperAdmin ? form.role : "student" });
      setFormOk(`User ${form.email.trim()} dibuat.`);
      setForm(emptyForm);
      await fetchUsers();
    } catch (err) {
      setFormError(err?.message ?? "Gagal membuat user.");
    } finally {
      setBusy(false);
    }
  };

  const handleRoleChange = async (user, role) => {
    setRowBusyId(user.id);
    try {
      await setUserRole(user.id, role);
      setUsers((prev) =>
        prev.map((u) => (u.id === user.id ? { ...u, role } : u))
      );
    } catch (err) {
      window.alert(`Gagal ganti role: ${err?.message ?? err}`);
    } finally {
      setRowBusyId(null);
    }
  };

  const handleSetPassword = async (user) => {
    const pw = window.prompt(
      `Password baru untuk ${user.email ?? fullName(user)} (min 6 karakter):`
    );
    if (pw == null) return;
    if (pw.length < 6) {
      window.alert("Password minimal 6 karakter.");
      return;
    }

    setRowBusyId(user.id);
    try {
      await setUserPassword(user.id, pw);
      window.alert("Password diganti.");
    } catch (err) {
      window.alert(`Gagal: ${err?.message ?? err}`);
    } finally {
      setRowBusyId(null);
    }
  };

  const handleDelete = async (user) => {
    const ok = window.confirm(
      `Hapus user ${user.email ?? fullName(user)}? Nggak bisa dibatalkan.`
    );
    if (!ok) return;

    setRowBusyId(user.id);
    try {
      await deleteUser(user.id);
      setUsers((prev) => prev.filter((u) => u.id !== user.id));
    } catch (err) {
      window.alert(`Gagal menghapus: ${err?.message ?? err}`);
    } finally {
      setRowBusyId(null);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-zinc-900">
          Pengguna
        </h1>
        <p className="mt-1 text-xs text-zinc-400">
          {isSuperAdmin
            ? "Buat akun, atur peran, set password, atau hapus."
            : "Buat akun murid baru."}
        </p>
      </div>

      {showBulk && (
        <BulkModal
          isSuperAdmin={isSuperAdmin}
          onClose={() => setShowBulk(false)}
          onDone={fetchUsers}
        />
      )}

      {/* Tambah user */}
      <form
        onSubmit={handleCreate}
        className="flex flex-col gap-3 rounded-2xl border border-zinc-200 bg-white p-5"
      >
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs font-semibold text-zinc-700">Tambah user</p>
          <button
            type="button"
            onClick={() => setShowBulk(true)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 px-2.5 py-1.5 text-xs font-medium text-zinc-600 transition-colors hover:bg-zinc-50"
          >
            <Users size={13} /> Tambah banyak
          </button>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-xs font-medium text-zinc-600">
            Nama depan
            <input
              required
              autoComplete="off"
              value={form.firstName}
              onChange={(e) => set("firstName", e.target.value)}
              className={`mt-1 ${inputCls}`}
            />
          </label>
          <label className="block text-xs font-medium text-zinc-600">
            Nama belakang
            <input
              required
              autoComplete="off"
              value={form.lastName}
              onChange={(e) => set("lastName", e.target.value)}
              className={`mt-1 ${inputCls}`}
            />
          </label>
        </div>

        <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
          <label className="block text-xs font-medium text-zinc-600">
            Email
            <input
              type="email"
              required
              autoComplete="off"
              value={form.email}
              onChange={(e) => set("email", e.target.value)}
              className={`mt-1 ${inputCls}`}
            />
          </label>
          <label className="block text-xs font-medium text-zinc-600">
            Password sementara
            <input
              type="text"
              required
              autoComplete="off"
              value={form.password}
              onChange={(e) => set("password", e.target.value)}
              className={`mt-1 ${inputCls}`}
            />
          </label>
          <label className="block text-xs font-medium text-zinc-600">
            Role
            <select
              value={isSuperAdmin ? form.role : "student"}
              disabled={!isSuperAdmin}
              onChange={(e) => set("role", e.target.value)}
              title={
                isSuperAdmin ? undefined : "Cuma super admin yang bisa set role"
              }
              className={`mt-1 ${inputCls} disabled:bg-zinc-100 disabled:text-zinc-400`}
            >
              <option value="student">student</option>
              {isSuperAdmin && <option value="admin">admin</option>}
              {isSuperAdmin && <option value="super_admin">super admin</option>}
            </select>
          </label>
        </div>

        {formError && <p className="text-xs text-rose-600">{formError}</p>}
        {formOk && <p className="text-xs text-emerald-600">{formOk}</p>}

        <div>
          <button
            type="submit"
            disabled={busy}
            className="inline-flex items-center gap-1.5 rounded-lg bg-brand-500 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-brand-600 disabled:opacity-50"
          >
            <UserPlus size={14} /> {busy ? "Membuat…" : "Buat user"}
          </button>
        </div>
      </form>

      {/* Daftar user */}
      {status === "loading" && (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full rounded-xl" />
          ))}
        </div>
      )}

      {status === "error" && (
        <p className="rounded-xl border border-dashed border-rose-300 bg-white px-6 py-8 text-center text-sm text-rose-500">
          Gagal memuat daftar user.
        </p>
      )}

      {status === "ready" && (
        <ul className="flex flex-col gap-2">
          {users.map((user) => {
            const isSelf = user.id === myId;
            const name = fullName(user);
            return (
              <li
                key={user.id}
                className="flex flex-wrap items-center gap-3 rounded-xl border border-zinc-200 bg-white px-4 py-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-zinc-900">
                    {name || user.email || user.id}
                    {isSelf && (
                      <span className="ml-2 text-xs font-normal text-zinc-400">
                        (kamu)
                      </span>
                    )}
                  </p>
                  {name && user.email && (
                    <p className="truncate text-xs text-zinc-400">
                      {user.email}
                    </p>
                  )}
                </div>

                {isSuperAdmin ? (
                  <>
                    <button
                      onClick={() => handleSetPassword(user)}
                      disabled={rowBusyId === user.id}
                      className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 px-2.5 py-1.5 text-xs font-medium text-zinc-600 transition-colors hover:bg-zinc-50 disabled:opacity-50"
                    >
                      <KeyRound size={12} /> Set password
                    </button>

                    <select
                      value={user.role}
                      disabled={isSelf || rowBusyId === user.id}
                      onChange={(e) => handleRoleChange(user, e.target.value)}
                      title={
                        isSelf ? "Nggak bisa ganti role sendiri" : undefined
                      }
                      className="rounded-lg border border-zinc-300 px-2 py-1 text-xs text-zinc-700 outline-none focus:border-brand-500 disabled:bg-zinc-100 disabled:text-zinc-400"
                    >
                      <option value="student">student</option>
                      <option value="admin">admin</option>
                      <option value="super_admin">super admin</option>
                    </select>

                    {!isSelf && (
                      <button
                        onClick={() => handleDelete(user)}
                        disabled={rowBusyId === user.id}
                        aria-label={`Hapus ${user.email ?? name}`}
                        className="inline-flex items-center gap-1 rounded-lg border border-rose-200 px-2.5 py-1.5 text-xs font-medium text-rose-600 transition-colors hover:bg-rose-50 disabled:opacity-50"
                      >
                        <Trash2 size={12} /> Hapus
                      </button>
                    )}
                  </>
                ) : (
                  <span className="rounded-lg border border-zinc-200 px-2.5 py-1 text-xs font-medium text-zinc-500">
                    {roleLabels[user.role] ?? user.role}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
