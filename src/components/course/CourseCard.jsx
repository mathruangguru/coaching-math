import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import SubjectIcon from "../ui/SubjectIcon";

const cardCls =
  "group flex flex-col rounded-2xl border border-zinc-200/80 bg-white p-5 transition hover:border-zinc-300 hover:shadow-sm";

function Inner({ course }) {
  return (
    <>
      <span className="grid h-10 w-10 place-items-center rounded-xl bg-sky-50 text-sky-600">
        <SubjectIcon name={course.icon} size={20} />
      </span>
      <h3 className="mt-4 text-sm font-bold tracking-tight text-zinc-900">
        {course.title}
      </h3>
      <p className="mt-1 text-xs leading-relaxed text-zinc-500">
        {course.description}
      </p>
    </>
  );
}

export default function CourseCard({ course, enrolled, enrolling, onEnroll }) {
  if (enrolled) {
    return (
      <Link to={`/course/${course.id}`} className={cardCls}>
        <Inner course={course} />
        <span className="mt-auto inline-flex w-fit items-center gap-1.5 pt-4 text-xs font-semibold text-brand-600">
          Buka Course
          <ArrowRight
            size={13}
            strokeWidth={2.5}
            className="transition-transform group-hover:translate-x-0.5"
          />
        </span>
      </Link>
    );
  }

  return (
    <div className={cardCls}>
      <Inner course={course} />
      <div className="mt-auto pt-4">
        <button
          type="button"
          onClick={() => onEnroll(course.id)}
          disabled={enrolling}
          className="w-fit rounded-lg bg-brand-500 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-brand-600 disabled:opacity-50"
        >
          {enrolling ? "Mendaftar…" : "Enroll"}
        </button>
      </div>
    </div>
  );
}
