import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Plus,
  Trash2,
  ChevronUp,
  ChevronDown,
  Check,
  Pencil,
  X,
  FileJson,
} from "lucide-react";
import {
  getQuestionSetAdmin,
  updateQuestionSet,
  createQuestion,
  updateQuestion,
  deleteQuestion,
  reorderQuestions,
  parseQuestionsJson,
  bulkCreateQuestions,
} from "../../lib/quiz";
import Skeleton from "../../components/ui/Skeleton";
import MathText from "../../components/ui/MathText";

const input =
  "w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 outline-none transition-colors focus:border-brand-500";

function move(arr, from, to) {
  const n = arr.slice();
  const [x] = n.splice(from, 1);
  n.splice(to, 0, x);
  return n;
}

function Modal({ title, onClose, children }) {
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-zinc-900/40 p-4 sm:p-8"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl rounded-2xl border border-zinc-200 bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 border-b border-zinc-100 px-5 py-3.5">
          <h3 className="truncate text-sm font-bold text-zinc-900">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup"
            className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700"
          >
            <X size={16} />
          </button>
        </div>
        <div className="max-h-[70vh] overflow-y-auto p-5">{children}</div>
        <div className="flex justify-end border-t border-zinc-100 px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-zinc-700"
          >
            Selesai
          </button>
        </div>
      </div>
    </div>
  );
}

