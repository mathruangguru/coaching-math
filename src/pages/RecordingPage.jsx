import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { getCourse } from "../lib/courses";
import { youtubeId } from "../lib/youtube";
import Skeleton from "../components/ui/Skeleton";

export default function RecordingPage() {
  const { courseId, lessonId } = useParams();
  const [state, setState] = useState({ status: "loading" });

  useEffect(() => {
    let alive = true;

    getCourse(courseId)
      .then((course) => {
        if (!alive) return;
        if (!course) {
          setState({ status: "not-found" });
          return;
        }
        const lesson = course.sections
          .flatMap((s) => s.items)
          .find((i) => i.id === lessonId);
        if (!lesson) {
          setState({ status: "not-found" });
          return;
        }
        setState({ status: "ready", course, lesson });
      })
      .catch((err) => {
        if (!alive) return;
        console.error("[RecordingPage] gagal memuat:", err);
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

  if (state.status === "loading") {
    return (
      <div className="mx-auto flex max-w-3xl flex-col gap-4">
        <Skeleton className="h-3 w-32" />
        <Skeleton className="h-6 w-2/3" />
        <Skeleton className="aspect-video w-full rounded-xl" />
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className="mx-auto max-w-3xl">
        {backLink}
        <p className="mt-4 text-sm text-zinc-500">Gagal memuat rekaman.</p>
      </div>
    );
  }

  if (state.status === "not-found") {
    return (
      <div className="mx-auto max-w-3xl">
        {backLink}
        <p className="mt-4 text-sm text-zinc-500">Rekaman tidak ditemukan.</p>
      </div>
    );
  }

  const { course, lesson } = state;
  const vid = youtubeId(lesson.url);

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4">
      {backLink}

      <div>
        <p className="text-xs text-zinc-400">{course.title}</p>
        <h1 className="mt-1 text-xl font-bold tracking-tight text-zinc-900">
          {lesson.title}
        </h1>
      </div>

      {vid ? (
        <div className="overflow-hidden rounded-xl border border-zinc-200 bg-black">
          <iframe
            src={`https://www.youtube-nocookie.com/embed/${vid}`}
            title={lesson.title}
            allow="encrypted-media; picture-in-picture; fullscreen"
            allowFullScreen
            className="aspect-video w-full"
          />
        </div>
      ) : lesson.url ? (
        <p className="rounded-xl border border-dashed border-zinc-300 bg-white px-6 py-10 text-center text-sm text-zinc-500">
          Link rekaman belum berupa video YouTube yang bisa diputar di sini.{" "}
          <a
            href={lesson.url}
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-brand-600"
          >
            Buka link
          </a>
        </p>
      ) : (
        <p className="rounded-xl border border-dashed border-zinc-300 bg-white px-6 py-10 text-center text-sm text-zinc-400">
          Rekaman belum tersedia.
        </p>
      )}
    </div>
  );
}
