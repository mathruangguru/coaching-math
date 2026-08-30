import { useEffect, useState } from "react";
import { Plus, Trash2, Users } from "lucide-react";
import {
  getBranches,
  createBranch,
  updateBranch,
  deleteBranch,
  parseBranchesInput,
  createBranchesBulk,
} from "../../lib/branches";
import Skeleton from "../../components/ui/Skeleton";

const inputCls =
  "w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 outline-none transition-colors focus:border-brand-500";

export default function AdminBranchesPage() {
  const [branches, setBranches] = useState([]);
  const [status, setStatus] = useState("loading"); // loading | error | ready
  const [newName, setNewName] = useState("");
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkText, setBulkText] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null); // { ok, text }
  const [rowBusyId, setRowBusyId] = useState(null);

  const fetchBranches = () =>
    getBranches()
      .then((d) => {
        setBranches(d);
        setStatus("ready");
      })
      .catch((err) => {
        console.error("[admin] gagal memuat cabang:", err);
        setStatus("error");
      });

  useEffect(() => {
    let alive = true;
    getBranches()
      .then((d) => {
        if (!alive) return;
        setBranches(d);
        setStatus("ready");
      })
      .catch((err) => {
        if (!alive) return;
        console.error("[admin] gagal memuat cabang:", err);
        setStatus("error");
      });
    return () => {
      alive = false;
    };
  }, []);

  const addOne = async (e) => {
    e.preventDefault();
    const name = newName.trim();
    if (!name) return;
    setBusy(true);
    setMsg(null);
    try {
      await createBranch(name);
      setNewName("");
      await fetchBranches();
    } catch (err) {
      setMsg({ ok: false, text: err?.message ?? "Gagal menambah." });
    } finally {
      setBusy(false);
    }
  };

  const addBulk = async () => {
    const { items } = parseBranchesInput(bulkText);
    if (!items.length) {
      setMsg({ ok: false, text: "Nggak ada nama yang valid." });
      return;
    }
    const existing = new Set(branches.map((b) => b.name.toLowerCase()));
    const fresh = items.filter((n) => !existing.has(n.toLowerCase()));
    const skipped = items.length - fresh.length;

    setBusy(true);
    setMsg(null);
    try {
      const added = fresh.length ? await createBranchesBulk(fresh) : [];
      setBulkText("");
      setBulkOpen(false);
      await fetchBranches();
      setMsg({
        ok: true,
        text:
          `${added.length} cabang ditambah` +
          (skipped ? ` · ${skipped} dilewati (sudah ada)` : ""),
      });
    } catch (err) {
      setMsg({ ok: false, text: err?.message ?? "Gagal menambah." });
    } finally {
      setBusy(false);
    }
  };

  const rename = async (b, name) => {
    const clean = name.trim();
    if (!clean || clean === b.name) {
      if (!clean) setBranches((p) => [...p]); // paksa re-render balik ke nilai lama
      return;
    }
    setRowBusyId(b.id);
    try {
      await updateBranch(b.id, clean);
      setBranches((p) =>
        p
          .map((x) => (x.id === b.id ? { ...x, name: clean } : x))
          .sort((a, c) => a.name.localeCompare(c.name))
      );
    } catch (err) {
      window.alert(err?.message ?? "Gagal mengubah nama.");
      fetchBranches();
    } finally {
      setRowBusyId(null);
    }
  };

  const remove = async (b) => {
    if (!window.confirm(`Hapus cabang "${b.name}"?`)) return;
    setRowBusyId(b.id);
    try {
      await deleteBranch(b.id);
      setBranches((p) => p.filter((x) => x.id !== b.id));
    } catch (err) {
      window.alert(err?.message ?? "Gagal menghapus.");
    } finally {
      setRowBusyId(null);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-zinc-900">Cabang</h1>
        <p className="mt-1 text-xs text-zinc-400">
          Daftar cabang buat dropdown di halaman Profil murid.
        </p>
      </div>

      {/* Tambah */}
      <div className="flex flex-col gap-3 rounded-2xl border border-zinc-200 bg-white p-5">
        <form onSubmit={addOne} className="flex flex-wrap items-end gap-2">
          <label className="flex-1 text-xs font-medium text-zinc-600">
            Nama cabang
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="mis. Jakarta Pusat"
              className={`mt-1 ${inputCls}`}
            />
          </label>
          <button
            type="submit"
            disabled={busy}
            className="inline-flex items-center gap-1.5 rounded-lg bg-brand-500 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-brand-600 disabled:opacity-50"
          >
            <Plus size={14} /> Tambah
          </button>
          <button
            type="button"
            onClick={() => setBulkOpen((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 px-2.5 py-2 text-xs font-medium text-zinc-600 transition-colors hover:bg-zinc-50"
          >
            <Users size={13} /> Tambah banyak
          </button>
        </form>

        {bulkOpen && (
          <div className="rounded-lg border border-zinc-200 bg-zinc-50/60 p-3">
            <p className="text-xs text-zinc-500">
              Satu cabang per baris. Yang dobel (di input maupun sama yang
              sudah ada) diabaikan.
            </p>
            <textarea
              value={bulkText}
              onChange={(e) => setBulkText(e.target.value)}
              rows={6}
              spellCheck={false}
              placeholder={"Jakarta Pusat\nBandung\nSurabaya"}
              className="mt-2 w-full rounded-lg border border-zinc-300 px-3 py-2 text-xs text-zinc-900 outline-none focus:border-brand-500"
            />
            <button
              type="button"
              onClick={addBulk}
              disabled={busy}
              className="mt-2 rounded-lg bg-brand-500 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-brand-600 disabled:opacity-50"
            >
              {busy ? "Menambah…" : "Tambah semua"}
            </button>
          </div>
        )}

        {msg && (
          <p
            className={`text-xs ${msg.ok ? "text-emerald-600" : "text-rose-600"}`}
          >
            {msg.text}
          </p>
        )}
      </div>

      {/* Daftar */}
      {status === "loading" && (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full rounded-xl" />
          ))}
        </div>
      )}

      {status === "error" && (
        <p className="rounded-xl border border-dashed border-rose-300 bg-white px-6 py-8 text-center text-sm text-rose-500">
          Gagal memuat daftar cabang.
        </p>
      )}

      {status === "ready" && branches.length === 0 && (
        <p className="rounded-xl border border-dashed border-zinc-300 bg-white px-6 py-10 text-center text-sm text-zinc-400">
          Belum ada cabang.
        </p>
      )}

      {status === "ready" && branches.length > 0 && (
        <ul className="flex flex-col gap-2">
          {branches.map((b) => (
            <li
              key={b.id}
              className="flex items-center gap-3 rounded-xl border border-zinc-200 bg-white px-4 py-2.5"
            >
              <input
                defaultValue={b.name}
                onBlur={(e) => rename(b, e.target.value)}
                onKeyDown={(e) =>
                  e.key === "Enter" && e.currentTarget.blur()
                }
                disabled={rowBusyId === b.id}
                className="min-w-0 flex-1 rounded-md border border-transparent px-2 py-1 text-sm text-zinc-800 outline-none transition-colors hover:border-zinc-200 focus:border-brand-500"
              />
              <button
                type="button"
                onClick={() => remove(b)}
                disabled={rowBusyId === b.id}
                aria-label={`Hapus ${b.name}`}
                className="inline-flex items-center gap-1 rounded-lg border border-rose-200 px-2.5 py-1.5 text-xs font-medium text-rose-600 transition-colors hover:bg-rose-50 disabled:opacity-50"
              >
                <Trash2 size={12} /> Hapus
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
