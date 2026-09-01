import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  Maximize,
  Minimize,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Volume2,
  VolumeX,
} from "lucide-react";

const PRESETS = [1, 3, 5, 10, 15, 20, 30, 45]; // menit
const RING_R = 130;
const RING_LEN = 2 * Math.PI * RING_R;
const MAX_MIN = 599;

const clampInt = (v, lo, hi) => {
  const x = parseInt(v, 10);
  if (Number.isNaN(x)) return lo;
  return Math.min(hi, Math.max(lo, x));
};

const fmt = (ms) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const p = (x) => String(x).padStart(2, "0");
  return h > 0 ? `${h}:${p(m)}:${p(sec)}` : `${p(m)}:${p(sec)}`;
};

export default function AdminTimerPage() {
  const [totalMs, setTotalMs] = useState(5 * 60 * 1000);
  const [remainingMs, setRemainingMs] = useState(5 * 60 * 1000);
  const [running, setRunning] = useState(false);
  const [finished, setFinished] = useState(false);
  const [muted, setMuted] = useState(false);
  const [isFs, setIsFs] = useState(false);
  const [mIn, setMIn] = useState("5");
  const [sIn, setSIn] = useState("00");

  const endAtRef = useRef(0);
  const mutedRef = useRef(false);
  const audioCtxRef = useRef(null);
  const panelRef = useRef(null);

  // ── SFX (Web Audio, tanpa file) ──────────────────────────────────
  const getCtx = useCallback(() => {
    if (mutedRef.current || typeof window === "undefined") return null;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    if (!audioCtxRef.current) {
      try {
        audioCtxRef.current = new AC();
      } catch {
        return null;
      }
    }
    if (audioCtxRef.current.state === "suspended") audioCtxRef.current.resume();
    return audioCtxRef.current;
  }, []);

  const playAlarm = useCallback(() => {
    const ctx = getCtx();
    if (!ctx) return;
    const t0 = ctx.currentTime + 0.02;
    for (let i = 0; i < 10; i++) {
      const t = t0 + i * 0.28;
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = "square";
      osc.frequency.setValueAtTime(i % 2 ? 660 : 990, t);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.2, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
      osc.connect(g).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.24);
    }
  }, [getCtx]);

  useEffect(() => () => audioCtxRef.current?.close?.(), []);

  // ── Tick ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      const rem = endAtRef.current - Date.now();
      if (rem <= 0) {
        setRemainingMs(0);
        setRunning(false);
        setFinished(true);
        playAlarm();
      } else {
        setRemainingMs(rem);
      }
    }, 100);
    return () => clearInterval(id);
  }, [running, playAlarm]);

  // ── Fullscreen ───────────────────────────────────────────────────
  useEffect(() => {
    const onFs = () => setIsFs(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement) {
        await (document.exitFullscreen?.() ??
          document.webkitExitFullscreen?.());
      } else {
        const el = panelRef.current;
        await (el?.requestFullscreen?.() ?? el?.webkitRequestFullscreen?.());
      }
    } catch {
      /* ditolak / dibatalin — abaikan */
    }
  };

  const toggleMute = () => {
    const v = !mutedRef.current;
    mutedRef.current = v;
    setMuted(v);
  };

  // ── Kontrol ──────────────────────────────────────────────────────
  const applyDuration = (ms) => {
    const clamped = Math.max(0, Math.min(ms, MAX_MIN * 60 * 1000));
    setRunning(false);
    setFinished(false);
    setTotalMs(clamped);
    setRemainingMs(clamped);
    setMIn(String(Math.floor(clamped / 60000)));
    setSIn(String(Math.floor((clamped % 60000) / 1000)).padStart(2, "0"));
  };

  const applyCustom = () => {
    const ms = (clampInt(mIn, 0, MAX_MIN) * 60 + clampInt(sIn, 0, 59)) * 1000;
    applyDuration(ms || 0);
  };

  const toggleRun = () => {
    if (running) {
      setRemainingMs(Math.max(0, endAtRef.current - Date.now()));
      setRunning(false);
      return;
    }
    if (remainingMs <= 0) return;
    getCtx(); // buka audio dalam gesture user
    endAtRef.current = Date.now() + remainingMs;
    setFinished(false);
    setRunning(true);
  };

  const reset = () => {
    setRunning(false);
    setFinished(false);
    setRemainingMs(totalMs);
  };

  const addMinute = () => {
    setFinished(false);
    if (running) {
      endAtRef.current += 60000;
      setRemainingMs(endAtRef.current - Date.now());
    } else {
      const t = remainingMs + 60000;
      setRemainingMs(t);
      if (t > totalMs) setTotalMs(t);
    }
  };

  const frac = totalMs > 0 ? Math.max(0, Math.min(1, remainingMs / totalMs)) : 0;
  const ringColor =
    finished || frac <= 0.1 ? "#ef4444" : frac <= 0.34 ? "#f59e0b" : "#10b981";
  const presetActive = !running && Math.round(totalMs / 60000);

  const iconBtn =
    "grid h-8 w-8 place-items-center rounded-lg text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-600";

  return (
    <div className="flex flex-col gap-5">
      <div>
        <Link
          to="/admin/utilitas"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-500 transition-colors hover:text-zinc-800"
        >
          <ArrowLeft size={14} /> Utilitas
        </Link>
        <h1 className="mt-2 text-xl font-bold tracking-tight text-zinc-900">
          Timer
        </h1>
        <p className="mt-1 text-xs text-zinc-400">
          Hitung mundur — buat ngatur waktu latihan atau kuis.
        </p>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,320px)_1fr]">
        {/* Atur */}
        <div className="flex flex-col gap-4 rounded-2xl border border-zinc-200 bg-white p-5">
          <div>
            <p className="text-xs font-medium text-zinc-600">Preset (menit)</p>
            <div className="mt-2 grid grid-cols-4 gap-2">
              {PRESETS.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => applyDuration(m * 60000)}
                  className={`rounded-lg border px-2 py-2 text-sm font-semibold transition-colors ${
                    presetActive === m
                      ? "border-brand-500 bg-brand-50 text-brand-700"
                      : "border-zinc-200 text-zinc-600 hover:bg-zinc-50"
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs font-medium text-zinc-600">Atur sendiri</p>
            <div className="mt-2 flex items-center gap-2">
              <label className="flex flex-1 flex-col text-[11px] text-zinc-400">
                Menit
                <input
                  type="number"
                  min={0}
                  max={MAX_MIN}
                  value={mIn}
                  onChange={(e) => setMIn(e.target.value)}
                  onBlur={applyCustom}
                  onKeyDown={(e) => e.key === "Enter" && applyCustom()}
                  className="mt-1 w-full rounded-lg border border-zinc-300 px-2 py-1.5 text-sm text-zinc-900 outline-none focus:border-brand-500"
                />
              </label>
              <label className="flex flex-1 flex-col text-[11px] text-zinc-400">
                Detik
                <input
                  type="number"
                  min={0}
                  max={59}
                  value={sIn}
                  onChange={(e) => setSIn(e.target.value)}
                  onBlur={applyCustom}
                  onKeyDown={(e) => e.key === "Enter" && applyCustom()}
                  className="mt-1 w-full rounded-lg border border-zinc-300 px-2 py-1.5 text-sm text-zinc-900 outline-none focus:border-brand-500"
                />
              </label>
              <button
                type="button"
                onClick={applyCustom}
                className="mt-4 rounded-lg bg-brand-500 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-brand-600"
              >
                Set
              </button>
            </div>
          </div>

          <p className="text-xs text-zinc-400">
            Tombol <span className="font-semibold text-zinc-500">+1:00</span> buat
            nambah waktu, bisa sambil jalan.
          </p>
        </div>

        {/* Panel timer */}
        <div
          ref={panelRef}
          className={`timer-panel relative flex flex-col items-center justify-center gap-6 border border-zinc-200 bg-white p-5 ${
            isFs ? "rounded-none" : "rounded-2xl"
          }`}
        >
          <div className="absolute right-3 top-3 z-10 flex items-center gap-1">
            <button
              type="button"
              onClick={toggleMute}
              aria-label={muted ? "Nyalakan suara" : "Matikan suara"}
              className={iconBtn}
            >
              {muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
            </button>
            <button
              type="button"
              onClick={toggleFullscreen}
              aria-label={isFs ? "Keluar layar penuh" : "Layar penuh"}
              className={iconBtn}
            >
              {isFs ? <Minimize size={16} /> : <Maximize size={16} />}
            </button>
          </div>

          <div
            className={`relative w-full ${
              isFs ? "max-w-[min(72vh,760px)]" : "max-w-[340px]"
            }`}
          >
            <svg viewBox="0 0 300 300" className="w-full -rotate-90">
              <circle
                cx="150"
                cy="150"
                r={RING_R}
                fill="none"
                stroke="#f1f1f3"
                strokeWidth="14"
              />
              <circle
                cx="150"
                cy="150"
                r={RING_R}
                fill="none"
                stroke={ringColor}
                strokeWidth="14"
                strokeLinecap="round"
                strokeDasharray={RING_LEN}
                strokeDashoffset={RING_LEN * (1 - frac)}
                style={{ transition: "stroke-dashoffset 0.2s linear" }}
              />
            </svg>
            <div className="absolute inset-0 grid place-items-center">
              <div className="text-center">
                <div
                  className={`font-mono font-bold tabular-nums leading-none ${
                    finished ? "text-rose-600" : "text-zinc-900"
                  } ${isFs ? "text-[16vw]" : "text-6xl sm:text-7xl"} ${
                    finished ? "spinwheel-pop" : ""
                  }`}
                >
                  {fmt(remainingMs)}
                </div>
                {finished && (
                  <p
                    className={`mt-2 font-bold uppercase tracking-[0.2em] text-rose-500 ${
                      isFs ? "text-2xl" : "text-sm"
                    }`}
                  >
                    Waktu habis
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-2">
            <button
              type="button"
              onClick={toggleRun}
              disabled={remainingMs <= 0 && !running}
              className="inline-flex items-center gap-2 rounded-xl bg-brand-500 px-7 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-600 disabled:opacity-50"
            >
              {running ? <Pause size={16} /> : <Play size={16} />}
              {running ? "Jeda" : "Mulai"}
            </button>
            <button
              type="button"
              onClick={addMinute}
              className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-50"
            >
              <Plus size={15} /> 1:00
            </button>
            <button
              type="button"
              onClick={reset}
              className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-50"
            >
              <RotateCcw size={15} /> Reset
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
