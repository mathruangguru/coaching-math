import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, BookOpen, ArrowRight, Lock } from "lucide-react";
import { useCourse } from "../hooks/useCourse";
import Skeleton from "../components/ui/Skeleton";

export default function CourseLobbyPage() {
  const { courseId } = useParams();
  const {
    status,
    course,
    visibleSections,
    canView,
    enrolling,
    enrollLocked,
    handleEnroll,
  } = useCourse(courseId);
  const [passcode, setPasscode] = useState("");
  const [enrollErr, setEnrollErr] = useState("");

  const submitEnroll = async (e) => {
    e.preventDefault();
    setEnrollErr("");
    const res = await handleEnroll(enrollLocked ? passcode : undefined);
    if (!res.ok) setEnrollErr(res.error);
  };

  if (status === "loading") {
    return (
      <div className="mx-auto flex max-w-[1180px] flex-col gap-6">
        <div>
          <Skeleton className="h-3 w-28" />
          <Skeleton className="mt-3 h-7 w-2/3" />
          <Skeleton className="mt-2 h-3 w-full max-w-md" />
        </div>
        <Skeleton className="h-28 w-full max-w-sm rounded-2xl" />
      </div>
    );
  }

  if (status === "error" || status === "not-found") {
    return (
      <div className="mx-auto max-w-[1180px]">
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

  const totalMateri = visibleSections.reduce(
    (n, s) => n + (s.items?.length ?? 0),
    0
  );

  return (
    <div className="mx-auto flex max-w-[1180px] flex-col gap-6">
      <div>
        <Link
          to="/course"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-500 transition-colors hover:text-zinc-800"
        >
          <ArrowLeft size={14} /> Semua Course
        </Link>

        <h1 className="mt-3 text-xl font-bold tracking-tight text-zinc-900">
          {course.title}
        </h1>
        <p className="mt-1 text-xs leading-relaxed text-zinc-500">
          {course.description}
        </p>
      </div>

      {!canView ? (
        <form
          onSubmit={submitEnroll}
          className="mx-auto w-full max-w-sm rounded-2xl border border-zinc-200/80 bg-white px-6 py-10 text-center"
        >
          <p className="text-sm font-semibold text-zinc-900">
            Kamu belum enroll di course ini
          </p>
          <p className="mt-1 text-xs text-zinc-500">
            {enrollLocked
              ? "Course ini butuh passcode. Minta ke pengajar kamu."
              : "Enroll dulu untuk membuka isinya."}
          </p>

          {enrollLocked && (
            <div className="mt-4 flex items-center gap-2 rounded-lg border border-zinc-300 px-3 py-2 focus-within:border-brand-500">
              <Lock size={14} className="shrink-0 text-zinc-400" />
              <input
                value={passcode}
                onChange={(e) => setPasscode(e.target.value)}
                placeholder="Passcode"
                autoComplete="off"
                className="w-full text-sm text-zinc-900 outline-none placeholder:text-zinc-400"
              />
            </div>
          )}

          <button
            type="submit"
            disabled={enrolling || (enrollLocked && !passcode.trim())}
            className="mt-4 w-full rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-600 disabled:opacity-50"
          >
            {enrolling ? "Mendaftar…" : "Enroll sekarang"}
          </button>

          {enrollErr && (
            <p className="mt-2 text-xs text-rose-600">{enrollErr}</p>
          )}
        </form>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Link
            to="materi"
            className="group flex flex-col rounded-2xl border border-zinc-200/80 bg-white p-5 transition hover:border-zinc-300 hover:shadow-sm"
          >
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-sky-50 text-sky-600">
              <BookOpen size={20} />
            </span>
            <p className="mt-4 text-sm font-bold tracking-tight text-zinc-900">
              Materi
            </p>
            <p className="mt-1 text-xs text-zinc-500">
              {visibleSections.length} pertemuan · {totalMateri} materi
            </p>
            <span className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-brand-600">
              Lihat materi
              <ArrowRight
                size={13}
                strokeWidth={2.5}
                className="transition-transform group-hover:translate-x-0.5"
              />
            </span>
          </Link>
        </div>
      )}
    </div>
  );
}
