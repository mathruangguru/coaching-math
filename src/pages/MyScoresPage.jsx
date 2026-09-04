import { useEffect, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { useCourse } from "../hooks/useCourse";
import { getMyAttemptsByLesson } from "../lib/quiz";
import Skeleton from "../components/ui/Skeleton";

const pct = (s, t) => (t ? Math.round((s / t) * 100) : 0);
const tone = (p) =>
  p >= 70 ? "text-teal-600" : p >= 40 ? "text-amber-600" : "text-rose-600";

export default function MyScoresPage() {
  const { courseId } = useParams();
  const { status, course, canView } = useCourse(courseId);
  const [state, setState] = useState({ status: "loading", rows: [] });

  useEffect(() => {
    if (status !== "ready" || !canView || !course) return;
    const lessons = (course.sections ?? [])
      .flatMap((s) => s.items ?? [])
      .filter((it) => it.type === "soal" && it.question_set_id)
      .map((it) => ({ id: it.id, title: it.title }));
    let alive = true;
    getMyAttemptsByLesson(lessons.map((l) => l.id))
      .then((byId) => {
        if (!alive) return;
        setState({
          status: "ready",
          rows: lessons.map((l) => ({ ...l, attempt: byId[l.id] ?? null })),
        });
      })
      .catch((err) => {
        console.error("[MyScoresPage] gagal memuat skor:", err);
        if (alive) setState({ status: "error", rows: [] });
      });
    return () => {
      alive = false;
    };
  }, [status, canView, course]);

  const backLink = (
    <Link
      to={`/course/${courseId}`}
      className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-500 transition-colors hover:text-zinc-800"
    >
      <ArrowLeft size={14} /> Kembali ke course
    </Link>
  );

  if (status === "loading") {
    return (
      <div className="mx-auto flex max-w-2xl flex-col gap-4">
        <Skeleton className="h-3 w-28" />
        <Skeleton className="h-7 w-2/3" />
        <Skeleton className="h-40 w-full rounded-2xl" />
      </div>
    );
  }

  if (status === "not-found" || status === "error") {
    return (
      <div className="mx-auto max-w-2xl">
        <p className="text-sm text-zinc-500">
          {status === "not-found"
            ? "Course tidak ditemukan. "
            : "Gagal memuat course. "}
          <Link to="/course" className="font-semibold text-brand-600">
            Kembali ke daftar
          </Link>
        </p>
      </div>
    );
  }

  if (!canView) return <Navigate replace to={`/course/${courseId}`} />;

  const { rows } = state;
  const done = rows.filter((r) => r.attempt);
  const sumS = done.reduce((n, r) => n + (r.attempt.score ?? 0), 0);
  const sumT = done.reduce((n, r) => n + (r.attempt.total ?? 0), 0);
  const avg = sumT ? Math.round((sumS / sumT) * 100) : null;

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-5">
      <div>
        {backLink}
        <h1 className="mt-3 text-xl font-bold tracking-tight text-zinc-900">
          Skor Saya
        </h1>
        <p className="mt-1 text-xs text-zinc-500">{course.title}</p>
      </div>

      {state.status === "loading" ? (
        <Skeleton className="h-40 w-full rounded-2xl" />
      ) : state.status === "error" ? (
        <p className="rounded-2xl border border-dashed border-rose-300 bg-white px-6 py-10 text-center text-sm text-rose-500">
          Gagal memuat skor.
        </p>
      ) : rows.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-zinc-300 bg-white px-6 py-12 text-center text-sm text-zinc-400">
          Belum ada latihan soal di course ini.
        </p>
      ) : (
        <>
          {avg != null && (
            <div className="rounded-2xl border border-zinc-200/80 bg-white p-5">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
                Rata-rata
              </p>
              <p className={`mt-1 text-2xl font-bold ${tone(avg)}`}>{avg}%</p>
              <p className="mt-0.5 text-xs text-zinc-500">
                {done.length} dari {rows.length} kuis dikerjakan
              </p>
            </div>
          )}
          <ul className="flex flex-col gap-2">
            {rows.map((r) => {
              const p = r.attempt
                ? pct(r.attempt.score, r.attempt.total)
                : null;
              return (
                <li
                  key={r.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-zinc-200/80 bg-white px-4 py-3"
                >
                  <span className="min-w-0 truncate text-sm font-medium text-zinc-800">
                    {r.title}
                  </span>
                  {r.attempt ? (
                    <span
                      className={`shrink-0 text-sm font-bold ${tone(p)}`}
                    >
                      {r.attempt.score}/{r.attempt.total}
                      <span className="ml-1.5 text-xs font-semibold text-zinc-400">
                        {p}%
                      </span>
                    </span>
                  ) : (
                    <span className="shrink-0 rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-semibold text-zinc-400">
                      Belum dikerjakan
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}
