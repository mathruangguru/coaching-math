import { useEffect, useState } from "react";
import { UserPlus, KeyRound } from "lucide-react";
import {
  getUsers,
  createUser,
  setUserRole,
  setUserPassword,
} from "../../lib/users";
import { useAuth } from "../../context/auth-context";
import Skeleton from "../../components/ui/Skeleton";

const inputCls =
  "w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 outline-none transition-colors focus:border-brand-500";

const emptyForm = {
  firstName: "",
  lastName: "",
  email: "",
  password: "",
  role: "student",
};

function fullName(u) {
  return [u.first_name, u.last_name].filter(Boolean).join(" ");
}

export default function AdminUsersPage() {
  const { session } = useAuth();
  const myId = session?.user?.id ?? null;

  const [users, setUsers] = useState([]);
  const [status, setStatus] = useState("loading"); // loading | error | ready

  const [form, setForm] = useState(emptyForm);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState("");
  const [formOk, setFormOk] = useState("");
  const [rowBusyId, setRowBusyId] = useState(null);

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
      await createUser(form);
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

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-zinc-900">
          Pengguna
        </h1>
        <p className="mt-1 text-xs text-zinc-400">
          Buat akun murid / admin dan atur perannya.
        </p>
      </div>

      {/* Tambah user */}
      <form
        onSubmit={handleCreate}
        className="flex flex-col gap-3 rounded-2xl border border-zinc-200 bg-white p-5"
      >
        <p className="text-xs font-semibold text-zinc-700">Tambah user</p>

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
              value={form.role}
              onChange={(e) => set("role", e.target.value)}
              className={`mt-1 ${inputCls}`}
            >
              <option value="student">student</option>
              <option value="admin">admin</option>
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
                  title={isSelf ? "Nggak bisa ganti role sendiri" : undefined}
                  className="rounded-lg border border-zinc-300 px-2 py-1 text-xs text-zinc-700 outline-none focus:border-brand-500 disabled:bg-zinc-100 disabled:text-zinc-400"
                >
                  <option value="student">student</option>
                  <option value="admin">admin</option>
                </select>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
