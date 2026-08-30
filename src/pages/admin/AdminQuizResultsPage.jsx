import { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
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
  return (
    <div className="overflow-x-auto">
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
              {showStudent ? (u ? fullName(u) : a.user_id) : "Attempt"}
            </span>
            <span className="shrink-0 text-xs text-zinc-400">
              {fmtDate(a.created_at)}
            </span>
            <ScorePill score={a.score} total={a.total} />
          </li>
        );
      })}
    </ul>
  );
}

export default function AdminQuizResultsPage() {
  const [view, setView] = useState("set"); // set | user
  const [q, setQ] = useState("");
  const [data, setData] = useState({ status: "loading" }); // loading | error | ready

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

    const bySet = new Map();
    for (const a of data.attempts) {
      const k = a.set_id ?? "—";
      if (!bySet.has(k)) bySet.set(k, []);
      bySet.get(k).push(a);
    }

    const byUserSet = new Map();
    for (const a of data.attempts) {
      const k = `${a.user_id}|${a.set_id ?? "—"}`;
      if (!byUserSet.has(k)) byUserSet.set(k, []);
      byUserSet.get(k).push(a);
    }

    const students = new Set(data.attempts.map((a) => a.user_id));
    return { usersById, setsById, bySet, byUserSet, studentCount: students.size };
  }, [data]);

  const needle = q.trim().toLowerCase();

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-zinc-900">
          Hasil Soal
        </h1>
        <p className="mt-1 text-xs text-zinc-400">
          Jawaban tiap murid per nomor. Hijau benar, merah salah, – kosong.
        </p>
      </div>

      {data.status === "loading" && (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full rounded-xl" />
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
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="inline-flex rounded-lg border border-zinc-200 bg-white p-0.5 text-xs font-semibold">
              {[
                ["set", "Per set"],
                ["user", "Per murid"],
              ].map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setView(key)}
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

          <p className="text-xs text-zinc-400">
            {data.attempts.length} attempt · {model.studentCount} murid ·{" "}
            {model.bySet.size} set
          </p>

          {data.attempts.length === 0 && (
            <p className="rounded-xl border border-dashed border-zinc-300 bg-white px-6 py-10 text-center text-sm text-zinc-400">
              Belum ada murid yang mengerjakan latihan soal.
            </p>
          )}

          {view === "set" &&
            [...model.bySet.entries()]
              .map(([sid, rows]) => ({
                sid,
                rows,
                detail: data.setDetail.get(sid),
                title: model.setsById.get(sid)?.title ?? "(set dihapus)",
              }))
              .filter((g) => g.title.toLowerCase().includes(needle))
              .sort((a, b) => a.title.localeCompare(b.title))
              .map(({ sid, rows, detail, title }) => (
                <div
                  key={sid}
                  className="overflow-hidden rounded-xl border border-zinc-200 bg-white"
                >
                  <div className="flex items-center justify-between gap-3 border-b border-zinc-100 px-4 py-3">
                    <p className="min-w-0 truncate text-sm font-bold text-zinc-900">
                      {title}
                    </p>
                    <span className="shrink-0 rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-semibold text-zinc-500">
                      {rows.length} attempt
                    </span>
                  </div>
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
              ))}

          {view === "user" &&
            [...model.byUserSet.entries()]
              .map(([key, rows]) => {
                const [uid, sid] = key.split("|");
                return {
                  key,
                  rows,
                  user: model.usersById.get(uid),
                  uid,
                  detail: data.setDetail.get(sid),
                  setTitle: model.setsById.get(sid)?.title ?? "(set dihapus)",
                };
              })
              .filter(
                ({ user, uid }) =>
                  (user ? fullName(user) : uid)
                    .toLowerCase()
                    .includes(needle) ||
                  (user?.email ?? "").toLowerCase().includes(needle)
              )
              .sort((a, b) =>
                (a.user ? fullName(a.user) : a.uid).localeCompare(
                  b.user ? fullName(b.user) : b.uid
                )
              )
              .map(({ key, rows, user, uid, detail, setTitle }) => (
                <div
                  key={key}
                  className="overflow-hidden rounded-xl border border-zinc-200 bg-white"
                >
                  <div className="flex items-center justify-between gap-3 border-b border-zinc-100 px-4 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-zinc-900">
                        {user ? fullName(user) : uid}
                      </p>
                      <p className="truncate text-xs text-zinc-400">
                        {setTitle}
                      </p>
                    </div>
                    <span className="shrink-0 rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-semibold text-zinc-500">
                      {rows.length} attempt
                    </span>
                  </div>
                  {detail?.questions?.length ? (
                    <ResultTable
                      questions={detail.questions}
                      attempts={rows}
                      usersById={model.usersById}
                    />
                  ) : (
                    <PlainRows attempts={rows} usersById={model.usersById} />
                  )}
                </div>
              ))}
        </>
      )}
    </div>
  );
}
