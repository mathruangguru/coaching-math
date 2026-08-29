import { useState } from "react";
import { ChevronDown, Check } from "lucide-react";
import LessonIcon from "../ui/LessonIcon";
import { lessonTypeLabels } from "../../lib/lessonTypes";

export default function CourseSection({ section, onToggleLesson }) {
  const [open, setOpen] = useState(true);
  const doneCount = section.items.filter((i) => i.done).length;

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
          {doneCount}/{section.items.length} selesai
        </span>
      </button>

      {open && (
        <ul className="border-t border-zinc-100">
          {section.items.map((item) => (
            <li
              key={item.id}
              className="flex items-center gap-3 border-b border-zinc-100 px-4 py-2.5 last:border-b-0"
            >
              <button
                onClick={() => onToggleLesson(section.id, item.id)}
                aria-pressed={item.done}
                aria-label={item.done ? "Tandai belum selesai" : "Tandai selesai"}
                className={`grid h-5 w-5 shrink-0 place-items-center rounded-full border-2 transition-colors ${
                  item.done
                    ? "border-brand-500 bg-brand-500 text-white"
                    : "border-zinc-300 text-transparent hover:border-brand-400"
                }`}
              >
                <Check size={11} strokeWidth={3.5} />
              </button>

              <LessonIcon
                type={item.type}
                size={15}
                className="shrink-0 text-zinc-400"
              />

              <span
                className={`flex-1 text-sm ${
                  item.done ? "text-zinc-400 line-through" : "text-zinc-700"
                }`}
              >
                {item.title}
              </span>

              <span className="shrink-0 text-xs text-zinc-400">
                {lessonTypeLabels[item.type]} · {item.duration}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
