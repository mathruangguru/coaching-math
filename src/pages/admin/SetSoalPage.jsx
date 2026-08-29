import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Plus, Pencil, Trash2, ListChecks } from "lucide-react";
import {
  getQuestionSets,
  createQuestionSet,
  deleteQuestionSet,
} from "../../lib/quiz";
import Skeleton from "../../components/ui/Skeleton";

export default function SetSoalPage() {
  const navigate = useNavigate();
  const [sets, setSets] = useState([]);
  const [status, setStatus] = useState("loading"); // loading | error | ready
  const [busy, setBusy] = useState(false);
  const [busyId, setBusyId] = useState(null);

  useEffect(() => {
    let alive = true;
    getQuestionSets()
      .then((data) => {
        if (!alive) return;
        setSets(data);
        setStatus("ready");
      })
      .catch((err) => {
        if (!alive) return;
        console.error("[admin] gagal memuat set soal:", err);
        setStatus("error");
      });
    return () => {
      alive = false;
    };
  }, []);

  const handleCreate = async () => {
    setBusy(true);
    try {
      const row = await createQuestionSet({ title: "Set soal baru" });
      navigate(`/admin/set-soal/${row.id}`);
    } catch (err) {
      window.alert(`Gagal: ${err?.message ?? err}`);
      setBusy(false);
    }
  };

  const handleDelete = async (set) => {
    if (
      !window.confirm(`Hapus set "${set.title}" beserta semua soalnya?`)
    )
      return;
    setBusyId(set.id);
    try {
      await deleteQuestionSet(set.id);
      setSets((p) => p.filter((s) => s.id !== set.id));
    } catch (err) {
      window.alert(`Gagal menghapus: ${err?.message ?? err}`);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-zinc-900">
            Set Soal
          </h1>
          <p className="mt-1 text-xs text-zinc-400">
            Kumpulan soal pilihan ganda yang bisa dipasang ke lesson tipe Soal.
          </p>
        </div>
        <button
          onClick={handleCreate}
          disabled={busy}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-brand-500 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-brand-600 disabled:opacity-50"
        >
          <Plus size={14} /> Set baru
        </button>
      </div>

      {status === "loading" && (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-[60px] w-full rounded-xl" />
          ))}
        </div>
      )}

      {status === "error" && (
        <p className="rounded-xl border border-dashed border-rose-300 bg-white px-6 py-10 text-center text-sm text-rose-500">
          Gagal memuat set soal.
        </p>
      )}

      {status === "ready" && sets.length === 0 && (
        <p className="rounded-xl border border-dashed border-zinc-300 bg-white px-6 py-10 text-center text-sm text-zinc-400">
          Belum ada set soal. Klik “Set baru”.
        </p>
      )}

      {status === "ready" && sets.length > 0 && (
        <ul className="flex flex-col gap-2">
          {sets.map((set) => (
            <li
              key={set.id}
              className="flex items-center gap-3 rounded-xl border border-zinc-200 bg-white px-4 py-3"
            >
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-amber-50 text-amber-600">
                <ListChecks size={17} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-zinc-900">
                  {set.title}
                </p>
                {set.description && (
                  <p className="truncate text-xs text-zinc-400">
                    {set.description}
                  </p>
                )}
              </div>
              <Link
                to={`/admin/set-soal/${set.id}`}
                className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 px-2.5 py-1.5 text-xs font-medium text-zinc-600 transition-colors hover:bg-zinc-50"
              >
                <Pencil size={12} /> Edit
              </Link>
              <button
                onClick={() => handleDelete(set)}
                disabled={busyId === set.id}
                className="inline-flex items-center gap-1 rounded-lg border border-rose-200 px-2.5 py-1.5 text-xs font-medium text-rose-600 transition-colors hover:bg-rose-50 disabled:opacity-50"
              >
                <Trash2 size={12} /> {busyId === set.id ? "…" : "Hapus"}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
