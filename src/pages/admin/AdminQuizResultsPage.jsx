import { useEffect, useMemo, useState } from "react";
import { Search, ArrowLeft, ArrowRight } from "lucide-react";
import { getUsers } from "../../lib/users";
import {
  getQuestionSets,
  getQuestionSetAdmin,
  getAllAttempts,
} from "../../lib/quiz";
import Skeleton from "../../components/ui/Skeleton";

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

function Cell({ chosen, correct }) {
  if (chosen == null) {
    return (
      <td className={`${td} bg-zinc-50 text-center text-xs text-zinc-300`}>–</td>
    );
  }
  const ok = chosen === correct;
  return (
    <td
      className={`${td} text-center text-xs font-bold ${
        ok ? "bg-teal-50 text-teal-700" : "bg-rose-50 text-rose-700"
      }`}
    >
      {String.fromCharCode(65 + chosen)}
    </td>
  );
}

/** Matrix: kolom = nomor soal, baris = attempt, isi = huruf jawaban. */
function ResultTable({ questions, attempts, showStudent, usersById }) {
  const stats = questions.map((q) => {
    const correct = attempts.filter((a) => a.answers?.[q.id] === q.answer).length;
    return attempts.length
      ? Math.round((correct / attempts.length) * 100)
      : 0;
  });

  return (
    <div className="no-scrollbar overflow-x-auto">
      <table className="min-w-full border-collapse">
        <thead>
          <tr className="bg-zinc-50 text-left">
            {showStudent && <th className={th}>Murid</th>}
            <th className={th}>Tgl</th>
            <th className={th}>Skor</th>
            {questions.map((_, i) => (
              <th key={i} className={`${th} text-center`}>
                {i + 1}
              </th>
            ))}
          </tr>
          <tr className="bg-zinc-100/70 text-left">
            <th
              className={`${th} font-bold text-zinc-600`}
              colSpan={showStudent ? 3 : 2}
            >
              Kunci
            </th>
            {questions.map((q, i) => (
              <td
                key={i}
                className={`${td} text-center text-xs font-bold text-zinc-600`}
              >
                {String.fromCharCode(65 + (q.answer ?? 0))}
              </td>
            ))}
          </tr>
          <tr className="bg-white text-left">
            <th className={`${th} font-semibold`} colSpan={showStudent ? 3 : 2}>
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
                <td className={`${td} whitespace-nowrap`}>
                  <ScorePill score={a.score} total={a.total} />
                </td>
                {questions.map((q, i) => (
                  <Cell key={i} chosen={a.answers?.[q.id]} correct={q.answer} />
                ))}
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
            <ScorePill score={a.score} total={a.total} />
          </li>
        );
      })}
    </ul>
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
  const [data, setData] = useState({ status: "loading" });

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [sets, users, attempts] = await Promise.all([
          getQuestionSets(),
          getUsers(),
          getAllAttempts(),
        ]);
        const setIds = [
          ...new Set(attempts.map((a) => a.set_id).filter(Boolean)),
        ];
        const details = await Promise.all(
          setIds.map((id) => getQuestionSetAdmin(id).catch(() => null))
        );
        if (!alive) return;
        const setDetail = new Map();
        setIds.forEach((id, i) => setDetail.set(id, details[i]));
        setData({ status: "ready", sets, users, attempts, setDetail });
      } catch (err) {
        console.error("[admin] gagal memuat hasil soal:", err);
        if (alive) setData({ status: "error" });
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

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
          Rekap latihan soal. Klik kartu buat lihat jawaban per nomor.
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

          {data.attempts.length === 0 && (
            <p className="rounded-xl border border-dashed border-zinc-300 bg-white px-6 py-10 text-center text-sm text-zinc-400">
              Belum ada murid yang mengerjakan latihan soal.
            </p>
          )}

          {/* ── Per set: kartu ── */}
          {view === "set" && !selSet && data.attempts.length > 0 && (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {[...model.setStats.entries()]
                .filter(([, s]) => s.title.toLowerCase().includes(needle))
                .sort((a, b) => a[1].title.localeCompare(b[1].title))
                .map(([sid, s]) => (
                  <RecapCard
                    key={sid}
                    title={s.title}
                    subtitle={`${s.students} murid · ${s.attempts} attempt`}
                    big={s.avgPct}
                    cta="Analisis Set Soal"
                    onClick={() => setSelSet(sid)}
                  />
                ))}
            </div>
          )}

          {/* ── Per set: detail ── */}
          {view === "set" &&
            selSet &&
            (() => {
              const rows = model.bySet.get(selSet) ?? [];
              const detail = data.setDetail.get(selSet);
              const s = model.setStats.get(selSet);
              return (
                <div className="flex flex-col gap-3">
                  <BackLink onClick={() => setSelSet(null)}>Semua set</BackLink>
                  <div>
                    <h2 className="text-sm font-bold text-zinc-900">
                      Analisis Set Soal — {s?.title}
                    </h2>
                    <p className="mt-0.5 text-xs text-zinc-400">
                      {s?.students} murid · {s?.attempts} attempt · rata-rata{" "}
                      {s?.avgPct}%
                    </p>
                  </div>
                  <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white">
                    {detail?.questions?.length ? (
                      <ResultTable
                        questions={detail.questions}
                        attempts={rows}
                        usersById={model.usersById}
                        showStudent
                      />
                    ) : (
                      <PlainRows
                        attempts={rows}
                        usersById={model.usersById}
                        showStudent
                      />
                    )}
                  </div>
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
