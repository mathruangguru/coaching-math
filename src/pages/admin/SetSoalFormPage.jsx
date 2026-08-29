import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Plus,
  Trash2,
  ChevronUp,
  ChevronDown,
  Check,
} from "lucide-react";
import {
  getQuestionSetAdmin,
  updateQuestionSet,
  createQuestion,
  updateQuestion,
  deleteQuestion,
  reorderQuestions,
} from "../../lib/quiz";
import Skeleton from "../../components/ui/Skeleton";

const input =
  "w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 outline-none transition-colors focus:border-brand-500";

function move(arr, from, to) {
  const n = arr.slice();
  const [x] = n.splice(from, 1);
  n.splice(to, 0, x);
  return n;
}

export default function SetSoalFormPage() {
  const { setId } = useParams();
  const [set, setSet] = useState(null);
  const [status, setStatus] = useState("loading"); // loading | error | not-found | ready
  const [saving, setSaving] = useState(false);

  const load = () => {
    setStatus("loading");
    getQuestionSetAdmin(setId)
      .then((data) => {
        if (!data) return setStatus("not-found");
        setSet(data);
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
      })
    );

  const saveQ = (q) =>
    run(() =>
      updateQuestion(q.id, {
        prompt: q.prompt.trim() || "Soal tanpa teks",
        options: q.options,
        answer: q.answer,
      })
    );

  const addQuestion = () =>
    run(async () => {
      const row = await createQuestion(set.id, {
        prompt: "",
        options: ["", ""],
        answer: 0,
        position: set.questions.length,
      });
      setSet((s) => ({ ...s, questions: [...s.questions, row] }));
    });

  const removeQuestion = (q, idx) => {
    if (!window.confirm(`Hapus soal ${idx + 1}?`)) return;
    run(async () => {
      await deleteQuestion(q.id);
      setSet((s) => ({
        ...s,
        questions: s.questions.filter((x) => x.id !== q.id),
      }));
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
    return <Skeleton className="h-96 w-full max-w-2xl rounded-2xl" />;
  if (status === "error")
    return <BackNote text="Gagal memuat set soal." />;
  if (status === "not-found")
    return <BackNote text="Set soal tidak ditemukan." />;

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-5">
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

      {/* Meta */}
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
      </div>

      {/* Questions */}
      {set.questions.map((q, qi) => (
        <div
          key={q.id}
          className="flex flex-col gap-3 rounded-2xl border border-zinc-200/80 bg-white p-5"
        >
          <div className="flex items-center gap-2">
            <span className="grid h-6 w-6 shrink-0 place-items-center rounded-lg bg-zinc-900 text-xs font-bold text-white">
              {qi + 1}
            </span>
            <span className="flex-1 text-xs font-semibold uppercase tracking-wide text-zinc-400">
              Soal
            </span>
            <button
              type="button"
              className="grid h-6 w-6 place-items-center rounded text-zinc-300 hover:bg-zinc-100 hover:text-zinc-600 disabled:opacity-25"
              disabled={qi === 0}
              onClick={() => moveQuestion(qi, -1)}
              aria-label="Naikkan soal"
            >
              <ChevronUp size={14} />
            </button>
            <button
              type="button"
              className="grid h-6 w-6 place-items-center rounded text-zinc-300 hover:bg-zinc-100 hover:text-zinc-600 disabled:opacity-25"
              disabled={qi === set.questions.length - 1}
              onClick={() => moveQuestion(qi, 1)}
              aria-label="Turunkan soal"
            >
              <ChevronDown size={14} />
            </button>
            <button
              type="button"
              onClick={() => removeQuestion(q, qi)}
              aria-label="Hapus soal"
              className="grid h-7 w-7 place-items-center rounded-md text-zinc-400 transition-colors hover:bg-rose-50 hover:text-rose-500"
            >
              <Trash2 size={14} />
            </button>
          </div>

          <textarea
            value={q.prompt}
            onChange={(e) => patchQ(q.id, { prompt: e.target.value })}
            onBlur={() => saveQ(q)}
            rows={2}
            placeholder="Tulis pertanyaan…"
            className={`${input} resize-y`}
          />

          <div className="flex flex-col gap-1.5">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
              Opsi · klik bulatan untuk kunci jawaban
            </p>
            {q.options.map((opt, oi) => (
              <div key={oi} className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    patchQ(q.id, { answer: oi });
                    saveQ({ ...q, answer: oi });
                  }}
                  aria-label={`Tandai opsi ${oi + 1} benar`}
                  className={`grid h-5 w-5 shrink-0 place-items-center rounded-full border-2 transition-colors ${
                    q.answer === oi
                      ? "border-teal-500 bg-teal-500 text-white"
                      : "border-zinc-300 text-transparent hover:border-teal-400"
                  }`}
                >
                  <Check size={11} strokeWidth={3.5} />
                </button>
                <input
                  value={opt}
                  onChange={(e) => {
                    const options = q.options.slice();
                    options[oi] = e.target.value;
                    patchQ(q.id, { options });
                  }}
                  onBlur={() => saveQ(q)}
                  placeholder={`Opsi ${oi + 1}`}
                  className={`${input} py-1.5`}
                />
                <button
                  type="button"
                  disabled={q.options.length <= 2}
                  onClick={() => {
                    const options = q.options.filter((_, i) => i !== oi);
                    const answer =
                      q.answer === oi
                        ? 0
                        : q.answer > oi
                          ? q.answer - 1
                          : q.answer;
                    patchQ(q.id, { options, answer });
                    saveQ({ ...q, options, answer });
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
                const options = [...q.options, ""];
                patchQ(q.id, { options });
                saveQ({ ...q, options });
              }}
              className="mt-0.5 inline-flex w-fit items-center gap-1 text-xs font-semibold text-brand-600 hover:text-brand-700"
            >
              <Plus size={12} /> Tambah opsi
            </button>
          </div>
        </div>
      ))}

      <button
        type="button"
        onClick={addQuestion}
        className="flex items-center justify-center gap-1.5 rounded-2xl border-2 border-dashed border-zinc-200 py-3 text-xs font-semibold text-zinc-500 transition-colors hover:border-brand-300 hover:bg-brand-50/30 hover:text-brand-600"
      >
        <Plus size={14} /> Tambah soal
      </button>
    </div>
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
