import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Download } from "lucide-react";
import { getCourse } from "../lib/courses";
import Skeleton from "../components/ui/Skeleton";

export default function ImagePage() {
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
        console.error("[ImagePage] gagal memuat:", err);
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
      <div className="mx-auto flex max-w-4xl flex-col gap-4">
        <Skeleton className="h-3 w-32" />
        <Skeleton className="h-6 w-2/3" />
        <Skeleton className="h-[60vh] w-full rounded-xl" />
      </div>
    );

  if (state.status !== "ready")
    return (
      <div className="mx-auto max-w-4xl">
        {backLink}
        <p className="mt-4 text-sm text-zinc-500">
          {state.status === "not-found"
            ? "Gambar tidak ditemukan."
            : "Gagal memuat gambar."}
        </p>
      </div>
    );

  const { course, lesson } = state;
  const canDownload = lesson.allow_download !== false;

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-4">
      {backLink}

      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs text-zinc-400">{course.title}</p>
          <h1 className="mt-1 text-xl font-bold tracking-tight text-zinc-900">
            {lesson.title}
          </h1>
        </div>
        {lesson.url && canDownload && (
          <a
            href={`${lesson.url}?download`}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs font-medium text-zinc-600 transition-colors hover:bg-zinc-50"
          >
            <Download size={13} /> Download
          </a>
        )}
      </div>

      {lesson.url ? (
        <>
          <div className="overflow-hidden rounded-xl border border-zinc-200 bg-zinc-100">
            <img
              src={lesson.url}
              alt={lesson.title}
              draggable={canDownload}
              onContextMenu={canDownload ? undefined : (e) => e.preventDefault()}
              className={`mx-auto block max-h-[80vh] w-auto max-w-full ${
                canDownload ? "" : "select-none"
              }`}
            />
          </div>
          {!canDownload && (
            <p className="text-[11px] text-zinc-400">
              Gambar ini untuk dilihat di sini.
            </p>
          )}
        </>
      ) : (
        <p className="rounded-xl border border-dashed border-zinc-300 bg-white px-6 py-10 text-center text-sm text-zinc-400">
          Gambar belum tersedia.
        </p>
      )}
    </div>
  );
}
