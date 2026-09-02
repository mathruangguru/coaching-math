import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { getCourse } from "../lib/courses";
import { googleSlidesEmbed } from "../lib/slides";
import Skeleton from "../components/ui/Skeleton";

export default function SlidePage() {
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
        console.error("[SlidePage] gagal memuat:", err);
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
        <Skeleton className="aspect-video w-full rounded-xl" />
      </div>
    );

  if (state.status !== "ready")
    return (
      <div className="mx-auto max-w-4xl">
        {backLink}
        <p className="mt-4 text-sm text-zinc-500">
          {state.status === "not-found"
            ? "Slide tidak ditemukan."
            : "Gagal memuat slide."}
        </p>
      </div>
    );

  const { course, lesson } = state;
  const embed = googleSlidesEmbed(lesson.url);

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-4">
      {backLink}

      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="text-xs text-zinc-400">{course.title}</p>
          <h1 className="mt-1 text-xl font-bold tracking-tight text-zinc-900">
            {lesson.title}
          </h1>
        </div>
        {lesson.url && (
          <a
            href={lesson.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-600 transition-colors hover:bg-zinc-50"
          >
            <ExternalLink size={13} /> Buka di Google Slides
          </a>
        )}
      </div>

      {embed ? (
        <div className="overflow-hidden rounded-xl border border-zinc-200 bg-zinc-50">
          <iframe
            src={embed}
            title={lesson.title}
            allowFullScreen
            className="aspect-video w-full"
          />
        </div>
      ) : lesson.url ? (
        <p className="rounded-xl border border-dashed border-zinc-300 bg-white px-6 py-10 text-center text-sm text-zinc-500">
          Link ini belum berupa Google Slides yang bisa ditampilkan di sini.{" "}
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
          Slide belum tersedia.
        </p>
      )}

      <p className="text-[11px] text-zinc-400">
        Slide harus dibagikan sebagai “Siapa saja yang memiliki link” agar bisa
        tampil di sini.
      </p>
    </div>
  );
}
