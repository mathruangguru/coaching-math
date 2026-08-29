import { useEffect, useMemo, useState } from "react";
import { BookOpen, User, Search } from "lucide-react";
import { getUsers } from "../../lib/users";
import { getCourses } from "../../lib/courses";
import { getAllEnrollments } from "../../lib/enroll";
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

export default function AdminEnrollmentsPage() {
  const [view, setView] = useState("course"); // course | user
  const [q, setQ] = useState("");
  const [data, setData] = useState({ status: "loading" }); // loading | error | ready

  useEffect(() => {
    let alive = true;
    Promise.all([getCourses(), getUsers(), getAllEnrollments()])
      .then(([courses, users, enrollments]) => {
        if (!alive) return;
        setData({ status: "ready", courses, users, enrollments });
      })
      .catch((err) => {
        console.error("[admin] gagal memuat enrollment:", err);
        if (alive) setData({ status: "error" });
      });
    return () => {
      alive = false;
    };
  }, []);

  const grouped = useMemo(() => {
    if (data.status !== "ready") return null;
    const usersById = new Map(data.users.map((u) => [u.id, u]));
    const coursesById = new Map(data.courses.map((c) => [c.id, c]));
    const byCourse = new Map(data.courses.map((c) => [c.id, []]));
    const byUser = new Map(data.users.map((u) => [u.id, []]));
    for (const e of data.enrollments) {
      if (byCourse.has(e.course_id)) byCourse.get(e.course_id).push(e);
      if (byUser.has(e.user_id)) byUser.get(e.user_id).push(e);
    }
    return { usersById, coursesById, byCourse, byUser };
  }, [data]);

  const needle = q.trim().toLowerCase();

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-zinc-900">
          Enrollment
        </h1>
        <p className="mt-1 text-xs text-zinc-400">
          Siapa enroll di course apa.
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
          Gagal memuat data enrollment.
        </p>
      )}

      {data.status === "ready" && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="inline-flex rounded-lg border border-zinc-200 bg-white p-0.5 text-xs font-semibold">
              {[
                ["course", "Per course"],
                ["user", "Per user"],
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
                placeholder={view === "course" ? "Cari course…" : "Cari user…"}
                className="w-full rounded-lg border border-zinc-300 py-2 pl-8 pr-3 text-sm text-zinc-900 outline-none transition-colors focus:border-brand-500"
              />
            </label>
          </div>

          <p className="text-xs text-zinc-400">
            {data.enrollments.length} enrollment · {data.courses.length} course ·{" "}
            {grouped
              ? [...grouped.byUser.values()].filter((r) => r.length > 0).length
              : 0}{" "}
            user enrolled
          </p>

          {view === "course" && (
            <div className="flex flex-col gap-2">
              {data.courses
                .filter((c) => c.title.toLowerCase().includes(needle))
                .map((course) => {
                  const rows = grouped.byCourse.get(course.id) ?? [];
                  return (
                    <div
                      key={course.id}
                      className="overflow-hidden rounded-xl border border-zinc-200 bg-white"
                    >
                      <div className="flex items-center gap-2.5 px-4 py-3">
                        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-sky-50 text-sky-600">
                          <BookOpen size={15} />
                        </span>
                        <p className="min-w-0 flex-1 truncate text-sm font-bold text-zinc-900">
                          {course.title}
                        </p>
                        <span className="shrink-0 rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-semibold text-zinc-500">
                          {rows.length} murid
                        </span>
                      </div>
                      {rows.length > 0 && (
                        <ul className="border-t border-zinc-100">
                          {rows.map((e) => {
                            const u = grouped.usersById.get(e.user_id);
                            return (
                              <li
                                key={e.user_id}
                                className="flex items-center justify-between gap-3 border-b border-zinc-100 px-4 py-2 last:border-b-0"
                              >
                                <span className="min-w-0 truncate text-sm text-zinc-700">
                                  {u ? fullName(u) : e.user_id}
                                  {u?.email && (
                                    <span className="ml-1.5 text-xs text-zinc-400">
                                      {u.email}
                                    </span>
                                  )}
                                </span>
                                <span className="shrink-0 text-xs text-zinc-400">
                                  {fmtDate(e.created_at)}
                                </span>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </div>
                  );
                })}
            </div>
          )}

          {view === "user" && (
            <div className="flex flex-col gap-2">
              {data.users
                .filter(
                  (u) =>
                    fullName(u).toLowerCase().includes(needle) ||
                    (u.email ?? "").toLowerCase().includes(needle)
                )
                .map((u) => {
                  const rows = grouped.byUser.get(u.id) ?? [];
                  return (
                    <div
                      key={u.id}
                      className="rounded-xl border border-zinc-200 bg-white px-4 py-3"
                    >
                      <div className="flex items-center gap-2.5">
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
                          {rows.length} course
                        </span>
                      </div>
                      {rows.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1.5 pl-[42px]">
                          {rows.map((e) => {
                            const c = grouped.coursesById.get(e.course_id);
                            return (
                              <span
                                key={e.course_id}
                                className="rounded-md bg-zinc-100 px-2 py-1 text-xs text-zinc-600"
                              >
                                {c ? c.title : e.course_id}
                              </span>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