export default function SetSoalFormPage() {
  const { setId } = useParams();
  const [set, setSet] = useState(null);
  const [status, setStatus] = useState("loading");
  const [saving, setSaving] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [importOpen, setImportOpen] = useState(false);

  const closeModal = useCallback(() => setEditingId(null), []);
  const closeImport = useCallback(() => setImportOpen(false), []);

  const load = () => {
    setStatus("loading");
    getQuestionSetAdmin(setId)
      .then((data) => {
        if (!data) return setStatus("not-found");
        setSet(data);
        setSelectedId((cur) => cur ?? data.questions[0]?.id ?? null);
        setStatus("ready");
      })
      .catch((err) => {
        console.error("[admin] gagal memuat set soal:", err);
        setStatus("error");
      });
  };

  useEffect(() => {
    let alive = true;
    getQuestionSetAdmin(setId)
      .then((data) => {
        if (!alive) return;
        if (!data) return setStatus("not-found");
        setSet(data);
        setSelectedId(data.questions[0]?.id ?? null);
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
  }, [setId]);

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

  const patchSet = (patch) => setSet((s) => ({ ...s, ...patch }));
  const patchQ = (qid, patch) =>
    setSet((s) => ({
      ...s,
      questions: s.questions.map((q) =>
        q.id === qid ? { ...q, ...patch } : q
      ),
    }));

  const saveMeta = () =>
    run(() =>
      updateQuestionSet(set.id, {
        title: set.title,
        description: set.description,
        timeLimitMin: set.time_limit_min,
        intro: set.intro,
      })
    );

  const saveQ = (q) =>
    run(() =>
      updateQuestion(q.id, {
        prompt: q.prompt.trim() || "Soal tanpa teks",
        options: q.options,
        type: q.type ?? "single",
        answers: q.answers ?? [q.answer ?? 0],
      })
    );

  const addQuestion = () =>
    run(async () => {
      const row = await createQuestion(set.id, {
        prompt: "",
        options: ["", ""],
        type: "single",
        answers: [0],
        position: set.questions.length,
      });
      setSet((s) => ({ ...s, questions: [...s.questions, row] }));
      setSelectedId(row.id);
      setEditingId(row.id);
    });

  const importJson = (items) =>
    run(async () => {
      const rows = await bulkCreateQuestions(
        set.id,
        items,
        set.questions.length
      );
      setSet((s) => ({ ...s, questions: [...s.questions, ...rows] }));
      if (rows[0]) setSelectedId(rows[0].id);
      setImportOpen(false);
    });

  const removeQuestion = (q, idx) => {
    if (!window.confirm(`Hapus soal ${idx + 1} (${q.code})?`)) return;
    run(async () => {
      await deleteQuestion(q.id);
      setSet((s) => {
        const questions = s.questions.filter((x) => x.id !== q.id);
        setSelectedId((cur) =>
          cur === q.id ? (questions[0]?.id ?? null) : cur
        );
        return { ...s, questions };
      });
      setEditingId((id) => (id === q.id ? null : id));
    });
  };

  const moveQuestion = (idx, dir) => {
    const to = idx + dir;
    if (to < 0 || to >= set.questions.length) return;
    const next = move(set.questions, idx, to);
    setSet((s) => ({ ...s, questions: next }));
    run(() => reorderQuestions(next.map((q) => q.id)));
  };

  if (status === "loading")
    return <Skeleton className="h-96 w-full max-w-4xl rounded-2xl" />;
  if (status === "error") return <BackNote text="Gagal memuat set soal." />;
  if (status === "not-found")
    return <BackNote text="Set soal tidak ditemukan." />;

  const selected = set.questions.find((q) => q.id === selectedId) ?? null;
  const editing = set.questions.find((q) => q.id === editingId) ?? null;

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-5">
      <div className="flex items-center justify-between gap-3">
        <Link
          to="/admin/set-soal"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-500 transition-colors hover:text-zinc-800"
        >
          <ArrowLeft size={14} /> Semua set soal
        </Link>
        <span className="text-xs text-zinc-400">
          {saving ? "menyimpan…" : `${set.questions.length} soal`}
        </span>
      </div>

      {/* Metadata */}
      <div className="flex flex-col gap-3 rounded-2xl border border-zinc-200/80 bg-white p-5">
        <label className="block text-[11px] font-semibold uppercase tracking-[0.06em] text-zinc-400">
          Judul set
          <input
            value={set.title}
            onChange={(e) => patchSet({ title: e.target.value })}
            onBlur={saveMeta}
            className={`mt-1.5 ${input} text-sm font-semibold normal-case tracking-normal`}
          />
        </label>
        <label className="block text-[11px] font-semibold uppercase tracking-[0.06em] text-zinc-400">
          Deskripsi
          <input
            value={set.description ?? ""}
            onChange={(e) => patchSet({ description: e.target.value })}
            onBlur={saveMeta}
            placeholder="opsional"
            className={`mt-1.5 ${input} normal-case tracking-normal`}
          />
        </label>
        <label className="block text-[11px] font-semibold uppercase tracking-[0.06em] text-zinc-400">
          Batas waktu (menit)
          <span className="ml-2 font-normal normal-case tracking-normal text-zinc-400">
            kosong = tanpa batas
          </span>
          <input
            type="number"
            min={1}
            value={set.time_limit_min ?? ""}
            onChange={(e) =>
              patchSet({
                time_limit_min:
                  e.target.value === "" ? null : Number(e.target.value),
              })
            }
            onBlur={saveMeta}
            placeholder="mis. 60"
            className={`mt-1.5 ${input} sm:w-40 normal-case tracking-normal`}
          />
        </label>
        <label className="block text-[11px] font-semibold uppercase tracking-[0.06em] text-zinc-400">
          Instruksi / rules
          <span className="ml-2 font-normal normal-case tracking-normal text-zinc-400">
            tampil di lobby sebelum murid klik Mulai
          </span>
          <textarea
            value={set.intro ?? ""}
            onChange={(e) => patchSet({ intro: e.target.value })}
            onBlur={saveMeta}
            rows={4}
            placeholder={"mis.\n- Kerjakan sendiri, tanpa kalkulator.\n- Sekali mulai, timer jalan dan nggak bisa diulang."}
            className={`mt-1.5 ${input} resize-y normal-case tracking-normal`}
          />
        </label>
      </div>

      {/* Master-detail */}
      <div className="grid gap-5 lg:grid-cols-[minmax(0,240px)_minmax(0,1fr)] lg:items-start">
        {/* List */}
        <div className="flex flex-col gap-1.5">
          {set.questions.map((q, qi) => {
            const active = q.id === selectedId;
            return (
              <div
                key={q.id}
                className={`flex items-center gap-1 rounded-lg border px-2 py-1.5 transition-colors ${
                  active
                    ? "border-brand-300 bg-brand-50"
                    : "border-zinc-200 bg-white hover:bg-zinc-50"
                }`}
              >
                <button
                  type="button"
                  onClick={() => setSelectedId(q.id)}
                  className="flex min-w-0 flex-1 items-center gap-2 text-left"
                >
                  <span className="grid h-6 w-6 shrink-0 place-items-center rounded-md bg-zinc-900 text-xs font-bold text-white">
                    {qi + 1}
                  </span>
                  <span className="truncate font-mono text-xs text-zinc-500">
                    {q.code}
                  </span>
                </button>
                <button
                  type="button"
                  className="grid h-6 w-5 place-items-center rounded text-zinc-300 hover:text-zinc-600 disabled:opacity-20"
                  disabled={qi === 0}
                  onClick={() => moveQuestion(qi, -1)}
                  aria-label="Naikkan"
                >
                  <ChevronUp size={13} />
                </button>
                <button
                  type="button"
                  className="grid h-6 w-5 place-items-center rounded text-zinc-300 hover:text-zinc-600 disabled:opacity-20"
                  disabled={qi === set.questions.length - 1}
                  onClick={() => moveQuestion(qi, 1)}
                  aria-label="Turunkan"
                >
                  <ChevronDown size={13} />
                </button>
                <button
                  type="button"
                  onClick={() => removeQuestion(q, qi)}
                  aria-label="Hapus"
                  className="grid h-6 w-6 shrink-0 place-items-center rounded text-zinc-300 transition-colors hover:bg-rose-50 hover:text-rose-500"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            );
          })}

          <div className="mt-1 flex gap-1.5">
            <button
              type="button"
              onClick={addQuestion}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border-2 border-dashed border-zinc-200 py-2 text-xs font-semibold text-zinc-500 transition-colors hover:border-brand-300 hover:bg-brand-50/30 hover:text-brand-600"
            >
              <Plus size={13} /> Tambah soal
            </button>
            <button
              type="button"
              onClick={() => setImportOpen(true)}
              title="Import banyak soal dari JSON"
              className="flex items-center justify-center gap-1.5 rounded-lg border-2 border-dashed border-zinc-200 px-3 py-2 text-xs font-semibold text-zinc-500 transition-colors hover:border-brand-300 hover:bg-brand-50/30 hover:text-brand-600"
            >
              <FileJson size={13} /> Import
            </button>
          </div>
        </div>

        {/* Preview */}
        <div className="rounded-2xl border border-zinc-200/80 bg-white p-5">
          {!selected ? (
            <p className="py-8 text-center text-sm text-zinc-400">
              Pilih soal di kiri.
            </p>
          ) : (
            <div className="flex flex-col gap-4">
              <div className="flex items-start justify-between gap-3">
                <p className="font-mono text-xs text-zinc-400">
                  {selected.code}
                  <span className="ml-2 rounded bg-zinc-100 px-1.5 py-0.5 font-sans font-semibold text-zinc-500">
                    {selected.type === "multi" ? "Checklist" : "Pilihan ganda"}
                  </span>
                </p>
                <button
                  type="button"
                  onClick={() => setEditingId(selected.id)}
                  className="inline-flex shrink-0 items-center gap-1 rounded-md border border-zinc-200 px-2.5 py-1.5 text-xs font-medium text-zinc-600 transition-colors hover:bg-zinc-50"
                >
                  <Pencil size={12} /> Edit soal
                </button>
              </div>

              <MathText className="text-sm text-zinc-900">
                {selected.prompt || "(soal masih kosong)"}
              </MathText>

              <ul className="flex flex-col gap-1.5">
                {selected.options.map((opt, oi) => {
                  const key = (selected.answers ?? [selected.answer]).includes(
                    oi
                  );
                  return (
                    <li
                      key={oi}
                      className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-sm ${
                        key ? "border-teal-300 bg-teal-50" : "border-zinc-200"
                      }`}
                    >
                      <span className="mt-0.5 shrink-0 font-semibold text-zinc-400">
                        {String.fromCharCode(65 + oi)}.
                      </span>
                      <MathText className="text-zinc-700">
                        {opt || "(kosong)"}
                      </MathText>
                      {key && (
                        <span className="ml-auto shrink-0 text-[11px] font-semibold text-teal-700">
                          kunci
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>
      </div>

      {importOpen && (
        <ImportModal onClose={closeImport} onImport={importJson} />
      )}

      {/* Edit modal */}
      {editing &&
        (() => {
          const eKeys = editing.answers ?? [editing.answer ?? 0];
          const eMulti = editing.type === "multi";
          const commit = (patch) => {
            patchQ(editing.id, patch);
            saveQ({ ...editing, ...patch });
          };
          const toggleKey = (oi) => {
            if (!eMulti) return commit({ answers: [oi] });
            const next = eKeys.includes(oi)
              ? eKeys.filter((x) => x !== oi)
              : [...eKeys, oi].sort((a, b) => a - b);
            commit({ answers: next.length ? next : eKeys });
          };
          return (
        <Modal title={`Soal · ${editing.code}`} onClose={closeModal}>
          <div className="flex flex-col gap-4">
            <label className="block text-[11px] font-semibold uppercase tracking-[0.06em] text-zinc-400">
              Pertanyaan
              <span className="ml-2 font-normal normal-case tracking-normal text-zinc-400">
                math pakai $…$ atau $$…$$
              </span>
              <textarea
                value={editing.prompt}
                onChange={(e) => patchQ(editing.id, { prompt: e.target.value })}
                onBlur={() => saveQ(editing)}
                rows={3}
                placeholder={"Tulis pertanyaan… mis: Nilai dari $\\sqrt{2}+\\sqrt{8}$"}
                className={`mt-1.5 ${input} resize-y font-mono normal-case tracking-normal`}
              />
            </label>

            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-zinc-400">
                Tipe soal
              </p>
              <div className="mt-1.5 inline-flex rounded-lg border border-zinc-200 p-0.5 text-xs font-semibold">
                {[
                  ["single", "Pilihan ganda"],
                  ["multi", "Checklist"],
                ].map(([val, label]) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => {
                      if ((editing.type ?? "single") === val) return;
                      commit({
                        type: val,
                        answers: val === "single" ? [eKeys[0] ?? 0] : eKeys,
                      });
                    }}
                    className={`rounded-md px-3 py-1.5 transition-colors ${
                      (editing.type ?? "single") === val
                        ? "bg-brand-500 text-white"
                        : "text-zinc-500 hover:text-zinc-800"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-zinc-400">
                Opsi · klik kotak buat tandai kunci
                {eMulti ? " (boleh > 1)" : ""}
              </p>
              {editing.options.map((opt, oi) => (
                <div key={oi} className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => toggleKey(oi)}
                    aria-label={`Tandai opsi ${oi + 1} benar`}
                    className={`grid h-5 w-5 shrink-0 place-items-center border-2 transition-colors ${
                      eMulti ? "rounded-md" : "rounded-full"
                    } ${
                      eKeys.includes(oi)
                        ? "border-teal-500 bg-teal-500 text-white"
                        : "border-zinc-300 text-transparent hover:border-teal-400"
                    }`}
                  >
                    <Check size={11} strokeWidth={3.5} />
                  </button>
                  <input
                    value={opt}
                    onChange={(e) => {
                      const options = editing.options.slice();
                      options[oi] = e.target.value;
                      patchQ(editing.id, { options });
                    }}
                    onBlur={() => saveQ(editing)}
                    placeholder={`Opsi ${String.fromCharCode(65 + oi)}`}
                    className={`${input} py-1.5 font-mono`}
                  />
                  <button
                    type="button"
                    disabled={editing.options.length <= 2}
                    onClick={() => {
                      const options = editing.options.filter((_, i) => i !== oi);
                      const shifted = eKeys
                        .filter((a) => a !== oi)
                        .map((a) => (a > oi ? a - 1 : a));
                      const answers = shifted.length ? shifted : [0];
                      patchQ(editing.id, { options, answers });
                      saveQ({ ...editing, options, answers });
                    }}
                    aria-label="Hapus opsi"
                    className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-zinc-300 transition-colors hover:bg-rose-50 hover:text-rose-500 disabled:opacity-25"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => {
                  const options = [...editing.options, ""];
                  patchQ(editing.id, { options });
                  saveQ({ ...editing, options });
                }}
                className="mt-0.5 inline-flex w-fit items-center gap-1 text-xs font-semibold text-brand-600 hover:text-brand-700"
              >
                <Plus size={12} /> Tambah opsi
              </button>
            </div>

            {/* Live preview */}
            <div className="rounded-lg border border-zinc-200 bg-zinc-50/60 p-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
                Pratinjau
              </p>
              <MathText className="mt-1.5 block text-sm text-zinc-900">
                {editing.prompt || "(soal masih kosong)"}
              </MathText>
              <ul className="mt-2 flex flex-col gap-1 text-sm text-zinc-600">
                {editing.options.map((opt, oi) => (
                  <li key={oi} className="flex gap-2">
                    <span
                      className={`font-semibold ${
                        eKeys.includes(oi) ? "text-teal-600" : "text-zinc-400"
                      }`}
                    >
                      {String.fromCharCode(65 + oi)}.
                    </span>
                    <MathText>{opt || "(kosong)"}</MathText>
                    {eKeys.includes(oi) && (
                      <span className="ml-auto text-[11px] font-semibold text-teal-700">
                        kunci
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Modal>
          );
        })()}
    </div>
  );
}

const IMPORT_EXAMPLE = `[
  {
    "prompt": "Nilai dari $\\\\sqrt{8}+\\\\sqrt{18}$ adalah…",
    "options": ["$3\\\\sqrt{2}$", "$5\\\\sqrt{2}$", "$6\\\\sqrt{2}$", "$7\\\\sqrt{2}$"],
    "answer": "B"
  },
  {
    "prompt": "Bilangan prima di bawah ini:",
    "options": ["2", "4", "7", "9"],
    "type": "multi",
    "answer": ["A", "C"]
  }
]`;

function ImportModal({ onClose, onImport }) {
  const [text, setText] = useState("");
  const [check, setCheck] = useState(null); // { items, errors }

  const run = () => setCheck(parseQuestionsJson(text));

  return (
    <Modal title="Import soal dari JSON" onClose={onClose}>
      <div className="flex flex-col gap-3">
        <p className="text-xs text-zinc-500">
          Array objek. Tiap objek: <code>prompt</code> (teks, boleh LaTeX
          <code> $…$ </code>), <code>options</code> (array, min 2),{" "}
          <code>answer</code> (index 0-based, huruf <code>&quot;A&quot;</code>…,
          atau teks opsi persis — boleh <code>array</code> untuk checklist).
          Opsional <code>type</code>: <code>&quot;multi&quot;</code>. Soal
          ditambahkan di akhir.
        </p>
        <details className="text-xs text-zinc-400">
          <summary className="cursor-pointer select-none">Contoh</summary>
          <pre className="mt-1 overflow-x-auto rounded-lg bg-zinc-50 p-3 text-[11px] text-zinc-600">
            {IMPORT_EXAMPLE}
          </pre>
        </details>

        <textarea
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setCheck(null);
          }}
          rows={10}
          placeholder="Paste JSON di sini…"
          className={`${input} resize-y font-mono text-xs`}
        />

        {check && (
          <div className="text-xs">
            {check.errors.length > 0 ? (
              <ul className="flex flex-col gap-0.5 text-rose-600">
                {check.errors.map((e, i) => (
                  <li key={i}>• {e}</li>
                ))}
              </ul>
            ) : (
              <p className="text-emerald-600">
                {check.items.length} soal siap diimport.
              </p>
            )}
          </div>
        )}

        <div className="flex gap-2">
          <button
            type="button"
            onClick={run}
            className="rounded-lg border border-zinc-200 px-3 py-2 text-xs font-medium text-zinc-600 transition-colors hover:bg-zinc-50"
          >
            Cek
          </button>
          <button
            type="button"
            disabled={!check || check.errors.length > 0 || !check.items.length}
            onClick={() => onImport(check.items)}
            className="rounded-lg bg-brand-500 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-brand-600 disabled:opacity-50"
          >
            Import{check?.items.length ? ` ${check.items.length} soal` : ""}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function BackNote({ text }) {
  return (
    <p className="text-sm text-zinc-500">
      {text}{" "}
      <Link to="/admin/set-soal" className="font-semibold text-brand-600">
        Kembali
      </Link>
    </p>
  );
}
