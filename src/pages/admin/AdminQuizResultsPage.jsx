import { useEffect, useMemo, useState } from "react";
import { Search, ArrowLeft, ArrowRight, RotateCcw } from "lucide-react";
import { getUsers } from "../../lib/users";
import {
  getQuestionSets,
  getQuestionSetAdmin,
  getAllAttempts,
  getAllQuizProgress,
  deleteAttempt,
  toAnswerArray,
  sameAnswerSet,
} from "../../lib/quiz";
import Skeleton from "../../components/ui/Skeleton";

const keyOf = (q) => q.answers ?? [q.answer ?? 0];
const letters = (v) =>
  toAnswerArray(v)
    .map((i) => String.fromCharCode(65 + i))
    .join("") || "–";

function fullName(u) {
  return (
    [u.first_name, u.last_name].filter(Boolean).join(" ") || u.email || u.id
  );
}

function fmtDate(iso) {
  try {
    return new Date(iso).toLocaleDateString("id-ID", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return "";
  }
}

function fmtDur(sec) {
  if (sec == null) return null;
  const s = Math.max(0, Math.round(sec));
  const m = Math.floor(s / 60);
  return m > 0 ? `${m}m ${s % 60}d` : `${s}d`;
}

function fmtAgo(iso) {
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return "baru aja";
  if (m < 60) return `${m} mnt lalu`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} jam lalu`;
  return `${Math.round(h / 24)} hari lalu`;
}

const answeredOf = (ans) =>
  Object.values(ans ?? {}).filter((v) =>
    Array.isArray(v) ? v.length > 0 : v != null && v !== ""
  ).length;

function pct(score, total) {
  return total > 0 ? Math.round((score / total) * 100) : 0;
}

function avgPct(rows) {
  return rows.length
    ? Math.round(rows.reduce((s, a) => s + pct(a.score, a.total), 0) / rows.length)
    : 0;
}

function toneFor(p) {
  return p >= 70 ? "text-teal-600" : p >= 40 ? "text-amber-600" : "text-rose-600";
}

function ScorePill({ score, total }) {
  const p = pct(score, total);
  const tone =
    p >= 80
      ? "bg-teal-50 text-teal-700"
      : p >= 50
        ? "bg-amber-50 text-amber-700"
        : "bg-rose-50 text-rose-700";
  return (
    <span
      className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${tone}`}
    >
      {score}/{total} · {p}%
    </span>
  );
}

function RecapCard({ title, subtitle, big, onClick, cta }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex flex-col rounded-xl border border-zinc-200 bg-white p-4 text-left transition hover:border-zinc-300 hover:shadow-sm"
    >
      <p className="truncate text-sm font-bold text-zinc-900">{title}</p>
      <p className="mt-1 truncate text-xs text-zinc-400">{subtitle}</p>
      <p className="mt-3 text-2xl font-bold text-zinc-900">
        {big}
        <span className="text-sm font-semibold text-zinc-400">
          % rata-rata
        </span>
      </p>
      <span className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-brand-600">
        {cta}
        <ArrowRight
          size={13}
          strokeWidth={2.5}
          className="transition-transform group-hover:translate-x-0.5"
        />
      </span>
    </button>
  );
}

const th =
  "border border-zinc-100 px-2.5 py-1.5 text-xs font-semibold text-zinc-500";
const td = "border border-zinc-100 px-2.5 py-1.5";

function Cell({ chosen, keyArr }) {
  if (toAnswerArray(chosen).length === 0) {
    return (
      <td className={`${td} bg-zinc-50 text-center text-xs text-zinc-300`}>–</td>
    );
  }
  const ok = sameAnswerSet(chosen, keyArr);
  return (
    <td
      className={`${td} text-center text-xs font-bold ${
        ok ? "bg-teal-50 text-teal-700" : "bg-rose-50 text-rose-700"
      }`}
    >
      {letters(chosen)}
    </td>
  );
}

