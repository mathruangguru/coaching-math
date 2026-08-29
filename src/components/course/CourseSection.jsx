import { useState } from "react";
import { ChevronDown, ExternalLink } from "lucide-react";
import LessonIcon from "../ui/LessonIcon";
import { lessonTypeLabels } from "../../lib/lessonTypes";

function LessonBody({ item }) {
  return (
    <>
      <LessonIcon
        type={item.type}
        size={15}
        className="mt-0.5 shrink-0 text-zinc-400 group-hover:text-brand-600"
      />

      <div className="flex min-w-0 flex-1 flex-col gap-0.5 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
        <span className="text-sm text-zinc-700 group-hover:text-brand-700">
          {item.title}
        </span>

        <span className="flex shrink-0 items-center gap-1 text-xs text-zinc-400">
          <span>
            {lessonTypeLabels[item.type]}
            {item.duration ? ` · ${item.duration}` : ""}
            {item.type === "soal" && " · segera"}
          </span>
          {(item.type === "meet" || item.type === "recording") && item.url && (
            <ExternalLink size={12} className="text-brand-500" />
          )}
        </span>
      </div>
    </>
  );
}

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
          {section.items.map((item) => {
            const isLink =
              (item.type === "meet" || item.type === "recording") && item.url;
            return (
              <li
                key={item.id}
                className="border-b border-zinc-100 last:border-b-0"
              >
                {isLink ? (
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group flex items-start gap-3 px-4 py-2.5 transition-colors hover:bg-brand-50/40"
                  >
                    <LessonBody item={item} />
                  </a>
                ) : (
                  <div className="flex items-start gap-3 px-4 py-2.5">
                    <LessonBody item={item} />
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
