import { useEffect, useRef, useState } from "react";
import { Camera, Clock, Trash2 } from "lucide-react";
import {
  SCRATCH_MAX_FILES,
  getScratchStatus,
  listScratch,
  uploadScratch,
  deleteScratch,
} from "../../lib/scratch";

const mmss = (ms) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

/**
 * Upload coret-coretan (foto) setelah submit kuis. Cuma dirender kalau
 * lesson-nya mengaktifkan fitur ini. Batas waktu dihitung server dari saat
 * submit; di sini cuma hitung mundur + disable tombol, penegakannya di RLS.
 */
export default function ScratchUpload({ lessonId }) {
  const [state, setState] = useState({ status: "loading" });
  const [files, setFiles] = useState([]);
  const [remaining, setRemaining] = useState(0);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const inputRef = useRef(null);
  const attemptIdRef = useRef(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const st = await getScratchStatus(lessonId);
        if (!alive) return;
        if (!st) return setState({ status: "off" });
        attemptIdRef.current = st.attemptId;
        const list = await listScratch(st.attemptId).catch(() => []);
        if (!alive) return;
        setFiles(list);
        setRemaining(st.remainingMs);
        setState({ status: "ready", windowMin: st.windowMin });
      } catch (e) {
        console.warn("[ScratchUpload] gagal memuat:", e);
        if (alive) setState({ status: "off" });
      }
    })();
    return () => {
      alive = false;
    };
  }, [lessonId]);

  // Hitung mundur. Pakai selisih jam monotonic (bukan Date.now) biar jam
  // perangkat yang diutak-atik nggak bikin waktunya "nambah".
  const ready = state.status === "ready";
  useEffect(() => {
    if (!ready) return;
    const t0 = performance.now();
    const base = remaining;
    const id = setInterval(() => {
      setRemaining(Math.max(0, base - (performance.now() - t0)));
    }, 500);
    return () => clearInterval(id);
    // Cuma start ulang pas pertama siap — `remaining` sengaja nggak dependensi.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  if (state.status === "loading" || state.status === "off") return null;

  const open = remaining > 0;
  const full = files.length >= SCRATCH_MAX_FILES;

  const pick = async (e) => {
    const picked = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (!picked.length) return;
    setBusy(true);
    setErr("");
    try {
      let count = files.length;
      for (const f of picked) {
        if (count >= SCRATCH_MAX_FILES) {
          setErr(`Maksimal ${SCRATCH_MAX_FILES} foto.`);
          break;
        }
        const row = await uploadScratch(attemptIdRef.current, f);
        count += 1;
        setFiles((s) => [...s, row]);
      }
    } catch (e2) {
      const msg = e2?.message ?? "";
      setErr(
        /row-level security|violates/i.test(msg)
          ? "Waktu upload sudah habis."
          : msg || "Gagal upload. Coba lagi."
      );
    } finally {
      setBusy(false);
    }
  };

  const remove = async (item) => {
    setErr("");
    try {
      await deleteScratch(item);
      setFiles((s) => s.filter((x) => x.id !== item.id));
    } catch (e) {
      setErr(e?.message ?? "Gagal menghapus.");
    }
  };

  return (
    <div className="rounded-2xl border border-zinc-200/80 bg-white p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-bold text-zinc-900">
            Upload coret-coretan
          </p>
          <p className="mt-0.5 text-xs text-zinc-500">
            Foto kertas coretan pengerjaanmu. Maks {SCRATCH_MAX_FILES} foto.
          </p>
        </div>
        <span
          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold tabular-nums ${
            open
              ? remaining < 60000
                ? "bg-rose-50 text-rose-600"
                : "bg-amber-50 text-amber-700"
              : "bg-zinc-100 text-zinc-500"
          }`}
        >
          <Clock size={12} />
          {open ? `Sisa ${mmss(remaining)}` : "Waktu habis"}
        </span>
      </div>

      {open ? (
        <>
          <input
            ref={inputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            multiple
            className="hidden"
            onChange={pick}
          />
          <button
            type="button"
            disabled={busy || full}
            onClick={() => inputRef.current?.click()}
            className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-600 disabled:opacity-50"
          >
            <Camera size={15} />
            {busy ? "Mengupload…" : "Pilih / ambil foto"}
          </button>
          <p className="mt-2 text-[11px] text-zinc-400">
            Upload ditutup {state.windowMin} menit setelah kamu submit.
          </p>
        </>
      ) : (
        <p className="mt-3 text-xs text-zinc-400">
          Batas waktu upload ({state.windowMin} menit setelah submit) sudah
          lewat.
        </p>
      )}

      {err && <p className="mt-2 text-xs text-rose-600">{err}</p>}

      {files.length > 0 && (
        <ul className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-4">
          {files.map((f, i) => (
            <li
              key={f.id}
              className="group relative aspect-square overflow-hidden rounded-lg border border-zinc-200 bg-zinc-50"
            >
              {f.url && (
                <a href={f.url} target="_blank" rel="noopener noreferrer">
                  <img
                    src={f.url}
                    alt={`Coret-coretan ${i + 1}`}
                    className="h-full w-full object-cover"
                  />
                </a>
              )}
              {open && (
                <button
                  type="button"
                  onClick={() => remove(f)}
                  aria-label="Hapus foto"
                  className="absolute right-1 top-1 grid h-6 w-6 place-items-center rounded-md bg-white/90 text-zinc-500 shadow transition-colors hover:text-rose-600"
                >
                  <Trash2 size={12} />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
