import { useState } from "react";
import { Link } from "react-router-dom";
import { ChevronDown, ExternalLink, ArrowUpRight } from "lucide-react";
import LessonIcon from "../ui/LessonIcon";
import { lessonTypeLabels } from "../../lib/lessonTypes";

const typeTint = {
  materi: "bg-zinc-100 text-zinc-500",
  soal: "bg-amber-50 text-amber-600",
  meet: "bg-sky-50 text-sky-600",
  recording: "bg-teal-50 text-teal-600",
  form: "bg-violet-50 text-violet-600",
  presensi: "bg-emerald-50 text-emerald-600",
  refleksi: "bg-rose-50 text-rose-600",
};

function CardInner({ item, clickable }) {
  return (
    <>
      <span
        className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${
          typeTint[item.type] ?? "bg-zinc-100 text-zinc-500"
        }`}
      >
        <LessonIcon type={item.type} size={16} />
      </span>

      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold leading-snug text-zinc-900 group-hover:text-brand-700">
          {item.title}
        </p>
        <span className="mt-1 flex items-center gap-1 text-xs text-zinc-400">
          <span>
            {lessonTypeLabels[item.type]}
            {item.duration ? ` · ${item.duration}` : ""}
            {item.type === "soal" && !item.question_set_id && " · segera"}
            {item.type === "form" &&
              !item.form_id &&
              !item.url &&
              " · segera"}
            {item.type === "refleksi" && !item.form_id && " · segera"}
          </span>
          {item.publish_status && item.publish_status !== "all" && (
            <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] font-semibold text-zinc-500">
              Not publish
            </span>
          )}
          {clickable === "external" && (
            <ExternalLink size={12} className="text-brand-500" />
          )}
          {clickable === "internal" && (
            <ArrowUpRight size={13} className="text-brand-500" />
          )}
        </span>
      </div>
    </>
  );
}

const cardCls =
  "group flex items-start gap-3 rounded-xl border border-zinc-200/80 bg-white p-3.5 transition";
const clickableCls = " hover:border-zinc-300 hover:shadow-sm";

export default function CourseSection({ section, courseId }) {
  const [open, setOpen] = useState(true);

  return (
    <section>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 py-2 text-left"
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
        <div className="mt-2 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {section.items.map((item) => {
            const inAppForm =
              (item.type === "form" || item.type === "refleksi") &&
              item.form_id;
            const external =
              (item.type === "meet" || item.type === "form") &&
              item.url &&
              !inAppForm;
            const recording = item.type === "recording" && item.url;
            const quiz = item.type === "soal" && item.question_set_id;
            const presensi = item.type === "presensi";

            if (external) {
              return (
                <a
                  key={item.id}
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={cardCls + clickableCls}
                >
                  <CardInner item={item} clickable="external" />
                </a>
              );
            }
            if (recording || quiz || inAppForm || presensi) {
              const to = recording
                ? `/course/${courseId}/recording/${item.id}`
                : presensi
                  ? `/course/${courseId}/presensi/${item.id}`
                  : inAppForm
                    ? `/course/${courseId}/${item.type}/${item.id}`
                    : `/course/${courseId}/soal/${item.id}`;
              return (
                <Link key={item.id} to={to} className={cardCls + clickableCls}>
                  <CardInner item={item} clickable="internal" />
                </Link>
              );
            }
            return (
              <div key={item.id} className={cardCls}>
                <CardInner item={item} />
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