/**
 * Matrix: kolom = nomor soal, baris = attempt / sesi ongoing.
 * `ongoing` = [{ user_id, started_at, answers }] — ikut dihitung di
 * "% benar" dan diwarnai bener/salah, dipisah baris "Sedang mengerjakan".
 */
function ResultTable({
  questions,
  attempts,
  ongoing = [],
  showStudent,
  usersById,
  onReset,
  resetBusyId,
}) {
  const graded = [...attempts, ...ongoing];
  const stats = questions.map((q) => {
    const correct = graded.filter((a) =>
      sameAnswerSet(a.answers?.[q.id], keyOf(q))
    ).length;
    return graded.length ? Math.round((correct / graded.length) * 100) : 0;
  });

  const colCount =
    (showStudent ? 1 : 0) + 3 + questions.length + (onReset ? 1 : 0);

  if (graded.length === 0) {
    return (
      <p className="px-4 py-6 text-center text-xs text-zinc-400">
        Belum ada attempt.
      </p>
    );
  }

  return (
    <div className="no-scrollbar overflow-x-auto">
      <table className="min-w-full border-collapse">
        <thead>
          <tr className="bg-zinc-50 text-left">
            {showStudent && <th className={th}>Murid</th>}
            <th className={th}>Tgl</th>
            <th className={th}>Waktu</th>
            <th className={th}>Skor</th>
            {questions.map((_, i) => (
              <th key={i} className={`${th} text-center`}>
                {i + 1}
              </th>
            ))}
            {onReset && <th className={th} />}
          </tr>
          <tr className="bg-zinc-100/70 text-left">
            <th
              className={`${th} font-bold text-zinc-600`}
              colSpan={showStudent ? 4 : 3}
            >
              Kunci
            </th>
            {questions.map((q, i) => (
              <td
                key={i}
                className={`${td} text-center text-xs font-bold text-zinc-600`}
              >
                {letters(keyOf(q))}
              </td>
            ))}
            {onReset && <td className={td} />}
          </tr>
          <tr className="bg-white text-left">
            <th className={`${th} font-semibold`} colSpan={showStudent ? 4 : 3}>
              % benar
            </th>
            {stats.map((s, i) => (
              <td
                key={i}
                className={`${td} text-center text-[11px] font-bold ${toneFor(s)}`}
              >
                {s}%
              </td>
            ))}
            {onReset && <td className={td} />}
          </tr>
        </thead>
        <tbody>
          {attempts.map((a) => {
            const u = usersById?.get(a.user_id);
            return (
              <tr key={a.id}>
                {showStudent && (
                  <td
                    className={`${td} whitespace-nowrap text-sm text-zinc-700`}
                  >
                    {u ? fullName(u) : a.user_id}
                  </td>
                )}
                <td className={`${td} whitespace-nowrap text-xs text-zinc-400`}>
                  {fmtDate(a.created_at)}
                </td>
                <td
                  className={`${td} whitespace-nowrap text-xs ${
                    a.duration_sec != null ? "text-zinc-600" : "text-zinc-300"
                  }`}
                >
                  {a.duration_sec != null ? fmtDur(a.duration_sec) : "—"}
                </td>
                <td className={`${td} whitespace-nowrap`}>
                  <ScorePill score={a.score} total={a.total} />
                </td>
                {questions.map((q, i) => (
                  <Cell key={i} chosen={a.answers?.[q.id]} keyArr={keyOf(q)} />
                ))}
                {onReset && (
                  <td className={`${td} whitespace-nowrap`}>
                    <button
                      type="button"
                      onClick={() => onReset(a)}
                      disabled={resetBusyId === a.id}
                      className="inline-flex items-center gap-1 rounded-md border border-rose-200 px-2 py-1 text-xs font-medium text-rose-600 transition-colors hover:bg-rose-50 disabled:opacity-50"
                    >
                      <RotateCcw size={12} /> Reset
                    </button>
                  </td>
                )}
              </tr>
            );
          })}

          {ongoing.length > 0 && (
            <tr>
              <td
                colSpan={colCount}
                className="border border-zinc-100 bg-amber-50/70 px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.08em] text-amber-700"
              >
                Sedang mengerjakan · {ongoing.length}
              </td>
            </tr>
          )}
          {ongoing.map((p) => {
            const u = usersById?.get(p.user_id);
            return (
              <tr key={`prog:${p.user_id}`} className="bg-amber-50/20">
                {showStudent && (
                  <td
                    className={`${td} whitespace-nowrap text-sm text-zinc-700`}
                  >
                    {u ? fullName(u) : p.user_id}
                  </td>
                )}
                <td className={`${td} whitespace-nowrap text-xs text-amber-600`}>
                  mulai {fmtAgo(p.started_at)}
                </td>
                <td className={`${td} whitespace-nowrap text-xs text-zinc-300`}>
                  —
                </td>
                <td
                  className={`${td} whitespace-nowrap text-xs font-medium text-zinc-500`}
                >
                  {answeredOf(p.answers)}/{questions.length}
                </td>
                {questions.map((q, i) => (
                  <Cell key={i} chosen={p.answers?.[q.id]} keyArr={keyOf(q)} />
                ))}
                {onReset && <td className={td} />}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function PlainRows({ attempts, usersById, showStudent }) {
  return (
    <ul className="divide-y divide-zinc-100">
      {attempts.map((a) => {
        const u = usersById?.get(a.user_id);
        return (
          <li
            key={a.id}
            className="flex items-center justify-between gap-3 px-4 py-2"
          >
            <span className="min-w-0 flex-1 truncate text-sm text-zinc-700">
              {showStudent ? (u ? fullName(u) : a.user_id) : fmtDate(a.created_at)}
            </span>
            {showStudent && (
              <span className="shrink-0 text-xs text-zinc-400">
                {fmtDate(a.created_at)}
              </span>
            )}
            {a.duration_sec != null && (
              <span className="shrink-0 text-xs font-medium text-zinc-500">
                {fmtDur(a.duration_sec)}
              </span>
            )}
            <ScorePill score={a.score} total={a.total} />
          </li>
        );
      })}
    </ul>
  );
}

const optLetter = (i) => String.fromCharCode(65 + i);

/**
 * Analisis butir soal: tiap soal diranking dari % benar terendah, plus
 * sebaran jawaban (berapa % yang milih tiap opsi + yang ngosongin).
 * Cuma pakai attempt yang udah submit — sesi ongoing nggak dihitung.
 */
function QuestionAnalytics({ questions, attempts }) {
  const rows = useMemo(() => {
    const n = attempts.length;
    return questions
      .map((q, idx) => {
        const keyArr = keyOf(q);
        const opts = (q.options ?? []).map(() => 0);
        let correct = 0;
        let blank = 0;
        for (const a of attempts) {
          const picked = toAnswerArray(a.answers?.[q.id]);
          if (picked.length === 0) {
            blank += 1;
            continue;
          }
          if (sameAnswerSet(picked, keyArr)) correct += 1;
          for (const oi of picked)
            if (oi >= 0 && oi < opts.length) opts[oi] += 1;
        }
        return {
          id: q.id,
          num: idx + 1,
          prompt: (q.prompt ?? "").trim(),
          options: q.options ?? [],
          keyArr,
          n,
          correct,
          blank,
          opts,
          pct: n ? Math.round((correct / n) * 100) : 0,
        };
      })
      .sort((a, b) => a.pct - b.pct || a.num - b.num);
  }, [questions, attempts]);

  if (attempts.length === 0 || questions.length === 0) return null;

  return (
    <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white">
      <div className="border-b border-zinc-100 px-4 py-3">
        <p className="text-sm font-bold text-zinc-900">Analisis butir soal</p>
        <p className="mt-0.5 text-xs text-zinc-400">
          Diurut dari soal tersulit · {attempts.length} attempt selesai
        </p>
      </div>
      <ul className="divide-y divide-zinc-100">
        {rows.map((r) => (
          <li
            key={r.id}
            className="flex flex-col gap-2.5 px-4 py-3 sm:flex-row sm:gap-4"
          >
            <div className="flex items-start gap-2 sm:w-[44%]">
              <span className="mt-px inline-flex h-5 shrink-0 items-center rounded-md bg-zinc-100 px-1.5 text-[11px] font-bold text-zinc-500">
                #{r.num}
              </span>
              <p
                className="line-clamp-2 text-xs leading-relaxed text-zinc-600"
                title={r.prompt || undefined}
              >
                {r.prompt || "(tanpa teks)"}
              </p>
            </div>

            <div className="min-w-0 flex-1">
              <div className="mb-1.5 flex items-baseline gap-2">
                <span className={`text-sm font-bold ${toneFor(r.pct)}`}>
                  {r.pct}%
                </span>
                <span className="text-[11px] text-zinc-400">
                  {r.correct}/{r.n} benar
                  {r.blank > 0 && ` · ${r.blank} kosong`}
                </span>
              </div>
              <div className="flex flex-col gap-1">
                {r.options.map((opt, oi) => {
                  const isKey = r.keyArr.includes(oi);
                  const c = r.opts[oi] ?? 0;
                  const p = r.n ? Math.round((c / r.n) * 100) : 0;
                  return (
                    <div key={oi} className="flex items-center gap-2">
                      <span
                        className={`w-4 shrink-0 text-center text-[11px] font-bold ${
                          isKey ? "text-teal-600" : "text-zinc-400"
                        }`}
                      >
                        {optLetter(oi)}
                      </span>
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-zinc-100">
                        <div
                          className={`h-full rounded-full ${
                            isKey ? "bg-teal-500" : "bg-zinc-300"
                          }`}
                          style={{ width: `${p}%` }}
                        />
                      </div>
                      <span className="w-8 shrink-0 text-right text-[11px] tabular-nums text-zinc-400">
                        {p}%
                      </span>
                      <span className="w-8 shrink-0 text-[10px] font-semibold uppercase tracking-wide text-teal-600">
                        {isKey ? "kunci" : ""}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function BackLink({ children, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex w-fit items-center gap-1.5 text-xs font-medium text-zinc-500 transition-colors hover:text-zinc-800"
    >
      <ArrowLeft size={14} /> {children}
    </button>
  );
}

export default function AdminQuizResultsPage() {
  const [view, setView] = useState("set"); // set | user
  const [q, setQ] = useState("");
  const [selSet, setSelSet] = useState(null); // sid | null
  const [selUser, setSelUser] = useState(null); // uid | null
  const [resetBusyId, setResetBusyId] = useState(null);
  const [data, setData] = useState({ status: "loading" });

  const handleReset = async (attempt) => {
    const u = data.users?.find((x) => x.id === attempt.user_id);
    const who = u ? fullName(u) : attempt.user_id;
    if (
      !window.confirm(
        `Reset attempt ${who}? Dia bisa ngerjain set ini dari awal lagi.`
      )
    )
      return;
    setResetBusyId(attempt.id);
    try {
      await deleteAttempt(attempt.id);
      setData((d) => ({
        ...d,
        attempts: d.attempts.filter((a) => a.id !== attempt.id),
      }));
    } catch (err) {
      window.alert(`Gagal reset: ${err?.message ?? err}`);
    } finally {
      setResetBusyId(null);
    }
  };

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [sets, users, attempts, progressRaw] = await Promise.all([
          getQuestionSets(),
          getUsers(),
          getAllAttempts(),
          getAllQuizProgress().catch(() => []),
        ]);
        const setIds = [
          ...new Set(
            [
              ...attempts.map((a) => a.set_id),
              ...progressRaw.map((p) => p.set_id),
            ].filter(Boolean)
          ),
        ];
        const details = await Promise.all(
          setIds.map((id) => getQuestionSetAdmin(id).catch(() => null))
        );
        if (!alive) return;
        const setDetail = new Map();
        setIds.forEach((id, i) => setDetail.set(id, details[i]));
        // Buang yang sebenernya udah submit (baris progress nyasar).
        const done = new Set(
          attempts.map((a) => `${a.user_id}|${a.set_id}`)
        );
        const progress = progressRaw
          .filter((p) => !done.has(`${p.user_id}|${p.set_id}`))
          .sort((a, b) => new Date(a.started_at) - new Date(b.started_at));
        setData({ status: "ready", sets, users, attempts, setDetail, progress });
      } catch (err) {
        console.error("[admin] gagal memuat hasil soal:", err);
        if (alive) setData({ status: "error" });
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  // Auto-refresh data yang berubah cepat (attempt baru + sesi ongoing).
  // Cuma 2 query ringan, tiap 15 dtk, pas tab aktif — sisanya nggak dimuat ulang.
  useEffect(() => {
    if (data.status !== "ready") return;
    let alive = true;
    const tick = async () => {
      if (typeof document !== "undefined" && document.hidden) return;
      try {
        const [attempts, progressRaw] = await Promise.all([
          getAllAttempts(),
          getAllQuizProgress().catch(() => []),
        ]);
        if (!alive) return;
        const done = new Set(attempts.map((a) => `${a.user_id}|${a.set_id}`));
        const progress = progressRaw
          .filter((p) => !done.has(`${p.user_id}|${p.set_id}`))
          .sort((a, b) => new Date(a.started_at) - new Date(b.started_at));
        setData((d) =>
          d.status === "ready" ? { ...d, attempts, progress } : d
        );
      } catch {
        /* diem — coba lagi tick berikutnya */
      }
    };
    const id = setInterval(tick, 15000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [data.status]);

  const model = useMemo(() => {
    if (data.status !== "ready") return null;
    const usersById = new Map(data.users.map((u) => [u.id, u]));
    const setsById = new Map(data.sets.map((s) => [s.id, s]));
    const titleOf = (sid) => setsById.get(sid)?.title ?? "(set dihapus)";

    const bySet = new Map();
    const byUser = new Map();
    const byUserSet = new Map();
    for (const a of data.attempts) {
      const sk = a.set_id ?? "—";
      if (!bySet.has(sk)) bySet.set(sk, []);
      bySet.get(sk).push(a);
      if (!byUser.has(a.user_id)) byUser.set(a.user_id, []);
      byUser.get(a.user_id).push(a);
      const uk = `${a.user_id}|${sk}`;
      if (!byUserSet.has(uk)) byUserSet.set(uk, []);
      byUserSet.get(uk).push(a);
    }

    const setStats = new Map();
    for (const [sid, rows] of bySet) {
      setStats.set(sid, {
        title: titleOf(sid),
        students: new Set(rows.map((a) => a.user_id)).size,
        attempts: rows.length,
        avgPct: avgPct(rows),
      });
    }
    const userStats = new Map();
    for (const [uid, rows] of byUser) {
      userStats.set(uid, {
        setCount: new Set(rows.map((a) => a.set_id ?? "—")).size,
        attempts: rows.length,
        avgPct: avgPct(rows),
      });
    }

    return {
      usersById,
      setsById,
      titleOf,
      bySet,
      byUser,
      byUserSet,
      setStats,
      userStats,
      studentCount: byUser.size,
    };
  }, [data]);

  const needle = q.trim().toLowerCase();
  const switchView = (key) => {
    setView(key);
    setSelSet(null);
    setSelUser(null);
  };

  const inDetail =
    (view === "set" && selSet) || (view === "user" && selUser);

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-zinc-900">
          Hasil Soal
        </h1>
        <p className="mt-1 text-xs text-zinc-400">
          Rekap latihan soal. Klik kartu buat lihat jawaban per nomor. Data
          diperbarui otomatis tiap 15 detik.
        </p>
      </div>

      {data.status === "loading" && (
        <div className="grid gap-3 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 w-full rounded-xl" />
          ))}
        </div>
      )}

      {data.status === "error" && (
        <p className="rounded-xl border border-dashed border-rose-300 bg-white px-6 py-8 text-center text-sm text-rose-500">
          Gagal memuat hasil soal.
        </p>
      )}

      {data.status === "ready" && (
        <>
          {!inDetail && (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="inline-flex rounded-lg border border-zinc-200 bg-white p-0.5 text-xs font-semibold">
                {[
                  ["set", "Per set"],
                  ["user", "Per murid"],
                ].map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => switchView(key)}
                    className={`rounded-md px-3 py-1.5 transition-colors ${
                      view === key
                        ? "bg-brand-500 text-white"
                        : "text-zinc-500 hover:text-zinc-800"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <label className="relative flex-1 sm:max-w-xs">
                <Search
                  size={14}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400"
                />
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder={view === "set" ? "Cari set…" : "Cari murid…"}
                  className="w-full rounded-lg border border-zinc-300 py-2 pl-8 pr-3 text-sm text-zinc-900 outline-none transition-colors focus:border-brand-500"
                />
              </label>
            </div>
          )}

          {data.attempts.length === 0 && data.progress.length === 0 && (
            <p className="rounded-xl border border-dashed border-zinc-300 bg-white px-6 py-10 text-center text-sm text-zinc-400">
              Belum ada murid yang mengerjakan latihan soal.
            </p>
          )}

          {/* ── Per set: kartu ── */}
          {view === "set" &&
            !selSet &&
            (data.attempts.length > 0 || data.progress.length > 0) &&
            (() => {
              const ongoingBySet = new Map();
              for (const p of data.progress) {
                ongoingBySet.set(
                  p.set_id,
                  (ongoingBySet.get(p.set_id) ?? 0) + 1
                );
              }
              const cards = [
                ...[...model.setStats.entries()].map(([sid, s]) => ({
                  sid,
                  title: s.title,
                  students: s.students,
                  attempts: s.attempts,
                  avgPct: s.avgPct,
                  ongoing: ongoingBySet.get(sid) ?? 0,
                })),
                ...[...ongoingBySet.keys()]
                  .filter((sid) => !model.setStats.has(sid))
                  .map((sid) => ({
                    sid,
                    title: model.titleOf(sid),
                    students: 0,
                    attempts: 0,
                    avgPct: 0,
                    ongoing: ongoingBySet.get(sid),
                  })),
              ];
              return (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {cards
                    .filter((c) => c.title.toLowerCase().includes(needle))
                    .sort((a, b) => a.title.localeCompare(b.title))
                    .map((c) => (
                      <RecapCard
                        key={c.sid}
                        title={c.title}
                        subtitle={
                          (c.attempts > 0
                            ? `${c.students} murid · ${c.attempts} attempt`
                            : "belum ada yang submit") +
                          (c.ongoing ? ` · ${c.ongoing} lagi ngerjain` : "")
                        }
                        big={c.avgPct}
                        cta="Analisis Set Soal"
                        onClick={() => setSelSet(c.sid)}
                      />
                    ))}
                </div>
              );
            })()}

          {/* ── Per set: detail ── */}
          {view === "set" &&
            selSet &&
            (() => {
              const rows = model.bySet.get(selSet) ?? [];
              const detail = data.setDetail.get(selSet);
              const s = model.setStats.get(selSet);
              const doneUsers = new Set(rows.map((a) => a.user_id));
              const ongoing = data.progress.filter(
                (p) => p.set_id === selSet && !doneUsers.has(p.user_id)
              );
              return (
                <div className="flex flex-col gap-3">
                  <BackLink onClick={() => setSelSet(null)}>Semua set</BackLink>
                  <div>
                    <h2 className="text-sm font-bold text-zinc-900">
                      Analisis Set Soal — {model.titleOf(selSet)}
                    </h2>
                    <p className="mt-0.5 text-xs text-zinc-400">
                      {s
                        ? `${s.students} murid · ${s.attempts} attempt · rata-rata ${s.avgPct}%`
                        : "Belum ada yang submit."}
                      {ongoing.length > 0 &&
                        ` · ${ongoing.length} lagi ngerjain`}
                    </p>
                  </div>
                  <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white">
                    {detail?.questions?.length ? (
                      <ResultTable
                        questions={detail.questions}
                        attempts={rows}
                        ongoing={ongoing}
                        usersById={model.usersById}
                        showStudent
                        onReset={handleReset}
                        resetBusyId={resetBusyId}
                      />
                    ) : (
                      <PlainRows
                        attempts={rows}
                        usersById={model.usersById}
                        showStudent
                      />
                    )}
                  </div>
                  {detail?.questions?.length > 0 && rows.length > 0 && (
                    <QuestionAnalytics
                      questions={detail.questions}
                      attempts={rows}
                    />
                  )}
                </div>
              );
            })()}

          {/* ── Per murid: kartu ── */}
          {view === "user" && !selUser && data.attempts.length > 0 && (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {[...model.userStats.entries()]
                .map(([uid, s]) => ({ uid, s, u: model.usersById.get(uid) }))
                .filter(
                  ({ u, uid }) =>
                    (u ? fullName(u) : uid).toLowerCase().includes(needle) ||
                    (u?.email ?? "").toLowerCase().includes(needle)
                )
                .sort((a, b) =>
                  (a.u ? fullName(a.u) : a.uid).localeCompare(
                    b.u ? fullName(b.u) : b.uid
                  )
                )
                .map(({ uid, s, u }) => (
                  <RecapCard
                    key={uid}
                    title={u ? fullName(u) : uid}
                    subtitle={`${s.setCount} set · ${s.attempts} attempt`}
                    big={s.avgPct}
                    cta="Analisis Murid"
                    onClick={() => setSelUser(uid)}
                  />
                ))}
            </div>
          )}

          {/* ── Per murid: detail (rekap per set-nya dia) ── */}
          {view === "user" &&
            selUser &&
            (() => {
              const u = model.usersById.get(selUser);
              const s = model.userStats.get(selUser);
              const sets = [...model.byUserSet.entries()]
                .filter(([k]) => k.startsWith(`${selUser}|`))
                .map(([k, rows]) => {
                  const sid = k.slice(selUser.length + 1);
                  return {
                    sid,
                    rows,
                    detail: data.setDetail.get(sid),
                    title: model.titleOf(sid),
                  };
                })
                .sort((a, b) => a.title.localeCompare(b.title));
              return (
                <div className="flex flex-col gap-3">
                  <BackLink onClick={() => setSelUser(null)}>
                    Semua murid
                  </BackLink>
                  <div>
                    <h2 className="text-sm font-bold text-zinc-900">
                      Analisis Murid — {u ? fullName(u) : selUser}
                    </h2>
                    <p className="mt-0.5 text-xs text-zinc-400">
                      {u?.email ? `${u.email} · ` : ""}
                      {s?.setCount} set · {s?.attempts} attempt · rata-rata{" "}
                      {s?.avgPct}%
                    </p>
                  </div>
                  {sets.map(({ sid, rows, detail, title }) => (
                    <div
                      key={sid}
                      className="overflow-hidden rounded-xl border border-zinc-200 bg-white"
                    >
                      <div className="flex items-center justify-between gap-3 border-b border-zinc-100 px-4 py-2.5">
                        <p className="min-w-0 truncate text-sm font-bold text-zinc-900">
                          {title}
                        </p>
                        <span className="shrink-0 text-xs font-semibold text-zinc-500">
                          rata-rata {avgPct(rows)}% · {rows.length} attempt
                        </span>
                      </div>
                      {detail?.questions?.length ? (
                        <ResultTable
                          questions={detail.questions}
                          attempts={rows}
                          usersById={model.usersById}
                          onReset={handleReset}
                          resetBusyId={resetBusyId}
                        />
                      ) : (
                        <PlainRows
                          attempts={rows}
                          usersById={model.usersById}
                        />
                      )}
                    </div>
                  ))}
                </div>
              );
            })()}
        </>
      )}
    </div>
  );
}
