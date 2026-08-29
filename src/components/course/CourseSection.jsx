import { useState } from "react";
import { ChevronDown } from "lucide-react";
import LessonIcon from "../ui/LessonIcon";
import { lessonTypeLabels } from "../../lib/lessonTypes";

export default function CourseSection({ section }) {
  const [open, setOpen] = useState(true);

  return (
    <section className="overflow-hidden rounded-2xl border border-zinc-200/80 bg-white">
      {/* Section header (nama pertemuan) */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-zinc-50"
      >
        <ChevronDown
          size={16}
          className={`shrink-0 text-zinc-400 transition-transform ${
            open ? "" : "-rotate-90"
          }`}
        />
        <span className="flex-1 text-sm font-bold tracking-tight text-zinc-900">
          {section.title}
        </span>
        <span className="shrink-0 text-xs font-medium text-zinc-400">
          {section.items.length} materi
        </span>
      </button>

      {open && (
        <ul className="border-t border-zinc-100">
          {section.items.map((item) => (
            <li
              key={item.id}
              className="flex items-start gap-3 border-b border-zinc-100 px-4 py-2.5 last:border-b-0"
            >
              <LessonIcon
                type={item.type}
                size={15}
                className="mt-0.5 shrink-0 text-zinc-400"
              />

              <div className="flex min-w-0 flex-1 flex-col gap-0.5 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                <span className="text-sm text-zinc-700">{item.title}</span>

                <span className="shrink-0 text-xs text-zinc-400">
                  {lessonTypeLabels[item.type]}
                  {item.duration ? ` · ${item.duration}` : ""}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
