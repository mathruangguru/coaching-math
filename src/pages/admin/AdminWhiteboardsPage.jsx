import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Plus, Pencil, Trash2, Users } from "lucide-react";
import {
  getWhiteboards,
  createWhiteboard,
  updateWhiteboard,
  deleteWhiteboard,
} from "../../lib/whiteboards";
import Skeleton from "../../components/ui/Skeleton";

const fmtAgo = (iso) => {
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return "baru aja";
  if (m < 60) return `${m} mnt lalu`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} jam lalu`;
  return `${Math.round(h / 24)} hari lalu`;
};

export default function AdminWhiteboardsPage() {
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [status, setStatus] = useState("loading");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    getWhiteboards()
      .then((d) => {
        if (!alive) return;
        setRows(d);
        setStatus("ready");
      })
      .catch((err) => {
        if (!alive) return;
        console.error("[admin] gagal memuat whiteboard:", err);
        setStatus("error");
      });
    return () => {
      alive = false;
    };
  }, []);

  const handleCreate = async () => {
    setBusy(true);
    try {
      const row = await createWhiteboard("Papan baru");
      navigate(`/admin/utilitas/whiteboard/${row.id}`);
    } catch (err) {
      window.alert(`Gagal: ${err?.message ?? err}`);
      setBusy(false);
    }
  };

  const rename = async (row) => {
    const title = window.prompt("Nama papan:", row.title);
    if (title == null) return;
    const t = title.trim() || "Papan baru";
    setRows((p) => p.map((r) => (r.id === row.id ? { ...r, title: t } : r)));
    updateWhiteboard(row.id, { title: t }).catch((err) =>
      window.alert(`Gagal: ${err?.message ?? err}`),
    );
  };

  const remove = async (row) => {
    if (!window.confirm(`Hapus papan "${row.title}"?`)) return;
    try {
      await deleteWhiteboard(row.id);
      setRows((p) => p.filter((r) => r.id !== row.id));
    } catch (err) {
      window.alert(`Gagal: ${err?.message ?? err}`);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <div>
        <Link
          to="/admin/utilitas"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-400 transition-colors hover:text-zinc-700"
        >
          <ArrowLeft size={13} /> Utilitas
        </Link>
        <div className="mt-2 flex items-center justify-between gap-3">
          <h1 className="text-xl font-bold tracking-tight text-zinc-900">
            Whiteboard
          </h1>
          <button
            type="button"
            onClick={handleCreate}
            disabled={busy}
            className="inline-flex items-center gap-1.5 rounded-lg bg-brand-500 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-600 disabled:opacity-50"
          >
            <Plus size={15} /> Papan baru
          </button>
        </div>
        <p className="mt-1 text-xs text-zinc-400">
          Papan corat-coret yang kesimpan. Yang di-share bisa dilihat murid
          (read-only).
        </p>
      </div>

      {status === "loading" && (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full rounded-xl" />
          ))}
        </div>
      )}
      {status === "error" && (
        <p className="text-sm text-rose-500">Gagal memuat whiteboard.</p>
      )}
      {status === "ready" && rows.length === 0 && (
        <p className="rounded-2xl border border-dashed border-zinc-200 bg-white px-6 py-12 text-center text-sm text-zinc-400">
          Belum ada papan. Klik “Papan baru”.
        </p>
      )}

      {status === "ready" && rows.length > 0 && (
        <ul className="flex flex-col gap-2">
          {rows.map((r) => (
            <li
              key={r.id}
              className="flex items-center gap-3 rounded-xl border border-zinc-200 bg-white px-4 py-3"
            >
              <Link
                to={`/admin/utilitas/whiteboard/${r.id}`}
                className="min-w-0 flex-1"
              >
                <p className="truncate text-sm font-semibold text-zinc-900">
                  {r.title}
                </p>
                <p className="mt-0.5 flex items-center gap-1.5 text-[11px] text-zinc-400">
                  {fmtAgo(r.updated_at)}
                  {r.shared && (
                    <span className="inline-flex items-center gap-0.5 rounded bg-teal-50 px-1 py-px font-semibold text-teal-600">
                      <Users size={9} /> dishare
                    </span>
                  )}
                </p>
              </Link>
              <button
                type="button"
                onClick={() => rename(r)}
                aria-label="Ganti nama"
                className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700"
              >
                <Pencil size={14} />
              </button>
              <button
                type="button"
                onClick={() => remove(r)}
                aria-label="Hapus"
                className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-zinc-400 transition-colors hover:bg-rose-50 hover:text-rose-500"
              >
                <Trash2 size={14} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
