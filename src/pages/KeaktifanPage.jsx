import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Sparkles } from "lucide-react";
import { getCourse } from "../lib/courses";
import { activityKind, getMyActivityMarks } from "../lib/activity";
import Skeleton from "../components/ui/Skeleton";

export default function KeaktifanPage() {
  const { courseId, lessonId } = useParams();
  const [data, setData] = useState({ status: "loading" });

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const course = await getCourse(courseId);
        const lesson = course?.sections
          .flatMap((s) => s.items)
          .find((i) => i.id === lessonId);
        if (!alive) return;
        if (!lesson) return setData({ status: "not-found" });
        const marks = await getMyActivityMarks([lessonId]);
        if (!alive) return;
        setData({
          status: "ready",
          course,
          lesson,
          kind: activityKind(marks[lessonId]),
        });
      } catch (e) {
        console.error("[KeaktifanPage] gagal memuat:", e);
        if (alive) setData({ status: "error" });
      }
    })();
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

  if (data.status === "loading")
    return (
      <div className="mx-auto flex max-w-2xl flex-col gap-4">
        <Skeleton className="h-3 w-32" />
        <Skeleton className="h-6 w-2/3" />
        <Skeleton className="h-32 w-full rounded-2xl" />
      </div>
    );
  if (data.status !== "ready")
    return (
      <div className="mx-auto max-w-2xl">
        {backLink}
        <p className="mt-4 text-sm text-zinc-500">
          {data.status === "not-found"
            ? "Materi tidak ditemukan."
            : "Gagal memuat keaktifan."}
        </p>
      </div>
    );

  const { course, lesson, kind } = data;

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-5">
      {backLink}
      <div>
        <p className="text-xs text-zinc-400">{course.title}</p>
        <h1 className="mt-1 text-xl font-bold tracking-tight text-zinc-900">
          {lesson.title}
        </h1>
      </div>

      {kind ? (
        <div className="rounded-2xl border border-teal-200 bg-teal-50/50 p-6 text-center">
          <span className="mx-auto grid h-10 w-10 place-items-center rounded-full bg-teal-500 text-white">
            <Sparkles size={18} />
          </span>
          <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-teal-700">
            {kind.label}
          </p>
          <p className="mt-1 text-sm font-semibold text-zinc-900">
            {kind.sentence}.
          </p>
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-zinc-300 bg-white p-6 text-center">
          <p className="text-sm font-semibold text-zinc-700">
            Belum ada catatan keaktifan untukmu pada sesi ini.
          </p>
          <p className="mt-1 text-xs text-zinc-400">
            Keaktifan dicatat oleh pengajar — presentasi, tanya jawab, atau
            diskusi lewat chat.
          </p>
        </div>
      )}
    </div>
  );
}
