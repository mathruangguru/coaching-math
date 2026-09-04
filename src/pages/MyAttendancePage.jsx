import { useEffect, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { ArrowLeft, Check, X } from "lucide-react";
import { useCourse } from "../hooks/useCourse";
import { getMyAttendanceDetail } from "../lib/sessions";
import Skeleton from "../components/ui/Skeleton";

export default function MyAttendancePage() {
  const { courseId } = useParams();
  const { status, course, canView } = useCourse(courseId);
  const [state, setState] = useState({ status: "loading", lessons: [] });

  useEffect(() => {
    if (status !== "ready" || !canView || !course) return;
    const lessons = (course.sections ?? [])
      .flatMap((s) => s.items ?? [])
      .filter((it) => it.type === "presensi")
      .map((it) => ({ id: it.id, title: it.title }));
    let alive = true;
    getMyAttendanceDetail(lessons)
      .then((data) => {
        if (alive) setState({ status: "ready", lessons: data });
      })
      .catch((err) => {
        console.error("[MyAttendancePage] gagal memuat presensi:", err);
        if (alive) setState({ status: "error", lessons: [] });
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

  const { lessons } = state;
  const allRounds = lessons.flatMap((l) => l.rounds);
  const attended = allRounds.filter((r) => r.attended).length;

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-5">
      <div>
        {backLink}
        <h1 className="mt-3 text-xl font-bold tracking-tight text-zinc-900">
          Kehadiran Saya
        </h1>
        <p className="mt-1 text-xs text-zinc-500">{course.title}</p>
      </div>

      {state.status === "loading" ? (
        <Skeleton className="h-40 w-full rounded-2xl" />
      ) : state.status === "error" ? (
        <p className="rounded-2xl border border-dashed border-rose-300 bg-white px-6 py-10 text-center text-sm text-rose-500">
          Gagal memuat presensi.
        </p>
      ) : lessons.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-zinc-300 bg-white px-6 py-12 text-center text-sm text-zinc-400">
          Belum ada presensi di course ini.
        </p>
      ) : (
        <>
          {allRounds.length > 0 && (
            <div className="rounded-2xl border border-zinc-200/80 bg-white p-5">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
                Total
              </p>
              <p className="mt-1 text-2xl font-bold text-zinc-900">
                {attended}
                <span className="text-base font-semibold text-zinc-400">
                  /{allRounds.length}
                </span>
              </p>
              <p className="mt-0.5 text-xs text-zinc-500">
                sesi presensi kamu hadiri
              </p>
            </div>
          )}
          <div className="flex flex-col gap-3">
            {lessons.map((l) => (
              <div
                key={l.lessonId}
                className="overflow-hidden rounded-2xl border border-zinc-200/80 bg-white"
              >
                <div className="border-b border-zinc-100 px-4 py-2.5">
                  <p className="text-sm font-bold text-zinc-900">{l.title}</p>
                </div>
                {l.rounds.length === 0 ? (
                  <p className="px-4 py-3 text-xs text-zinc-400">
                    Belum ada sesi presensi.
                  </p>
                ) : (
                  <ul className="divide-y divide-zinc-100">
                    {l.rounds.map((r) => (
                      <li
                        key={r.id}
                        className="flex items-center justify-between gap-3 px-4 py-2.5"
                      >
                        <span className="min-w-0 truncate text-sm text-zinc-700">
                          {r.label}
                        </span>
                        {r.attended ? (
                          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-600">
                            <Check size={12} strokeWidth={3} /> Hadir
                          </span>
                        ) : (
                          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-semibold text-zinc-400">
                            <X size={12} strokeWidth={3} /> Tidak hadir
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
