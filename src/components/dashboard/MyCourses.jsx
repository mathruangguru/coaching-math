import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ListChecks, ArrowRight } from "lucide-react";
import { getCourses } from "../../lib/courses";
import { getMyEnrollments } from "../../lib/enroll";
import SubjectIcon from "../ui/SubjectIcon";
import Skeleton from "../ui/Skeleton";

export default function MyCourses() {
  const [courses, setCourses] = useState([]);
  const [status, setStatus] = useState("loading"); // loading | error | ready

  useEffect(() => {
    let alive = true;

    Promise.all([getCourses(), getMyEnrollments().catch(() => null)])
      .then(([list, mine]) => {
        if (!alive) return;
        setCourses(
          mine === null ? list : list.filter((c) => mine.includes(c.id))
        );
        setStatus("ready");
      })
      .catch((err) => {
        if (!alive) return;
        console.error("[MyCourses] gagal memuat:", err);
        setStatus("error");
      });

    return () => {
      alive = false;
    };
  }, []);

  return (
    <section className="rounded-3xl border border-zinc-200/80 bg-white p-5">
      <div className="flex items-center gap-2">
        <ListChecks size={17} className="text-zinc-500" />
        <h2 className="text-sm font-bold tracking-tight text-zinc-900">
          Course Saya
        </h2>
      </div>

      <div className="mt-4 flex flex-col gap-2">
        {status === "loading" &&
          Array.from({ length: 2 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-xl" />
          ))}

        {status === "error" && (
          <p className="rounded-xl border border-dashed border-rose-300 px-4 py-6 text-center text-sm text-rose-500">
            Gagal memuat course.
          </p>
        )}

        {status === "ready" && courses.length === 0 && (
          <p className="rounded-xl border border-dashed border-zinc-200 px-4 py-8 text-center text-sm text-zinc-400">
            Belum enroll course apa pun.{" "}
            <Link to="/course" className="font-semibold text-brand-600">
              Lihat katalog
            </Link>
          </p>
        )}

        {status === "ready" &&
          courses.map((course) => (
            <div
              key={course.id}
              className="flex flex-col gap-3 rounded-xl border border-zinc-200 px-4 py-3 sm:flex-row sm:items-center"
            >
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-sky-50 text-sky-600">
                <SubjectIcon name={course.icon} size={17} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-zinc-900">
                  {course.title}
                </p>
                <p className="truncate text-xs text-zinc-500">
                  {course.description}
                </p>
              </div>
              <Link
                to={`/course/${course.id}`}
                className="inline-flex w-fit shrink-0 items-center gap-1.5 rounded-lg bg-brand-500 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-brand-600"
              >
                Buka Course
                <ArrowRight size={13} strokeWidth={2.5} />
              </Link>
            </div>
          ))}
      </div>
    </section>
  );
}
