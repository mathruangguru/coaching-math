import { useEffect, useState } from "react";
import CourseCard from "../components/course/CourseCard";
import Skeleton from "../components/ui/Skeleton";
import { getCourses } from "../lib/courses";

export default function CoursePage() {
  const [courses, setCourses] = useState([]);
  const [status, setStatus] = useState("loading"); // loading | error | ready

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
        console.error("[CoursePage] gagal memuat course:", err);
        setStatus("error");
      });

    return () => {
      alive = false;
    };
  }, []);

  return (
    <div className="mx-auto flex max-w-[1180px] flex-col gap-6">
      <div>
        <p className="text-xs text-zinc-500">Katalog Pembelajaran</p>
        <h1 className="mt-1 text-xl font-bold tracking-tight text-zinc-900">
          Course
        </h1>
        {status === "ready" && (
          <p className="mt-1 text-xs text-zinc-400">
            {courses.length} course tersedia
          </p>
        )}
      </div>

      {status === "loading" && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="flex flex-col rounded-2xl border border-zinc-200/80 bg-white p-5"
            >
              <Skeleton className="h-10 w-10 rounded-xl" />
              <Skeleton className="mt-4 h-4 w-3/4" />
              <Skeleton className="mt-2 h-3 w-full" />
              <Skeleton className="mt-1.5 h-3 w-4/5" />
              <Skeleton className="mt-4 h-3 w-24" />
            </div>
          ))}
        </div>
      )}

      {status === "error" && (
        <p className="rounded-2xl border border-dashed border-rose-300 bg-white px-6 py-12 text-center text-sm text-rose-500">
          Gagal memuat course. Coba muat ulang halaman.
        </p>
      )}

      {status === "ready" &&
        (courses.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-zinc-300 bg-white px-6 py-12 text-center text-sm text-zinc-400">
            Belum ada course.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {courses.map((course) => (
              <CourseCard key={course.id} course={course} />
            ))}
          </div>
        ))}
    </div>
  );
}
