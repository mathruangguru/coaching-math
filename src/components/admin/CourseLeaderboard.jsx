import { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { getCourse } from "../../lib/courses";
import { getCourseEnrollments } from "../../lib/enroll";
import { getUsers } from "../../lib/users";
import { getCourseAttempts } from "../../lib/quiz";
import Skeleton from "../ui/Skeleton";

const fullName = (u) =>
  [u?.first_name, u?.last_name].filter(Boolean).join(" ") || u?.email || "";

const pct = (s, t) => (t > 0 ? Math.round((s / t) * 100) : 0);

const toneText = (p) =>
  p >= 70 ? "text-teal-600" : p >= 40 ? "text-amber-600" : "text-rose-600";

const fmtDur = (sec) => {
  if (sec == null) return "—";
  const s = Math.max(0, Math.round(sec));
  const m = Math.floor(s / 60);
  return m > 0 ? `${m}m ${s % 60}d` : `${s}d`;
};

const fmtDate = (iso) => {
  try {
    return new Date(iso).toLocaleDateString("id-ID", {
      day: "numeric",
      month: "short",
    });
  } catch {
    return "";
  }
};

// Ranking kompetisi (1,2,2,4): skor tertinggi dulu, seri -> yang lebih cepat,
// seri lagi -> yang submit lebih dulu.
const cmp = (a, b) => {
  if (b.pct !== a.pct) return b.pct - a.pct;
  const da = a.duration_sec == null ? Infinity : a.duration_sec;
  const db = b.duration_sec == null ? Infinity : b.duration_sec;
  if (da !== db) return da - db;
  return new Date(a.created_at) - new Date(b.created_at);
};

const RANK_TINT = {
  1: "bg-amber-100 text-amber-700 ring-amber-200",
  2: "bg-zinc-100 text-zinc-600 ring-zinc-200",
  3: "bg-orange-100 text-orange-700 ring-orange-200",
};

/**
 * Papan peringkat per latihan soal dalam satu course. Pilih soal di atas,
 * daftar di bawah diurut skor (attempt TERAKHIR tiap murid) — seri dipecah
 * pakai durasi lalu waktu submit.
 */
export default function CourseLeaderboard({ courseId }) {
  const [status, setStatus] = useState("loading"); // loading | error | empty | ready
  const [quizzes, setQuizzes] = useState([]); // [{ id, title }]
  const [selId, setSelId] = useState("");
  const [attemptsByLesson, setAttemptsByLesson] = useState(new Map()); // lessonId -> [rows]
  const [q, setQ] = useState("");
  const [topOnly, setTopOnly] = useState(true); // true = cuma tampilkan top 10

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const course = await getCourse(courseId);
        const items = (course?.sections ?? [])
          .flatMap((s) => s.items ?? [])
          .filter((it) => it.type === "soal" && it.question_set_id)
          .map((it) => ({ id: it.id, title: it.title || "Latihan soal" }));

        if (items.length === 0) {
          if (alive) {
            setQuizzes([]);
            setStatus("empty");
          }
          return;
        }

        const [enrollments, users, attempts] = await Promise.all([
          getCourseEnrollments(courseId),
          getUsers(),
          getCourseAttempts(items.map((i) => i.id)),
        ]);
        if (!alive) return;

        const usersById = new Map(users.map((u) => [u.id, u]));
        const enrolledIds = new Set(enrollments.map((e) => e.user_id));

        // attempts urut terbaru dulu -> ambil yang pertama ketemu per (user, lesson).
        const byLesson = new Map(items.map((i) => [i.id, new Map()]));
        for (const a of attempts) {
          const seen = byLesson.get(a.lesson_id);
          if (!seen || seen.has(a.user_id)) continue;
          seen.set(a.user_id, {
            uid: a.user_id,
            user: usersById.get(a.user_id) ?? null,
            enrolled: enrolledIds.has(a.user_id),
            score: a.score,
            total: a.total,
            pct: pct(a.score, a.total),
            duration_sec: a.duration_sec,
            created_at: a.created_at,
          });
        }

        const built = new Map(
          items.map((i) => [
            i.id,
            [...(byLesson.get(i.id)?.values() ?? [])].sort(cmp),
          ]),
        );

        setQuizzes(items);
        setAttemptsByLesson(built);
        setSelId((cur) => (built.has(cur) ? cur : items[0].id));
        setStatus("ready");
      } catch (err) {
        console.error("[admin] gagal memuat leaderboard:", err);
        if (alive) setStatus("error");
      }
    })();
    return () => {
      alive = false;
    };
  }, [courseId]);

  // Rank kompetisi (1,2,2,4): baris sudah urut cmp, baris dgn (pct,durasi)
  // sama dapat rank sama.
  const ranked = useMemo(() => {
    const list = attemptsByLesson.get(selId) ?? [];
    const out = [];
    for (let i = 0; i < list.length; i++) {
      const r = list[i];
      const prev = i > 0 ? list[i - 1] : null;
      const tie =
        prev && prev.pct === r.pct && prev.duration_sec === r.duration_sec;
      out.push({ ...r, rank: tie ? out[i - 1].rank : i + 1 });
    }
    return out;
  }, [attemptsByLesson, selId]);

  const needle = q.trim().toLowerCase();
  const canLimit = ranked.length > 10;
  const limited = topOnly && canLimit && !needle;
  const shown = needle
    ? ranked.filter(
        (r) =>
          fullName(r.user).toLowerCase().includes(needle) ||
          (r.user?.email ?? "").toLowerCase().includes(needle),
      )
    : limited
      ? ranked.filter((r) => r.rank <= 10)
      : ranked;

  const classAvg = ranked.length
    ? Math.round(ranked.reduce((s, r) => s + r.pct, 0) / ranked.length)
    : null;

  return (
    <div className="overflow-hidden rounded-2xl border border-zinc-200/80 bg-white">
      <div className="flex items-center justify-between gap-3 border-b border-zinc-100 px-5 py-3">
        <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-zinc-400">
          Leaderboard
        </span>
        {status === "ready" && ranked.length > 0 && (
          <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-semibold text-zinc-500">
            {ranked.length} murid
            {classAvg != null && ` · rata-rata ${classAvg}%`}
          </span>
        )}
      </div>

      <div className="p-5">
        {status === "loading" && (
          <div className="flex flex-col gap-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-11 w-full rounded-lg" />
            ))}
          </div>
        )}

        {status === "error" && (
          <p className="text-sm text-rose-500">Gagal memuat leaderboard.</p>
        )}

        {status === "empty" && (
          <p className="text-sm text-zinc-400">
            Belum ada latihan soal di course ini. Tambahin lewat editor
            kurikulum.
          </p>
        )}

        {status === "ready" && (
          <div className="flex flex-col gap-4">
            {/* Pemilih soal */}
            <div className="no-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
              {quizzes.map((qz) => {
                const active = qz.id === selId;
                const n = (attemptsByLesson.get(qz.id) ?? []).length;
                return (
                  <button
                    key={qz.id}
                    type="button"
                    onClick={() => setSelId(qz.id)}
                    className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                      active
                        ? "border-brand-500 bg-brand-50 text-brand-700"
                        : "border-zinc-200 text-zinc-500 hover:bg-zinc-50"
                    }`}
                  >
                    <span className="max-w-[180px] truncate align-middle">
                      {qz.title}
                    </span>
                    <span
                      className={`ml-1.5 rounded-full px-1.5 py-px text-[10px] ${
                        active ? "bg-brand-100 text-brand-600" : "bg-zinc-100 text-zinc-400"
                      }`}
                    >
                      {n}
                    </span>
                  </button>
                );
              })}
            </div>

            {ranked.length === 0 ? (
              <p className="text-sm text-zinc-400">
                Belum ada yang mengerjakan latihan ini.
              </p>
            ) : (
              <>
                {(ranked.length > 8 || canLimit) && (
                  <div className="flex flex-wrap items-center gap-2.5">
                    {ranked.length > 8 && (
                      <label className="relative min-w-[180px] flex-1 sm:max-w-xs">
                        <Search
                          size={14}
                          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400"
                        />
                        <input
                          value={q}
                          onChange={(e) => setQ(e.target.value)}
                          placeholder="Cari nama / email…"
                          className="w-full rounded-lg border border-zinc-300 py-2 pl-8 pr-3 text-sm text-zinc-900 outline-none transition-colors focus:border-brand-500"
                        />
                      </label>
                    )}
                    {canLimit && (
                      <div className="inline-flex shrink-0 rounded-lg border border-zinc-200 p-0.5 text-xs font-semibold">
                        {[
                          [true, "Top 10"],
                          [false, `Semua ${ranked.length}`],
                        ].map(([val, label]) => (
                          <button
                            key={label}
                            type="button"
                            onClick={() => setTopOnly(val)}
                            className={`rounded-md px-2.5 py-1 transition-colors ${
                              topOnly === val
                                ? "bg-brand-500 text-white"
                                : "text-zinc-500 hover:text-zinc-800"
                            }`}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                <ol className="flex flex-col gap-1.5">
                  {shown.map((r) => (
                    <li
                      key={r.uid}
                      className="flex items-center gap-3 rounded-xl border border-zinc-100 px-3 py-2"
                    >
                      <span
                        className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-bold ring-1 ring-inset ${
                          RANK_TINT[r.rank] ?? "bg-white text-zinc-400 ring-zinc-200"
                        }`}
                      >
                        {r.rank}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-zinc-800">
                          {fullName(r.user) || r.uid}
                          {!r.enrolled && (
                            <span className="ml-1.5 rounded bg-amber-50 px-1 py-px text-[10px] font-medium text-amber-600">
                              tidak enroll
                            </span>
                          )}
                        </p>
                        <p className="truncate text-[11px] text-zinc-400">
                          {fmtDur(r.duration_sec)} · {fmtDate(r.created_at)}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-sm font-bold text-zinc-800">
                          {r.score}
                          <span className="font-normal text-zinc-400">
                            /{r.total}
                          </span>
                        </p>
                        <p className={`text-[11px] font-semibold ${toneText(r.pct)}`}>
                          {r.pct}%
                        </p>
                      </div>
                    </li>
                  ))}
                  {shown.length === 0 && (
                    <li className="px-3 py-4 text-center text-xs text-zinc-400">
                      Nggak ada yang cocok.
                    </li>
                  )}
                </ol>

                <p className="text-[11px] text-zinc-400">
                  {limited && `Nampilin 10 teratas dari ${ranked.length}. `}
                  Dari attempt terakhir tiap murid. Seri dipecah pakai durasi,
                  lalu waktu submit.
                </p>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
