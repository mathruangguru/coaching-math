import { Link, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { useCourse } from "../hooks/useCourse";
import Skeleton from "../components/ui/Skeleton";
import CourseSection from "../components/course/CourseSection";

export default function CourseMateriPage() {
  const { courseId } = useParams();
  const { status, course, visibleSections, canView } = useCourse(courseId);

  const backToLobby = (
    <Link
      to={`/course/${courseId}`}
      className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-500 transition-colors hover:text-zinc-800"
    >
      <ArrowLeft size={14} /> Kembali ke course
    </Link>
  );

  if (status === "loading") {
    return (
      <div className="mx-auto flex max-w-[1180px] flex-col gap-6">
        <div>
          <Skeleton className="h-3 w-28" />
          <Skeleton className="mt-3 h-6 w-2/3" />
        </div>
        <div className="flex flex-col gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full rounded-2xl" />
          ))}
        </div>
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

  return (
    <div className="mx-auto flex max-w-[1180px] flex-col gap-6">
      <div>
        {backToLobby}
        <h1 className="mt-3 text-xl font-bold tracking-tight text-zinc-900">
          {course.title}
        </h1>
        <p className="mt-1 text-xs leading-relaxed text-zinc-500">Materi</p>
      </div>

      {!canView ? (
        <div className="rounded-2xl border border-zinc-200/80 bg-white px-6 py-10 text-center">
          <p className="text-sm font-semibold text-zinc-900">
            Kamu belum enroll di course ini
          </p>
          <p className="mt-1 text-xs text-zinc-500">
            Enroll dulu di halaman course untuk membuka materinya.
          </p>
          <Link
            to={`/course/${courseId}`}
            className="mt-4 inline-block rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-600"
          >
            Ke halaman course
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {visibleSections.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-zinc-300 bg-white px-6 py-12 text-center text-sm text-zinc-400">
              Belum ada materi di course ini.
            </p>
          ) : (
            visibleSections.map((section) => (
              <CourseSection
                key={section.id}
                section={section}
                courseId={courseId}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}
