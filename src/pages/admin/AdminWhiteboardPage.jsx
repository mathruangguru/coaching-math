import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Pencil,
  Eraser,
  Undo2,
  Redo2,
  Trash2,
  Grid3x3,
  Download,
  Check,
} from "lucide-react";
import { getWhiteboard, updateWhiteboard, EMPTY_BOARD } from "../../lib/whiteboards";
import WhiteboardCanvas from "../../components/admin/WhiteboardCanvas";
import Skeleton from "../../components/ui/Skeleton";

const COLORS = ["#18181b", "#ef4444", "#2563eb", "#16a34a", "#f59e0b"];
const WIDTHS = [
  { w: 3, label: "Tipis" },
  { w: 6, label: "Sedang" },
  { w: 12, label: "Tebal" },
];

export default function AdminWhiteboardPage() {
  const { id } = useParams();
  const canvasRef = useRef(null);

  const [status, setStatus] = useState("loading"); // loading | error | ready
  const [title, setTitle] = useState("");
  const [shared, setShared] = useState(false);

  // Riwayat atomik: { past[], present, future[] }.
  const [hist, setHist] = useState({
    past: [],
    present: EMPTY_BOARD,
    future: [],
  });
  const present = hist.present;

  const [tool, setTool] = useState("pen");
  const [color, setColor] = useState(COLORS[0]);
  const [width, setWidth] = useState(WIDTHS[1].w);
  const [saveState, setSaveState] = useState("saved"); // saved | saving

  const firstSave = useRef(true);

  useEffect(() => {
    let alive = true;
    getWhiteboard(id)
      .then((row) => {
        if (!alive) return;
        if (!row) return setStatus("error");
        setTitle(row.title ?? "Papan baru");
        setShared(!!row.shared);
        const board =
          row.data && Array.isArray(row.data.strokes)
            ? {
                bg: row.data.bg === "grid" ? "grid" : "blank",
                strokes: row.data.strokes,
              }
            : { ...EMPTY_BOARD };
        setHist({ past: [], present: board, future: [] });
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
  }, [id]);

  // Autosave `present` ter-debounce.
  useEffect(() => {
    if (status !== "ready") return;
    if (firstSave.current) {
      firstSave.current = false;
      return;
    }
    setSaveState("saving");
    const t = setTimeout(() => {
      updateWhiteboard(id, { data: present })
        .then(() => setSaveState("saved"))
        .catch((err) => {
          console.warn("[whiteboard] gagal simpan:", err);
          setSaveState("saved");
        });
    }, 700);
    return () => clearTimeout(t);
  }, [present, id, status]);

  const commit = useCallback((next) => {
    setHist((h) => ({
      past: [...h.past, h.present].slice(-80),
      present: next,
      future: [],
    }));
  }, []);

  const undo = () =>
    setHist((h) =>
      h.past.length
        ? {
            past: h.past.slice(0, -1),
            present: h.past[h.past.length - 1],
            future: [h.present, ...h.future],
          }
        : h,
    );
  const redo = () =>
    setHist((h) =>
      h.future.length
        ? {
            past: [...h.past, h.present],
            present: h.future[0],
            future: h.future.slice(1),
          }
        : h,
    );

  const clearAll = () => {
    if (!present.strokes.length) return;
    if (!window.confirm("Bersihkan semua coretan?")) return;
    commit({ ...present, strokes: [] });
  };
  const toggleGrid = () =>
    commit({ ...present, bg: present.bg === "grid" ? "blank" : "grid" });

  const toggleShare = async () => {
    const next = !shared;
    setShared(next);
    try {
      await updateWhiteboard(id, { shared: next });
    } catch (err) {
      setShared(!next);
      window.alert(`Gagal: ${err?.message ?? err}`);
    }
  };

  const saveTitle = () => {
    const t = title.trim() || "Papan baru";
    if (t !== title) setTitle(t);
    updateWhiteboard(id, { title: t }).catch(() => {});
  };

  if (status === "loading")
    return <Skeleton className="h-[70vh] w-full rounded-2xl" />;
  if (status === "error")
    return (
      <p className="text-sm text-zinc-500">
        Papan tidak ditemukan.{" "}
        <Link
          to="/admin/utilitas/whiteboard"
          className="font-semibold text-brand-600"
        >
          Kembali
        </Link>
      </p>
    );

  const toolBtn =
    "grid h-9 w-9 place-items-center rounded-lg border transition-colors disabled:opacity-30";

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <Link
          to="/admin/utilitas/whiteboard"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-400 transition-colors hover:text-zinc-700"
        >
          <ArrowLeft size={13} /> Semua papan
        </Link>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={saveTitle}
          onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
          className="min-w-0 flex-1 rounded-lg border border-transparent bg-transparent px-1 py-0.5 text-lg font-bold text-zinc-900 outline-none hover:border-zinc-200 focus:border-brand-500"
        />
        <span className="shrink-0 text-[11px] text-zinc-400">
          {saveState === "saving" ? "menyimpan…" : "tersimpan"}
        </span>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-zinc-200 bg-white p-2">
        <button
          type="button"
          onClick={() => setTool("pen")}
          aria-pressed={tool === "pen"}
          title="Pinsil"
          className={`${toolBtn} ${
            tool === "pen"
              ? "border-brand-500 bg-brand-50 text-brand-600"
              : "border-zinc-200 text-zinc-500 hover:bg-zinc-50"
          }`}
        >
          <Pencil size={16} />
        </button>
        <button
          type="button"
          onClick={() => setTool("eraser")}
          aria-pressed={tool === "eraser"}
          title="Penghapus (hapus coretan)"
          className={`${toolBtn} ${
            tool === "eraser"
              ? "border-brand-500 bg-brand-50 text-brand-600"
              : "border-zinc-200 text-zinc-500 hover:bg-zinc-50"
          }`}
        >
          <Eraser size={16} />
        </button>

        <span className="mx-1 h-6 w-px bg-zinc-200" />

        {COLORS.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => {
              setColor(c);
              setTool("pen");
            }}
            aria-label={`Warna ${c}`}
            className={`h-7 w-7 shrink-0 rounded-full border-2 transition-transform ${
              color === c && tool === "pen"
                ? "scale-110 border-zinc-900"
                : "border-white ring-1 ring-zinc-200"
            }`}
            style={{ background: c }}
          />
        ))}

        <span className="mx-1 h-6 w-px bg-zinc-200" />

        {WIDTHS.map(({ w, label }) => (
          <button
            key={w}
            type="button"
            onClick={() => setWidth(w)}
            title={label}
            className={`${toolBtn} ${
              width === w
                ? "border-brand-500 bg-brand-50"
                : "border-zinc-200 hover:bg-zinc-50"
            }`}
          >
            <span
              className="block rounded-full bg-zinc-800"
              style={{ width: w + 2, height: w + 2 }}
            />
          </button>
        ))}

        <span className="mx-1 h-6 w-px bg-zinc-200" />

        <button
          type="button"
          onClick={undo}
          disabled={!hist.past.length}
          title="Undo"
          className={`${toolBtn} border-zinc-200 text-zinc-500 hover:bg-zinc-50`}
        >
          <Undo2 size={16} />
        </button>
        <button
          type="button"
          onClick={redo}
          disabled={!hist.future.length}
          title="Redo"
          className={`${toolBtn} border-zinc-200 text-zinc-500 hover:bg-zinc-50`}
        >
          <Redo2 size={16} />
        </button>
        <button
          type="button"
          onClick={toggleGrid}
          aria-pressed={present.bg === "grid"}
          title="Latar grid"
          className={`${toolBtn} ${
            present.bg === "grid"
              ? "border-brand-500 bg-brand-50 text-brand-600"
              : "border-zinc-200 text-zinc-500 hover:bg-zinc-50"
          }`}
        >
          <Grid3x3 size={16} />
        </button>
        <button
          type="button"
          onClick={clearAll}
          title="Bersihkan semua"
          className={`${toolBtn} border-zinc-200 text-zinc-500 hover:bg-rose-50 hover:text-rose-500`}
        >
          <Trash2 size={16} />
        </button>
        <button
          type="button"
          onClick={() => canvasRef.current?.exportPng(title)}
          title="Export PNG"
          className={`${toolBtn} border-zinc-200 text-zinc-500 hover:bg-zinc-50`}
        >
          <Download size={16} />
        </button>

        <button
          type="button"
          onClick={toggleShare}
          className={`ml-auto inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition-colors ${
            shared
              ? "border-teal-300 bg-teal-50 text-teal-700"
              : "border-zinc-200 text-zinc-500 hover:bg-zinc-50"
          }`}
        >
          {shared && <Check size={13} />}
          {shared ? "Dishare ke murid" : "Bagikan ke murid"}
        </button>
      </div>

      <WhiteboardCanvas
        ref={canvasRef}
        board={present}
        onCommit={commit}
        tool={tool}
        color={color}
        width={width}
      />

      <p className="text-[11px] text-zinc-400">
        Penghapus ngehapus per coretan. Undo/redo per coretan. Auto-save ~1 detik
        setelah berhenti nyoret.
      </p>
    </div>
  );
}
