import { ListChecks, PenLine, AlignLeft } from "lucide-react";
import { myCourses } from "../../data/mock";
import SubjectIcon from "../ui/SubjectIcon";

const columns = "grid grid-cols-[minmax(200px,1fr)_1.6fr]";

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

      {/* Table */}
      <div className="mt-4 overflow-x-auto">
        <div className="min-w-[560px]">
          {/* Column heads */}
          <div className={`${columns} text-xs font-medium text-zinc-400`}>
            <div className="flex items-center gap-1.5 pb-2.5">
              <PenLine size={13} /> Course
            </div>
            <div className="flex items-center gap-1.5 border-l border-zinc-100 pb-2.5 pl-5">
              <AlignLeft size={13} /> Description
            </div>
          </div>

          {/* Rows */}
          {myCourses.map((course) => (
            <div
              key={course.id}
              className={`${columns} items-center border-t border-zinc-100 text-sm transition-colors hover:bg-zinc-50/60`}
            >
              <div className="flex items-center gap-2.5 py-3.5 pr-4">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-zinc-100 text-zinc-500">
                  <SubjectIcon name={course.icon} size={16} />
                </span>
                <span className="font-medium text-zinc-900">{course.title}</span>
              </div>

              <div className="border-l border-zinc-100 py-3.5 pl-5 pr-4 text-sm leading-relaxed text-zinc-500">
                {course.description}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
