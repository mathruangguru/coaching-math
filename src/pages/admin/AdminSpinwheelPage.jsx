import { useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, RotateCw, Users, X } from "lucide-react";
import { getUsers } from "../../lib/users";

const COLORS = [
  "#f472b6",
  "#fb923c",
  "#facc15",
  "#34d399",
  "#22d3ee",
  "#818cf8",
  "#c084fc",
  "#f87171",
];

const CX = 160;
const CY = 160;
const R = 150;
const SPIN_MS = 4500;

function polar(r, deg) {
  const a = ((deg - 90) * Math.PI) / 180; // deg 0 = atas, searah jarum jam
  return [CX + r * Math.cos(a), CY + r * Math.sin(a)];
}

function sectorPath(startDeg, endDeg) {
  const [x1, y1] = polar(R, startDeg);
  const [x2, y2] = polar(R, endDeg);
  const large = endDeg - startDeg > 180 ? 1 : 0;
  return `M ${CX} ${CY} L ${x1} ${y1} A ${R} ${R} 0 ${large} 1 ${x2} ${y2} Z`;
}

const trunc = (s, n = 16) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

const prefersReducedMotion = () =>
  typeof window !== "undefined" &&
  window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

export default function AdminSpinwheelPage() {
  const [text, setText] = useState("");
  const [rotation, setRotation] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [winner, setWinner] = useState(null);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [msg, setMsg] = useState("");
  const pendingRef = useRef(null);
  const timerRef = useRef(null);

  const names = useMemo(
    () =>
      text
        .split(/\r?\n/)
        .map((s) => s.trim())
        .filter(Boolean),
    [text]
  );
  const n = names.length;
  const seg = n ? 360 / n : 0;

  const fillFromUsers = async () => {
    setLoadingUsers(true);
    setMsg("");
    try {
      const users = await getUsers();
      const display = users
        .map(
          (u) =>
            [u.first_name, u.last_name].filter(Boolean).join(" ").trim() ||
            u.email
        )
        .filter(Boolean);
      const have = new Set(names.map((x) => x.toLowerCase()));
      const fresh = display.filter((d) => !have.has(d.toLowerCase()));
      if (!fresh.length) {
        setMsg("Semua user sudah ada di daftar.");
        return;
      }
      setText(
        (t) => (t.trim() ? `${t.replace(/\s*$/, "")}\n` : "") + fresh.join("\n")
      );
      setMsg(`+${fresh.length} nama dari daftar user.`);
    } catch (e) {
      setMsg(e?.message ?? "Gagal memuat user.");
    } finally {
      setLoadingUsers(false);
    }
  };

  const settle = () => {
    if (pendingRef.current == null) return;
    clearTimeout(timerRef.current);
    setWinner(names[pendingRef.current] ?? null);
    pendingRef.current = null;
    setSpinning(false);
  };

  const spin = () => {
    if (spinning || n < 1) return;
    setWinner(null);
    setMsg("");
    const w = Math.floor(Math.random() * n);
    pendingRef.current = w;

    const desired = (360 - ((w * seg + seg / 2) % 360)) % 360;
    const current = ((rotation % 360) + 360) % 360;
    const delta = (desired - current + 360) % 360;
    const jitter = (Math.random() - 0.5) * seg * 0.6;
    const next = rotation + 360 * 6 + delta + jitter;

    if (prefersReducedMotion()) {
      setRotation(next);
      setWinner(names[w] ?? null);
      pendingRef.current = null;
      return;
    }
    setSpinning(true);
    setRotation(next);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(settle, SPIN_MS + 600);
  };

  const dropWinner = () => {
    if (!winner) return;
    const i = names.findIndex((x) => x === winner);
    if (i === -1) return;
    setText(names.slice(0, i).concat(names.slice(i + 1)).join("\n"));
    setWinner(null);
  };

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
          Spinwheel
        </h1>
        <p className="mt-1 text-xs text-zinc-400">
          Roda putar buat milih nama/opsi secara acak.
        </p>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,320px)_1fr]">
        {/* Daftar */}
        <div className="flex flex-col gap-3 rounded-2xl border border-zinc-200 bg-white p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-zinc-600">
              Daftar (satu per baris)
            </span>
            <span className="text-xs text-zinc-400">{n} nama</span>
          </div>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            disabled={spinning}
            rows={12}
            spellCheck={false}
            placeholder={"Andi\nBudi\nCitra\nDewi"}
            className="w-full resize-y rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 outline-none transition-colors focus:border-brand-500 disabled:bg-zinc-50 disabled:text-zinc-400"
          />
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={fillFromUsers}
              disabled={loadingUsers || spinning}
              className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 px-2.5 py-2 text-xs font-medium text-zinc-600 transition-colors hover:bg-zinc-50 disabled:opacity-50"
            >
              <Users size={13} />{" "}
              {loadingUsers ? "Memuat…" : "Isi dari daftar user"}
            </button>
            {n > 0 && (
              <button
                type="button"
                disabled={spinning}
                onClick={() => {
                  setText("");
                  setWinner(null);
                  setMsg("");
                }}
                className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 px-2.5 py-2 text-xs font-medium text-zinc-500 transition-colors hover:bg-zinc-50"
              >
                <X size={13} /> Kosongkan
              </button>
            )}
          </div>
          {msg && <p className="text-xs text-zinc-400">{msg}</p>}
        </div>

        {/* Wheel */}
        <div className="flex flex-col items-center gap-4 rounded-2xl border border-zinc-200 bg-white p-5">
          <div className="relative w-full max-w-[360px]">
            <div className="absolute left-1/2 top-0 z-10 -translate-x-1/2 -translate-y-px">
              <div className="h-0 w-0 border-x-[10px] border-t-[18px] border-x-transparent border-t-brand-600" />
            </div>
            <svg
              viewBox="0 0 320 320"
              className="w-full drop-shadow-sm"
              style={{
                transform: `rotate(${rotation}deg)`,
                transition: spinning
                  ? `transform ${SPIN_MS}ms cubic-bezier(0.16, 1, 0.3, 1)`
                  : "none",
              }}
              onTransitionEnd={settle}
            >
              <circle
                cx={CX}
                cy={CY}
                r={R + 4}
                fill="none"
                stroke="#e4e4e7"
                strokeWidth="3"
              />
              {n === 0 && (
                <>
                  <circle cx={CX} cy={CY} r={R} fill="#f4f4f5" />
                  <text
                    x={CX}
                    y={CY}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fill="#a1a1aa"
                    fontSize="13"
                  >
                    Isi nama dulu
                  </text>
                </>
              )}

              {n === 1 && (
                <>
                  <circle cx={CX} cy={CY} r={R} fill={COLORS[0]} />
                  <text
                    x={CX}
                    y={CY}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fill="#fff"
                    fontSize="15"
                    fontWeight="700"
                  >
                    {trunc(names[0])}
                  </text>
                </>
              )}

              {n > 1 &&
                names.map((name, i) => {
                  const start = i * seg;
                  const mid = start + seg / 2;
                  const flip = mid > 90 && mid < 270;
                  const ty = CY - R * 0.58;
                  const fs = Math.max(8, Math.min(13, 150 / n + 3));
                  return (
                    <g key={i}>
                      <path
                        d={sectorPath(start, start + seg)}
                        fill={COLORS[i % COLORS.length]}
                        stroke="#fff"
                        strokeWidth="1.5"
                      />
                      {n <= 24 && (
                        <g
                          transform={`rotate(${mid} ${CX} ${CY})${
                            flip ? ` rotate(180 ${CX} ${ty})` : ""
                          }`}
                        >
                          <text
                            x={CX}
                            y={ty}
                            textAnchor="middle"
                            dominantBaseline="middle"
                            fill="#fff"
                            fontSize={fs}
                            fontWeight="600"
                          >
                            {trunc(name)}
                          </text>
                        </g>
                      )}
                    </g>
                  );
                })}

              {n > 0 && <circle cx={CX} cy={CY} r="11" fill="#fff" />}
            </svg>
          </div>

          <button
            type="button"
            onClick={spin}
            disabled={spinning || n < 1}
            className="inline-flex items-center gap-2 rounded-xl bg-brand-500 px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-600 disabled:opacity-50"
          >
            <RotateCw size={16} className={spinning ? "animate-spin" : ""} />
            {spinning ? "Muter…" : "Putar"}
          </button>

          <div aria-live="polite" className="min-h-[2.25rem] text-center">
            {winner && (
              <div className="flex flex-wrap items-center justify-center gap-2">
                <span className="rounded-lg bg-emerald-50 px-3 py-1.5 text-sm font-bold text-emerald-700">
                  🎉 {winner}
                </span>
                <button
                  type="button"
                  onClick={dropWinner}
                  className="rounded-lg border border-zinc-200 px-2 py-1.5 text-xs font-medium text-zinc-500 transition-colors hover:bg-zinc-50"
                >
                  Buang dari daftar
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
