import { Suspense, lazy, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { getCourse } from "../lib/courses";
import Skeleton from "../components/ui/Skeleton";

const Markdown = lazy(() => import("../components/ui/Markdown"));

export default function MateriContentPage() {
  const { courseId, lessonId } = useParams();
  const [state, setState] = useState({ status: "loading" });

  useEffect(() => {
    let alive = true;
    getCourse(courseId)
      .then((course) => {
        if (!alive) return;
        if (!course) return setState({ status: "not-found" });
        const lesson = course.sections
          .flatMap((s) => s.items)
          .find((i) => i.id === lessonId);
        if (!lesson) return setState({ status: "not-found" });
        setState({ status: "ready", course, lesson });
      })
      .catch((err) => {
        if (!alive) return;
        console.error("[MateriContentPage] gagal memuat:", err);
        setState({ status: "error" });
      });
    return () => {
      alive = false;
    };
  }, [courseId, lessonId]);

  const backLink = (
    <Link
      to={`/course/${courseId}/materi`}
      className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-500 transition-colors hover:text-zinc-800"
    >
      <ArrowLeft size={14} /> Kembali ke materi
    </Link>
  );

  if (state.status === "loading")
    return (
      <div className="mx-auto flex max-w-2xl flex-col gap-4">
        <Skeleton className="h-3 w-32" />
        <Skeleton className="h-6 w-2/3" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );

  if (state.status !== "ready")
    return (
      <div className="mx-auto max-w-2xl">
        {backLink}
        <p className="mt-4 text-sm text-zinc-500">
          {state.status === "not-found"
            ? "Materi tidak ditemukan."
            : "Gagal memuat materi."}
        </p>
      </div>
    );

  const { course, lesson } = state;

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-5">
      {backLink}

      <div>
        <p className="text-xs text-zinc-400">{course.title}</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-zinc-900">
          {lesson.title}
        </h1>
      </div>

      {lesson.content ? (
        <div className="rounded-2xl border border-zinc-200/80 bg-white px-6 py-5">
          <Suspense
            fallback={<Skeleton className="h-40 w-full rounded" />}
          >
            <Markdown className="text-sm text-zinc-700">
              {lesson.content}
            </Markdown>
          </Suspense>
        </div>
      ) : (
        <p className="rounded-2xl border border-dashed border-zinc-300 bg-white px-6 py-10 text-center text-sm text-zinc-400">
          Materi belum tersedia.
        </p>
      )}
    </div>
  );
}
