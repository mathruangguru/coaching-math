import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Plus,
  Trash2,
  ChevronUp,
  ChevronDown,
  BarChart3,
} from "lucide-react";
import {
  getForm,
  updateForm,
  createField,
  updateField,
  deleteField,
  reorderFields,
  fieldTypeLabels,
  FIELD_TYPES,
  OPTION_TYPES,
} from "../../lib/forms";

const autoLabel = { name: "Nama", email: "Email" };
import Skeleton from "../../components/ui/Skeleton";

const input =
  "w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 outline-none transition-colors focus:border-brand-500";

function move(arr, from, to) {
  const n = arr.slice();
  const [x] = n.splice(from, 1);
  n.splice(to, 0, x);
  return n;
}

export default function AdminFormFormPage() {
  const { formId } = useParams();
  const [form, setForm] = useState(null);
  const [status, setStatus] = useState("loading");
  const [saving, setSaving] = useState(false);

  const load = () =>
    getForm(formId)
      .then((d) => {
        setForm(d);
        setStatus(d ? "ready" : "not-found");
      })
      .catch((err) => {
        console.error("[admin] gagal memuat form:", err);
        setStatus("error");
      });

  useEffect(() => {
    let alive = true;
    getForm(formId)
      .then((d) => {
        if (!alive) return;
        setForm(d);
        setStatus(d ? "ready" : "not-found");
      })
      .catch((err) => {
        if (!alive) return;
        console.error("[admin] gagal memuat form:", err);
        setStatus("error");
      });
    return () => {
      alive = false;
    };
  }, [formId]);

  const run = async (fn) => {
    setSaving(true);
    try {
      await fn();
    } catch (err) {
      window.alert(`Gagal menyimpan: ${err?.message ?? err}`);
      load();
    } finally {
      setSaving(false);
    }
  };

  const patchField = (id, patch) =>
    setForm((s) => ({
      ...s,
      fields: s.fields.map((f) => (f.id === id ? { ...f, ...patch } : f)),
    }));

  const saveMeta = () =>
    run(() =>
      updateForm(form.id, { title: form.title, description: form.description })
    );

  const saveField = (f) =>
    run(() =>
      updateField(f.id, {
        type: f.type,
        label: f.label.trim() || "Pertanyaan",
        options: f.options ?? [],
        required: f.required,
      })
    );

  const addField = () =>
    run(async () => {
      const row = await createField(form.id, {
        type: "short",
        label: "",
        options: [],
        required: false,
        position: form.fields.length,
      });
      setForm((s) => ({ ...s, fields: [...s.fields, row] }));
    });

  const removeField = (f) => {
    if (!window.confirm("Hapus field ini?")) return;
    run(async () => {
      await deleteField(f.id);
      setForm((s) => ({ ...s, fields: s.fields.filter((x) => x.id !== f.id) }));
    });
  };

  const moveField = (idx, dir) => {
    const to = idx + dir;
    if (to < 0 || to >= form.fields.length) return;
    const next = move(form.fields, idx, to);
    setForm((s) => ({ ...s, fields: next }));
    run(() => reorderFields(next.map((f) => f.id)));
  };

  if (status === "loading")
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-24 w-full rounded-2xl" />
        <Skeleton className="h-40 w-full rounded-2xl" />
      </div>
    );
  if (status !== "ready")
    return (
      <p className="text-sm text-zinc-500">
        {status === "not-found" ? "Form tidak ditemukan. " : "Gagal memuat. "}
        <Link to="/admin/forms" className="font-semibold text-brand-600">
          Kembali
        </Link>
      </p>
    );

  const hasOptions = (t) => OPTION_TYPES.includes(t);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between gap-3">
        <Link
          to="/admin/forms"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-500 transition-colors hover:text-zinc-800"
        >
          <ArrowLeft size={14} /> Semua form
        </Link>
        <div className="flex items-center gap-3 text-xs text-zinc-400">
          {saving && <span>menyimpan…</span>}
          <Link
            to={`/admin/forms/${form.id}/responses`}
            className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 px-2.5 py-1.5 font-medium text-zinc-600 transition-colors hover:bg-zinc-50"
          >
            <BarChart3 size={12} /> Respons
          </Link>
        </div>
      </div>

      {/* Metadata */}
      <div className="rounded-2xl border border-zinc-200/80 bg-white p-5">
        <label className="block text-[11px] font-semibold uppercase tracking-[0.06em] text-zinc-400">
          Judul
          <input
            value={form.title}
            onChange={(e) => setForm((s) => ({ ...s, title: e.target.value }))}
            onBlur={saveMeta}
            className={`mt-1.5 ${input} font-semibold`}
          />
        </label>
        <label className="mt-3 block text-[11px] font-semibold uppercase tracking-[0.06em] text-zinc-400">
          Deskripsi
          <textarea
            rows={2}
            value={form.description ?? ""}
            onChange={(e) =>
              setForm((s) => ({ ...s, description: e.target.value }))
            }
            onBlur={saveMeta}
            className={`mt-1.5 ${input} resize-y`}
          />
        </label>
      </div>

      {/* Fields */}
      <div className="flex flex-col gap-3">
        {form.fields.length === 0 && (
          <p className="rounded-2xl border border-dashed border-zinc-300 bg-white px-6 py-8 text-center text-sm text-zinc-400">
            Belum ada field.
          </p>
        )}

        {form.fields.map((f, fi) => (
          <div
            key={f.id}
            className="rounded-2xl border border-zinc-200/80 bg-white p-4"
          >
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex shrink-0 flex-col">
                <button
                  type="button"
                  disabled={fi === 0}
                  onClick={() => moveField(fi, -1)}
                  className="grid h-4 w-5 place-items-center rounded text-zinc-300 hover:bg-zinc-100 hover:text-zinc-600 disabled:opacity-0"
                >
                  <ChevronUp size={13} />
                </button>
                <button
                  type="button"
                  disabled={fi === form.fields.length - 1}
                  onClick={() => moveField(fi, 1)}
                  className="grid h-4 w-5 place-items-center rounded text-zinc-300 hover:bg-zinc-100 hover:text-zinc-600 disabled:opacity-0"
                >
                  <ChevronDown size={13} />
                </button>
              </div>

              <input
                value={f.label}
                onChange={(e) => patchField(f.id, { label: e.target.value })}
                onBlur={() => saveField(f)}
                placeholder="Pertanyaan…"
                className={`${input} min-w-0 flex-1 py-1.5 font-medium`}
              />

              <select
                value={f.type}
                onChange={(e) => {
                  const type = e.target.value;
                  const next = {
                    type,
                    options: hasOptions(type)
                      ? f.options?.length
                        ? f.options
                        : ["", ""]
                      : [],
                  };
                  if (autoLabel[type] && !f.label.trim())
                    next.label = autoLabel[type];
                  patchField(f.id, next);
                  saveField({ ...f, ...next });
                }}
                className="shrink-0 rounded-md border border-zinc-200 bg-white px-1.5 py-1.5 text-xs text-zinc-600 outline-none focus:border-brand-500"
              >
                {FIELD_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {fieldTypeLabels[t]}
                  </option>
                ))}
              </select>

              <label className="flex shrink-0 items-center gap-1.5 text-xs text-zinc-500">
                <input
                  type="checkbox"
                  checked={f.required}
                  onChange={(e) => {
                    patchField(f.id, { required: e.target.checked });
                    saveField({ ...f, required: e.target.checked });
                  }}
                />
                Wajib
              </label>

              <button
                type="button"
                onClick={() => removeField(f)}
                aria-label="Hapus field"
                className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-zinc-300 transition-colors hover:bg-rose-50 hover:text-rose-500"
              >
                <Trash2 size={13} />
              </button>
            </div>

            {(f.type === "name" || f.type === "email") && (
              <p className="mt-1.5 pl-7 text-xs text-zinc-400">
                Diisi otomatis dari akun murid (masih bisa diedit murid).
              </p>
            )}

            {hasOptions(f.type) && (
              <div className="mt-2 flex flex-col gap-1.5 pl-7">
                {(f.options ?? []).map((opt, oi) => (
                  <div key={oi} className="flex items-center gap-2">
                    <span className="text-xs text-zinc-400">
                      {f.type === "check" ? "•" : `${String.fromCharCode(65 + oi)}.`}
                    </span>
                    <input
                      value={opt}
                      onChange={(e) => {
                        const options = f.options.slice();
                        options[oi] = e.target.value;
                        patchField(f.id, { options });
                      }}
                      onBlur={() => saveField(f)}
                      placeholder={
                        f.type === "check"
                          ? `Pernyataan ${oi + 1}`
                          : `Opsi ${oi + 1}`
                      }
                      className={`${input} py-1 text-xs`}
                    />
                    <button
                      type="button"
                      disabled={(f.options ?? []).length <= 2}
                      onClick={() => {
                        const options = f.options.filter((_, i) => i !== oi);
                        patchField(f.id, { options });
                        saveField({ ...f, options });
                      }}
                      className="grid h-6 w-6 shrink-0 place-items-center rounded text-zinc-300 hover:text-rose-500 disabled:opacity-25"
                    >
                      <Trash2 size={11} />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => {
                    const options = [...(f.options ?? []), ""];
                    patchField(f.id, { options });
                    saveField({ ...f, options });
                  }}
                  className="inline-flex w-fit items-center gap-1 text-xs font-semibold text-brand-600 hover:text-brand-700"
                >
                  <Plus size={11} />{" "}
                  {f.type === "check" ? "Tambah pernyataan" : "Tambah opsi"}
                </button>
              </div>
            )}
          </div>
        ))}

        <button
          type="button"
          onClick={addField}
          className="flex items-center justify-center gap-1.5 rounded-2xl border-2 border-dashed border-zinc-200 py-3 text-xs font-semibold text-zinc-500 transition-colors hover:border-brand-300 hover:bg-brand-50/30 hover:text-brand-600"
        >
          <Plus size={14} /> Tambah field
        </button>
      </div>
    </div>
  );
}
