import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Plus, Pencil, Trash2, BarChart3, ClipboardList } from "lucide-react";
import { getForms, createForm, deleteForm } from "../../lib/forms";
import Skeleton from "../../components/ui/Skeleton";

export default function AdminFormsPage() {
  const navigate = useNavigate();
  const [forms, setForms] = useState([]);
  const [status, setStatus] = useState("loading");
  const [busy, setBusy] = useState(false);
  const [busyId, setBusyId] = useState(null);

  useEffect(() => {
    let alive = true;
    getForms()
      .then((d) => {
        if (!alive) return;
        setForms(d);
        setStatus("ready");
      })
      .catch((err) => {
        if (!alive) return;
        console.error("[admin] gagal memuat form:", err);
        setStatus("error");
      });
    return () => {
      alive = false;
    };
  }, []);

  const handleCreate = async () => {
    setBusy(true);
    try {
      const row = await createForm({ title: "Form baru" });
      navigate(`/admin/forms/${row.id}`);
    } catch (err) {
      window.alert(`Gagal: ${err?.message ?? err}`);
      setBusy(false);
    }
  };

  const handleDelete = async (form) => {
    if (!window.confirm(`Hapus form "${form.title}" beserta field & responsnya?`))
      return;
    setBusyId(form.id);
    try {
      await deleteForm(form.id);
      setForms((p) => p.filter((f) => f.id !== form.id));
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
            Form
          </h1>
          <p className="mt-1 text-xs text-zinc-400">
            Form/survei yang bisa dipasang ke lesson tipe Form.
          </p>
        </div>
        <button
          onClick={handleCreate}
          disabled={busy}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-brand-500 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-brand-600 disabled:opacity-50"
        >
          <Plus size={14} /> Form baru
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
          Gagal memuat form.
        </p>
      )}

      {status === "ready" && forms.length === 0 && (
        <p className="rounded-xl border border-dashed border-zinc-300 bg-white px-6 py-10 text-center text-sm text-zinc-400">
          Belum ada form. Klik “Form baru”.
        </p>
      )}

      {status === "ready" && forms.length > 0 && (
        <ul className="flex flex-col gap-2">
          {forms.map((form) => (
            <li
              key={form.id}
              className="flex items-center gap-3 rounded-xl border border-zinc-200 bg-white px-4 py-3"
            >
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-violet-50 text-violet-600">
                <ClipboardList size={17} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2 truncate text-sm font-semibold text-zinc-900">
                  {form.title}
                  {form.open === false && (
                    <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] font-semibold text-zinc-500">
                      Ditutup
                    </span>
                  )}
                </p>
                {form.description && (
                  <p className="truncate text-xs text-zinc-400">
                    {form.description}
                  </p>
                )}
              </div>
              <Link
                to={`/admin/forms/${form.id}/responses`}
                className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 px-2.5 py-1.5 text-xs font-medium text-zinc-600 transition-colors hover:bg-zinc-50"
              >
                <BarChart3 size={12} /> Respons
              </Link>
              <Link
                to={`/admin/forms/${form.id}`}
                className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 px-2.5 py-1.5 text-xs font-medium text-zinc-600 transition-colors hover:bg-zinc-50"
              >
                <Pencil size={12} /> Edit
              </Link>
              <button
                onClick={() => handleDelete(form)}
                disabled={busyId === form.id}
                className="inline-flex items-center gap-1 rounded-lg border border-rose-200 px-2.5 py-1.5 text-xs font-medium text-rose-600 transition-colors hover:bg-rose-50 disabled:opacity-50"
              >
                <Trash2 size={12} /> {busyId === form.id ? "…" : "Hapus"}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
