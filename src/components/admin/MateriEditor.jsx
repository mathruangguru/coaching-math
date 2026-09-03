import { Suspense, lazy, useCallback, useEffect, useRef, useState } from "react";
import {
  X,
  Bold,
  Italic,
  Heading2,
  List,
  ListOrdered,
  Quote,
  Link2,
  Code,
} from "lucide-react";
import { updateLesson } from "../../lib/courses";
import Skeleton from "../ui/Skeleton";

const Markdown = lazy(() => import("../ui/Markdown"));

const TOOLS = [
  { icon: Bold, title: "Tebal", wrap: ["**", "**"] },
  { icon: Italic, title: "Miring", wrap: ["_", "_"] },
  { icon: Heading2, title: "Judul", line: "## " },
  { icon: List, title: "Daftar", line: "- " },
  { icon: ListOrdered, title: "Daftar bernomor", line: "1. " },
  { icon: Quote, title: "Kutipan", line: "> " },
  { icon: Link2, title: "Tautan", wrap: ["[", "](https://)"] },
  { icon: Code, title: "Kode", wrap: ["`", "`"] },
];

const btnCls =
  "grid h-7 w-7 place-items-center rounded text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-800";

export default function MateriEditor({ lesson, onClose, onSaved }) {
  const [text, setText] = useState(lesson.content ?? "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [view, setView] = useState("tulis"); // mobile: tulis | preview
  const taRef = useRef(null);

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const applyWrap = useCallback((before, after) => {
    const ta = taRef.current;
    if (!ta) return;
    const { selectionStart: s, selectionEnd: e, value } = ta;
    setText(
      value.slice(0, s) + before + value.slice(s, e) + after + value.slice(e)
    );
    requestAnimationFrame(() => {
      ta.focus();
      ta.selectionStart = s + before.length;
      ta.selectionEnd = e + before.length;
    });
  }, []);

  const applyLine = useCallback((prefix) => {
    const ta = taRef.current;
    if (!ta) return;
    const { selectionStart: s, value } = ta;
    const at = value.lastIndexOf("\n", s - 1) + 1;
    setText(value.slice(0, at) + prefix + value.slice(at));
    requestAnimationFrame(() => {
      ta.focus();
      ta.selectionStart = ta.selectionEnd = s + prefix.length;
    });
  }, []);

  const save = async () => {
    setBusy(true);
    setErr("");
    try {
      await updateLesson(lesson.id, { content: text });
      onSaved(text.trim() || null);
      onClose();
    } catch (e) {
      setErr(e?.message ?? "Gagal menyimpan.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-zinc-900/40 p-3 sm:p-6"
      onClick={onClose}
    >
      <div
        className="flex w-full max-w-5xl flex-col rounded-2xl border border-zinc-200 bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 border-b border-zinc-100 px-5 py-3.5">
          <h3 className="truncate text-sm font-bold text-zinc-900">
            Tulis materi — {lesson.title}
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup"
            className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700"
          >
            <X size={16} />
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-1 border-b border-zinc-100 px-3 py-2">
          {TOOLS.map(({ icon: Icon, title, wrap, line }) => (
            <button
              key={title}
              type="button"
              title={title}
              onClick={() =>
                wrap ? applyWrap(wrap[0], wrap[1]) : applyLine(line)
              }
              className={btnCls}
            >
              <Icon size={14} />
            </button>
          ))}
          <span className="mx-1 hidden text-[11px] text-zinc-300 lg:inline">
            Markdown · rumus pakai $…$
          </span>
          <div className="ml-auto inline-flex rounded-md border border-zinc-200 p-0.5 text-xs lg:hidden">
            {["tulis", "preview"].map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setView(v)}
                className={`rounded px-2 py-0.5 font-medium capitalize ${
                  view === v ? "bg-zinc-900 text-white" : "text-zinc-500"
                }`}
              >
                {v}
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-px bg-zinc-100 lg:grid-cols-2">
          <textarea
            ref={taRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            spellCheck={false}
            placeholder={"# Judul\n\nTulis materi di sini pakai Markdown…"}
            className={`min-h-[45vh] w-full resize-y bg-white p-4 font-mono text-[13px] leading-relaxed text-zinc-800 outline-none ${
              view === "preview" ? "hidden lg:block" : ""
            }`}
          />
          <div
            className={`min-h-[45vh] overflow-y-auto bg-white p-4 ${
              view === "tulis" ? "hidden lg:block" : ""
            }`}
          >
            {text.trim() ? (
              <Suspense fallback={<Skeleton className="h-32 w-full rounded" />}>
                <Markdown className="text-sm text-zinc-700">{text}</Markdown>
              </Suspense>
            ) : (
              <p className="text-xs text-zinc-300">Preview muncul di sini.</p>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-zinc-100 px-5 py-3">
          <span className="text-[11px] text-zinc-400">
            {err ? (
              <span className="text-rose-600">{err}</span>
            ) : (
              `${text.length} karakter`
            )}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-zinc-200 px-3 py-1.5 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-50"
            >
              Batal
            </button>
            <button
              type="button"
              onClick={save}
              disabled={busy}
              className="rounded-lg bg-brand-500 px-4 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-brand-600 disabled:opacity-50"
            >
              {busy ? "Menyimpan…" : "Simpan"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
