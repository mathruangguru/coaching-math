import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { getCourses, deleteCourse } from "../../lib/courses";
import SubjectIcon from "../../components/ui/SubjectIcon";
import Skeleton from "../../components/ui/Skeleton";

export default function AdminCoursesPage() {
  const [courses, setCourses] = useState([]);
  const [status, setStatus] = useState("loading"); // loading | error | ready
  const [busyId, setBusyId] = useState(null);

  useEffect(() => {
    let alive = true;

    getCourses()
      .then((data) => {
        if (!alive) return;
        setCourses(data);
        setStatus("ready");
      })
      .catch((err) => {
        if (!alive) return;
        console.error("[admin] gagal memuat course:", err);
        setStatus("error");
      });

    return () => {
      alive = false;
    };
  }, []);

  const handleDelete = async (course) => {
    const ok = window.confirm(
      `Hapus course "${course.title}"?\nSemua section & lesson di dalamnya ikut terhapus.`
    );
    if (!ok) return;

    setBusyId(course.id);
    try {
      await deleteCourse(course.id);
      setCourses((prev) => prev.filter((c) => c.id !== course.id));
    } catch (err) {
      window.alert(`Gagal menghapus: ${err?.message ?? err}`);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-zinc-900">
            Course
          </h1>
          <p className="mt-1 text-xs text-zinc-400">Kelola katalog course.</p>
        </div>
        <Link
          to="/admin/course/new"
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-brand-500 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-brand-600"
        >
          <Plus size={14} /> Course baru
        </Link>
      </div>

      {status === "loading" && (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-[60px] w-full rounded-xl" />
          ))}
        </div>
      )}

      {status === "error" && (
        <p className="rounded-xl border border-dashed border-rose-300 bg-white px-6 py-10 text-center text-sm text-rose-500">
          Gagal memuat course. Coba muat ulang halaman.
        </p>
      )}

      {status === "ready" && courses.length === 0 && (
        <p className="rounded-xl border border-dashed border-zinc-300 bg-white px-6 py-10 text-center text-sm text-zinc-400">
          Belum ada course. Klik “Course baru” untuk menambah.
        </p>
      )}

      {status === "ready" && courses.length > 0 && (
        <ul className="flex flex-col gap-2">
          {courses.map((course) => (
            <li
              key={course.id}
              className="flex items-center gap-3 rounded-xl border border-zinc-200 bg-white px-4 py-3"
            >
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand-500">
                <SubjectIcon name={course.icon} size={17} />
              </span>

              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-zinc-900">
                  {course.title}
                </p>
                <p className="truncate text-xs text-zinc-400">{course.id}</p>
              </div>

              <Link
                to={`/admin/course/${course.id}`}
                className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 px-2.5 py-1.5 text-xs font-medium text-zinc-600 transition-colors hover:bg-zinc-50"
              >
                <Pencil size={12} /> Edit
              </Link>

              <button
                onClick={() => handleDelete(course)}
                disabled={busyId === course.id}
                className="inline-flex items-center gap-1 rounded-lg border border-rose-200 px-2.5 py-1.5 text-xs font-medium text-rose-600 transition-colors hover:bg-rose-50 disabled:opacity-50"
              >
                <Trash2 size={12} /> {busyId === course.id ? "…" : "Hapus"}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
