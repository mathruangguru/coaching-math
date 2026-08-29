import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { getCourse } from "../lib/courses";
import Skeleton from "../components/ui/Skeleton";
import CourseSection from "../components/course/CourseSection";

export default function CourseDetailPage() {
  const { courseId } = useParams();
  const [course, setCourse] = useState(null);
  const [sections, setSections] = useState([]);
  const [status, setStatus] = useState("loading"); // loading | error | not-found | ready

  useEffect(() => {
    let alive = true;

    getCourse(courseId)
      .then((data) => {
        if (!alive) return;
        if (!data) {
          setStatus("not-found");
          return;
        }
        setCourse(data);
        setSections(data.sections ?? []);
        setStatus("ready");
      })
      .catch((err) => {
        if (!alive) return;
        console.error("[CourseDetailPage] gagal memuat course:", err);
        setStatus("error");
      });

    return () => {
      alive = false;
    };
  }, [courseId]);

  const { total, done } = useMemo(() => {
    const items = sections.flatMap((s) => s.items);
    return { total: items.length, done: items.filter((i) => i.done).length };
  }, [sections]);

  const toggleLesson = (sectionId, itemId) =>
    setSections((prev) =>
      prev.map((s) =>
        s.id !== sectionId
          ? s
          : {
              ...s,
              items: s.items.map((i) =>
                i.id === itemId ? { ...i, done: !i.done } : i
              ),
            }
      )
    );

  if (status === "loading") {
    return (
      <div className="mx-auto flex max-w-[1180px] flex-col gap-6">
        <div>
          <Skeleton className="h-3 w-28" />
          <Skeleton className="mt-3 h-6 w-2/3" />
          <Skeleton className="mt-2 h-3 w-full max-w-md" />
          <Skeleton className="mt-4 h-1.5 w-full max-w-sm" />
        </div>
        <div className="flex flex-col gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="mx-auto max-w-[1180px]">
        <p className="text-sm text-zinc-500">
          Gagal memuat course.{" "}
          <Link to="/course" className="font-semibold text-brand-600">
            Kembali ke daftar
          </Link>
        </p>
      </div>
    );
  }

  if (status === "not-found") {
    return (
      <div className="mx-auto max-w-[1180px]">
        <p className="text-sm text-zinc-500">
          Course tidak ditemukan.{" "}
          <Link to="/course" className="font-semibold text-brand-600">
            Kembali ke daftar
          </Link>
        </p>
      </div>
    );
  }

  const pct = total ? Math.round((done / total) * 100) : 0;

  return (
    <div className="mx-auto flex max-w-[1180px] flex-col gap-6">
      {/* Header */}
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

        {/* Progress */}
        <div className="mt-4 max-w-sm">
          <div className="flex items-center justify-between text-xs font-medium text-zinc-500">
            <span>
              {done}/{total} materi selesai
            </span>
            <span>{pct}%</span>
          </div>
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-zinc-200">
            <div
              className="h-full rounded-full bg-brand-500 transition-all"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      </div>

      {/* Curriculum */}
      <div className="flex flex-col gap-3">
        {sections.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-zinc-300 bg-white px-6 py-12 text-center text-sm text-zinc-400">
            Belum ada materi di course ini.
          </p>
        ) : (
          sections.map((section) => (
            <CourseSection
              key={section.id}
              section={section}
              onToggleLesson={toggleLesson}
            />
          ))
        )}
      </div>
    </div>
  );
}
