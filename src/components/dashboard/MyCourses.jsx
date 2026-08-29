import { ListChecks, PenLine, AlignLeft } from "lucide-react";
import { myCourses } from "../../data/mock";
import SubjectIcon from "../ui/SubjectIcon";

const row =
  "flex flex-col gap-1 border-t border-zinc-100 py-3 text-sm transition-colors hover:bg-zinc-50/60 sm:grid sm:grid-cols-[minmax(180px,1fr)_1.6fr] sm:items-center sm:gap-0";

export default function MyCourses() {
  return (
    <section className="rounded-3xl border border-zinc-200/80 bg-white p-5">
      {/* Header */}
      <div className="flex items-center gap-2">
        <ListChecks size={17} className="text-zinc-500" />
        <h2 className="text-sm font-bold tracking-tight text-zinc-900">
          My Courses
        </h2>
      </div>

      {/* Column heads — sm ke atas */}
      <div className="mt-4 hidden grid-cols-[minmax(180px,1fr)_1.6fr] text-xs font-medium text-zinc-400 sm:grid">
        <div className="flex items-center gap-1.5 pb-2.5">
          <PenLine size={13} /> Course
        </div>
        <div className="flex items-center gap-1.5 border-l border-zinc-100 pb-2.5 pl-5">
          <AlignLeft size={13} /> Description
        </div>
      </div>

      {/* Rows */}
      <div className="mt-2 sm:mt-0">
        {myCourses.map((course) => (
          <div key={course.id} className={row}>
            <div className="flex items-center gap-2.5 pr-4 sm:py-3.5">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-zinc-100 text-zinc-500">
                <SubjectIcon name={course.icon} size={16} />
              </span>
              <span className="font-medium text-zinc-900">{course.title}</span>
            </div>

            <div className="pl-[42px] pr-4 text-sm leading-relaxed text-zinc-500 sm:border-l sm:border-zinc-100 sm:py-3.5 sm:pl-5">
              {course.description}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
