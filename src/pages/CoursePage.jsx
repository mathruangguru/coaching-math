import CourseCard from "../components/course/CourseCard";
import { myCourses } from "../data/mock";

export default function CoursePage() {
  return (
    <div className="mx-auto flex max-w-[1180px] flex-col gap-6">
      <div>
        <p className="text-xs text-zinc-500">Katalog Pembelajaran</p>
        <h1 className="mt-1 text-xl font-bold tracking-tight text-zinc-900">
          Course
        </h1>
        <p className="mt-1 text-xs text-zinc-400">
          {myCourses.length} course tersedia
        </p>
      </div>

      {myCourses.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-zinc-300 bg-white px-6 py-12 text-center text-sm text-zinc-400">
          Belum ada course.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {myCourses.map((course) => (
            <CourseCard key={course.id} course={course} />
          ))}
        </div>
      )}
    </div>
  );
}
