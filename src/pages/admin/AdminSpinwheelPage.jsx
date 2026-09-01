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

const trunc = (s, n) => (s.length > n ? `${s.slice(0, Math.max(1, n - 1))}…` : s);

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

  // Label radial: dari deket hub ke arah pelek. Makin banyak nama, mulai
  // agak lebih jauh dari hub biar nggak numpuk.
  const hubGap = n ? Math.min(44, Math.max(22, n * 2)) : 22;
  const fontSize = n ? Math.max(9, Math.min(14, 150 / n + 4)) : 13;
  const maxChars = n
    ? Math.max(5, Math.floor((R - hubGap - 8) / (fontSize * 0.58)))
    : 20;

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

    // Sektor i berpusat di deg = i*seg (sektor digambar dari -seg/2), jadi
    // rotasi yang naruh pemenang di pointer atas = -w*seg.
    const desired = ((-(w * seg) % 360) + 360) % 360;
    const current = ((rotation % 360) + 360) % 360;
    const delta = (desired - current + 360) % 360;
    const jitter = (Math.random() - 0.5) * seg * 0.55;
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
                className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 px-2.5 py-2 text-xs font-medium text-zinc-500 transition-colors hover:bg-zinc-50 disabled:opacity-50"
              >
                <X size={13} /> Kosongkan
              </button>
            )}
          </div>
          {msg && <p className="text-xs text-zinc-400">{msg}</p>}
        </div>

        {/* Wheel */}
        <div className="flex flex-col items-center gap-5 rounded-2xl border border-zinc-200 bg-white p-5">
          <div className="relative w-full max-w-[380px]">
            {/* Pointer */}
            <div className="pointer-events-none absolute left-1/2 top-0 z-10 -translate-x-1/2">
              <div className="h-0 w-0 border-x-[15px] border-t-[26px] border-x-transparent border-t-slate-800 drop-shadow-[0_3px_2px_rgba(0,0,0,0.25)]" />
            </div>

            <svg
              viewBox="0 0 320 320"
              className="w-full drop-shadow-md"
              style={{
                transform: `rotate(${rotation}deg)`,
                transition: spinning
                  ? `transform ${SPIN_MS}ms cubic-bezier(0.16, 1, 0.3, 1)`
                  : "none",
              }}
              onTransitionEnd={settle}
            >
              {/* Bezel */}
              <circle
                cx={CX}
                cy={CY}
                r={R + 7}
                fill="#fff"
                stroke="#e4e4e7"
                strokeWidth="5"
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
                    fontSize="16"
                    fontWeight="700"
                    fill="#fff"
                  >
                    {trunc(names[0], 18)}
                  </text>
                </>
              )}

              {n > 1 &&
                names.map((name, i) => {
                  const mid = i * seg;
                  return (
                    <g key={i}>
                      <path
                        d={sectorPath(mid - seg / 2, mid + seg / 2)}
                        fill={COLORS[i % COLORS.length]}
                        stroke="#fff"
                        strokeWidth="2"
                      />
                      {n <= 16 && (
                        <g transform={`rotate(${mid} ${CX} ${CY})`}>
                          <text
                            x={CX}
                            y={CY}
                            dx={hubGap}
                            transform={`rotate(-90 ${CX} ${CY})`}
                            textAnchor="start"
                            dominantBaseline="middle"
                            fontSize={fontSize}
                            fontWeight="700"
                            fill="#fff"
                          >
                            {trunc(name, maxChars)}
                          </text>
                        </g>
                      )}
                    </g>
                  );
                })}

              {/* Tepi + hub */}
              {n > 0 && (
                <>
                  <circle
                    cx={CX}
                    cy={CY}
                    r={R}
                    fill="none"
                    stroke="#fff"
                    strokeWidth="3"
                  />
                  <circle cx={CX} cy={CY} r="16" fill="#fff" />
                  <circle
                    cx={CX}
                    cy={CY}
                    r="16"
                    fill="none"
                    stroke="#e4e4e7"
                    strokeWidth="2"
                  />
                  <circle cx={CX} cy={CY} r="4.5" fill="#94a3b8" />
                </>
              )}
            </svg>
          </div>

          <button
            type="button"
            onClick={spin}
            disabled={spinning || n < 1}
            className="inline-flex items-center gap-2 rounded-xl bg-brand-500 px-7 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-600 disabled:opacity-50"
          >
            <RotateCw size={16} className={spinning ? "animate-spin" : ""} />
            {spinning ? "Muter…" : "Putar"}
          </button>

          <div
            aria-live="polite"
            className="min-h-[6rem] w-full max-w-[380px] text-center"
          >
            {winner && (
              <div
                key={winner}
                className="spinwheel-pop rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-5"
              >
                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-emerald-500">
                  Pemenangnya
                </p>
                <p className="mt-1.5 break-words text-3xl font-extrabold leading-tight text-emerald-800 sm:text-4xl">
                  {winner}
                </p>
                <button
                  type="button"
                  onClick={dropWinner}
                  className="mt-4 rounded-lg border border-emerald-300 bg-white px-3 py-1.5 text-xs font-medium text-emerald-700 transition-colors hover:bg-emerald-100"
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
