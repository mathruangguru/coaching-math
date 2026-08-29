import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { getCourse } from "../lib/courses";
import { getMyEnrollments, enroll } from "../lib/enroll";
import { useAuth } from "../context/auth-context";
import Skeleton from "../components/ui/Skeleton";
import CourseSection from "../components/course/CourseSection";

export default function CourseDetailPage() {
  const { courseId } = useParams();
  const { isAdmin } = useAuth();
  const [course, setCourse] = useState(null);
  const [sections, setSections] = useState([]);
  const [status, setStatus] = useState("loading"); // loading | error | not-found | ready
  const [enrolled, setEnrolled] = useState(true); // sampai kebukti belum
  const [enrolling, setEnrolling] = useState(false);

  useEffect(() => {
    let alive = true;

    Promise.all([getCourse(courseId), getMyEnrollments().catch(() => null)])
      .then(([data, mine]) => {
        if (!alive) return;
        if (!data) {
          setStatus("not-found");
          return;
        }
        setCourse(data);
        setSections(data.sections ?? []);
        setEnrolled(mine === null || mine.includes(courseId));
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

  const handleEnroll = async () => {
    setEnrolling(true);
    try {
      await enroll(courseId);
      setEnrolled(true);
    } catch (err) {
      window.alert(`Gagal enroll: ${err?.message ?? err}`);
    } finally {
      setEnrolling(false);
    }
  };

  if (status === "loading") {
    return (
      <div className="mx-auto flex max-w-[1180px] flex-col gap-6">
        <div>
          <Skeleton className="h-3 w-28" />
          <Skeleton className="mt-3 h-6 w-2/3" />
          <Skeleton className="mt-2 h-3 w-full max-w-md" />
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

  const canView = enrolled || isAdmin;
  // Materi draft/admin-only sudah disaring server-side buat murid; pertemuan
  // yang jadi kosong nggak usah ditampilkan.
  const visibleSections = sections.filter((s) => (s.items?.length ?? 0) > 0);

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
      </div>

      {!canView ? (
        <div className="rounded-2xl border border-zinc-200/80 bg-white px-6 py-10 text-center">
          <p className="text-sm font-semibold text-zinc-900">
            Kamu belum enroll di course ini
          </p>
          <p className="mt-1 text-xs text-zinc-500">
            Enroll dulu untuk membuka materinya.
          </p>
          <button
            type="button"
            onClick={handleEnroll}
            disabled={enrolling}
            className="mt-4 rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-600 disabled:opacity-50"
          >
            {enrolling ? "Mendaftar…" : "Enroll sekarang"}
          </button>
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
