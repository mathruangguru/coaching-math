import { useEffect, useMemo, useState } from "react";
import { ListChecks, User, Search } from "lucide-react";
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
      className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${tone}`}
    >
      {score}/{total} · {p}%
    </span>
  );
}

const markTone = {
  ok: "bg-teal-100 text-teal-700",
  wrong: "bg-rose-100 text-rose-700",
  blank: "bg-zinc-100 text-zinc-400",
};
const markLabel = { ok: "benar", wrong: "salah", blank: "kosong" };

// Benar / salah / kosong per soal, urut posisi. `detail` dari getQuestionSetAdmin.
function marksFor(attempt, detail) {
  if (!detail?.questions?.length) return null;
  return detail.questions.map((q) => {
    const chosen = attempt.answers?.[q.id];
    if (chosen == null) return "blank";
    return chosen === q.answer ? "ok" : "wrong";
  });
}

function AttemptRow({ attempt, label, detail }) {
  const marks = marksFor(attempt, detail);
  return (
    <li className="border-b border-zinc-100 px-4 py-2.5 last:border-b-0">
      <div className="flex items-center justify-between gap-3">
        <span className="min-w-0 flex-1 truncate text-sm text-zinc-700">
          {label}
        </span>
        <span className="shrink-0 text-xs text-zinc-400">
          {fmtDate(attempt.created_at)}
        </span>
        <ScorePill score={attempt.score} total={attempt.total} />
      </div>
      {marks && (
        <div className="mt-2 flex flex-wrap gap-1">
          {marks.map((m, i) => (
            <span
              key={i}
              title={`Soal ${i + 1}: ${markLabel[m]}`}
              className={`grid h-5 w-5 place-items-center rounded text-[10px] font-semibold ${markTone[m]}`}
            >
              {i + 1}
            </span>
          ))}
        </div>
      )}
    </li>
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

  const grouped = useMemo(() => {
    if (data.status !== "ready") return null;
    const usersById = new Map(data.users.map((u) => [u.id, u]));
    const setsById = new Map(data.sets.map((s) => [s.id, s]));
    const bySet = new Map();
    const byUser = new Map();
    for (const a of data.attempts) {
      const sk = a.set_id ?? "—";
      if (!bySet.has(sk)) bySet.set(sk, []);
      bySet.get(sk).push(a);
      if (!byUser.has(a.user_id)) byUser.set(a.user_id, []);
      byUser.get(a.user_id).push(a);
    }
    return { usersById, setsById, bySet, byUser };
  }, [data]);

  const needle = q.trim().toLowerCase();

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-zinc-900">
          Hasil Soal
        </h1>
        <p className="mt-1 text-xs text-zinc-400">
          Skor + benar/salah per nomor tiap attempt latihan soal.
        </p>
      </div>

      {data.status === "loading" && (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-xl" />
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
            {data.attempts.length} attempt ·{" "}
            {grouped ? grouped.byUser.size : 0} murid ·{" "}
            {grouped ? grouped.bySet.size : 0} set
          </p>

          {data.attempts.length === 0 && (
            <p className="rounded-xl border border-dashed border-zinc-300 bg-white px-6 py-10 text-center text-sm text-zinc-400">
              Belum ada murid yang mengerjakan latihan soal.
            </p>
          )}

          {/* Legenda */}
          {data.attempts.length > 0 && (
            <div className="flex items-center gap-3 text-[11px] text-zinc-400">
              {["ok", "wrong", "blank"].map((m) => (
                <span key={m} className="inline-flex items-center gap-1">
                  <span className={`h-3 w-3 rounded ${markTone[m]}`} />
                  {markLabel[m]}
                </span>
              ))}
            </div>
          )}

          {view === "set" &&
            [...grouped.bySet.entries()]
              .map(([sid, rows]) => ({
                sid,
                rows,
                title: grouped.setsById.get(sid)?.title ?? "(set dihapus)",
              }))
              .filter((g) => g.title.toLowerCase().includes(needle))
              .sort((a, b) => a.title.localeCompare(b.title))
              .map(({ sid, rows, title }) => (
                <div
                  key={sid}
                  className="overflow-hidden rounded-xl border border-zinc-200 bg-white"
                >
                  <div className="flex items-center gap-2.5 px-4 py-3">
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-amber-50 text-amber-600">
                      <ListChecks size={15} />
                    </span>
                    <p className="min-w-0 flex-1 truncate text-sm font-bold text-zinc-900">
                      {title}
                    </p>
                    <span className="shrink-0 rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-semibold text-zinc-500">
                      {rows.length} attempt
                    </span>
                  </div>
                  <ul className="border-t border-zinc-100">
                    {rows.map((a) => (
                      <AttemptRow
                        key={a.id}
                        attempt={a}
                        detail={data.setDetail.get(a.set_id)}
                        label={
                          grouped.usersById.get(a.user_id)
                            ? fullName(grouped.usersById.get(a.user_id))
                            : a.user_id
                        }
                      />
                    ))}
                  </ul>
                </div>
              ))}

          {view === "user" &&
            data.users
              .filter(
                (u) =>
                  fullName(u).toLowerCase().includes(needle) ||
                  (u.email ?? "").toLowerCase().includes(needle)
              )
              .map((u) => ({ u, rows: grouped.byUser.get(u.id) ?? [] }))
              .filter(({ rows }) => rows.length > 0)
              .map(({ u, rows }) => (
                <div
                  key={u.id}
                  className="overflow-hidden rounded-xl border border-zinc-200 bg-white"
                >
                  <div className="flex items-center gap-2.5 px-4 py-3">
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-violet-50 text-violet-600">
                      <User size={15} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-zinc-900">
                        {fullName(u)}
                      </p>
                      {u.email && (
                        <p className="truncate text-xs text-zinc-400">
                          {u.email}
                        </p>
                      )}
                    </div>
                    <span className="shrink-0 rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-semibold text-zinc-500">
                      {rows.length} attempt
                    </span>
                  </div>
                  <ul className="border-t border-zinc-100">
                    {rows.map((a) => (
                      <AttemptRow
                        key={a.id}
                        attempt={a}
                        detail={data.setDetail.get(a.set_id)}
                        label={
                          grouped.setsById.get(a.set_id)?.title ??
                          "(set dihapus)"
                        }
                      />
                    ))}
                  </ul>
                </div>
              ))}
        </>
      )}
    </div>
  );
}
