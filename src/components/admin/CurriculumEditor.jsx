import { useEffect, useState } from "react";
import { ChevronUp, ChevronDown, Plus, Trash2, Layers } from "lucide-react";
import {
  getCourse,
  createSection,
  updateSection,
  deleteSection,
  reorderSections,
  createLesson,
  updateLesson,
  deleteLesson,
  reorderLessons,
} from "../../lib/courses";
import { lessonTypeLabels } from "../../lib/lessonTypes";
import LessonIcon from "../ui/LessonIcon";

const LESSON_TYPES = Object.keys(lessonTypeLabels);

const typeTint = {
  video: "bg-sky-50 text-sky-600",
  reading: "bg-zinc-100 text-zinc-500",
  exercise: "bg-amber-50 text-amber-600",
  quiz: "bg-teal-50 text-teal-600",
};

const bareInput =
  "min-w-0 rounded-md border border-transparent bg-transparent px-2 py-1 text-sm text-zinc-800 outline-none transition-colors hover:border-zinc-200 focus:border-brand-500 focus:bg-white";

function move(arr, from, to) {
  const next = arr.slice();
  const [it] = next.splice(from, 1);
  next.splice(to, 0, it);
  return next;
}

function Reorder({ onUp, onDown, first, last, label }) {
  const btn =
    "grid h-4 w-5 place-items-center rounded text-zinc-300 transition-colors hover:bg-zinc-100 hover:text-zinc-600 disabled:opacity-0";
  return (
    <div className="flex shrink-0 flex-col">
      <button
        type="button"
        className={btn}
        disabled={first}
        onClick={onUp}
        aria-label={`Naikkan ${label}`}
      >
        <ChevronUp size={13} />
      </button>
      <button
        type="button"
        className={btn}
        disabled={last}
        onClick={onDown}
        aria-label={`Turunkan ${label}`}
      >
        <ChevronDown size={13} />
      </button>
    </div>
  );
}

export default function CurriculumEditor({ courseId }) {
  const [sections, setSections] = useState([]);
  const [status, setStatus] = useState("loading"); // loading | error | ready
  const [saving, setSaving] = useState(false);

  const load = () => {
    setStatus("loading");
    getCourse(courseId)
      .then((data) => {
        setSections(data?.sections ?? []);
        setStatus("ready");
      })
      .catch((err) => {
        console.error("[admin] gagal memuat kurikulum:", err);
        setStatus("error");
      });
  };

  useEffect(() => {
    let alive = true;
    getCourse(courseId)
      .then((data) => {
        if (!alive) return;
        setSections(data?.sections ?? []);
        setStatus("ready");
      })
      .catch((err) => {
        if (!alive) return;
        console.error("[admin] gagal memuat kurikulum:", err);
        setStatus("error");
      });
    return () => {
      alive = false;
    };
  }, [courseId]);

  const run = async (fn) => {
    setSaving(true);
    try {
      await fn();
    } catch (err) {
      window.alert(`Gagal menyimpan: ${err?.message ?? err}`);
      load();
    } finally {
      setSaving(false);
    }
  };

  // ── Section ops ──────────────────────────────────────────────────
  const addSection = () =>
    run(async () => {
      const row = await createSection(courseId, {
        title: "Pertemuan baru",
        position: sections.length,
      });
      setSections((p) => [...p, { id: row.id, title: row.title, items: [] }]);
    });

  const renameSection = (id, title) =>
    run(() => updateSection(id, { title: title.trim() || "Tanpa judul" }));

  const removeSection = (section) => {
    if (
      !window.confirm(
        `Hapus "${section.title}" beserta ${section.items.length} materinya?`,
      )
    )
      return;
    run(async () => {
      await deleteSection(section.id);
      setSections((p) => p.filter((s) => s.id !== section.id));
    });
  };

  const moveSection = (index, dir) => {
    const to = index + dir;
    if (to < 0 || to >= sections.length) return;
    const next = move(sections, index, to);
    setSections(next);
    run(() => reorderSections(next.map((s) => s.id)));
  };

  // ── Lesson ops ───────────────────────────────────────────────────
  const patchLesson = (sid, lid, patch) =>
    setSections((p) =>
      p.map((s) =>
        s.id !== sid
          ? s
          : {
              ...s,
              items: s.items.map((it) =>
                it.id === lid ? { ...it, ...patch } : it,
              ),
            },
      ),
    );

  const addLesson = (section) =>
    run(async () => {
      const row = await createLesson(section.id, {
        type: "video",
        title: "Materi baru",
        duration: "",
        position: section.items.length,
      });
      setSections((p) =>
        p.map((s) =>
          s.id !== section.id ? s : { ...s, items: [...s.items, row] },
        ),
      );
    });

  const saveLesson = (lesson) =>
    run(() =>
      updateLesson(lesson.id, {
        type: lesson.type,
        title: lesson.title.trim() || "Tanpa judul",
        duration: lesson.duration,
      }),
    );

  const removeLesson = (section, lesson) => {
    if (!window.confirm(`Hapus materi "${lesson.title}"?`)) return;
    run(async () => {
      await deleteLesson(lesson.id);
      setSections((p) =>
        p.map((s) =>
          s.id !== section.id
            ? s
            : { ...s, items: s.items.filter((it) => it.id !== lesson.id) },
        ),
      );
    });
  };

  const moveLesson = (section, index, dir) => {
    const to = index + dir;
    if (to < 0 || to >= section.items.length) return;
    const nextItems = move(section.items, index, to);
    setSections((p) =>
      p.map((s) => (s.id === section.id ? { ...s, items: nextItems } : s)),
    );
    run(() => reorderLessons(nextItems.map((it) => it.id)));
  };

  const totalLessons = sections.reduce((n, s) => n + s.items.length, 0);

  return (
    <div className="overflow-hidden rounded-2xl border border-zinc-200/80 bg-white">
      {/* Panel header */}
      <div className="flex items-center justify-between gap-3 border-b border-zinc-100 px-5 py-3">
        <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-zinc-400">
          Kurikulum
        </span>
        <div className="flex items-center gap-3 text-xs text-zinc-400">
          {saving && (
            <span className="inline-flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-brand-500" />
              menyimpan…
            </span>
          )}
          {status === "ready" && (
            <span>
              {sections.length} pertemuan · {totalLessons} materi
            </span>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-3 p-4 sm:p-5">
        {status === "loading" && (
          <p className="py-6 text-center text-xs text-zinc-400">Memuat…</p>
        )}
        {status === "error" && (
          <p className="rounded-lg border border-dashed border-rose-300 px-4 py-6 text-center text-sm text-rose-500">
            Gagal memuat kurikulum.
          </p>
        )}

        {status === "ready" && sections.length === 0 && (
          <p className="rounded-lg border border-dashed border-zinc-200 px-4 py-8 text-center text-sm text-zinc-400">
            Belum ada pertemuan.
          </p>
        )}

        {status === "ready" &&
          sections.map((section, si) => (
            <div
              key={section.id}
              className="group/section rounded-xl border border-zinc-200 bg-zinc-50/40"
            >
              {/* Section header */}
              <div className="flex items-center gap-2 px-3 py-2">
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-lg bg-zinc-900 text-xs font-bold text-white">
                  {si + 1}
                </span>
                <input
                  defaultValue={section.title}
                  onBlur={(e) => renameSection(section.id, e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
                  placeholder="Nama pertemuan"
                  className={`${bareInput} flex-1 text-sm font-bold text-zinc-900`}
                />
                <span className="shrink-0 text-[11px] text-zinc-400">
                  {section.items.length} materi
                </span>
                <div className="flex shrink-0 items-center opacity-100 transition-opacity sm:opacity-0 sm:group-hover/section:opacity-100 sm:group-focus-within/section:opacity-100">
                  <Reorder
                    label="pertemuan"
                    first={si === 0}
                    last={si === sections.length - 1}
                    onUp={() => moveSection(si, -1)}
                    onDown={() => moveSection(si, 1)}
                  />
                  <button
                    type="button"
                    onClick={() => removeSection(section)}
                    aria-label="Hapus pertemuan"
                    className="grid h-7 w-7 place-items-center rounded-md text-zinc-400 transition-colors hover:bg-rose-50 hover:text-rose-500"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>

              {/* Lessons */}
              <div className="rounded-lg border border-zinc-100 bg-white">
                {section.items.length === 0 && (
                  <p className="px-3 py-3 text-xs text-zinc-400">
                    Belum ada materi.
                  </p>
                )}

                {section.items.map((lesson, li) => (
                  <div
                    key={lesson.id}
                    className="group/row flex items-center gap-2 border-b border-zinc-100 px-2.5 py-1.5 last:border-b-0 hover:bg-zinc-50/70"
                  >
                    <div className="opacity-100 transition-opacity sm:opacity-0 sm:group-hover/row:opacity-100 sm:group-focus-within/row:opacity-100">
                      <Reorder
                        label="materi"
                        first={li === 0}
                        last={li === section.items.length - 1}
                        onUp={() => moveLesson(section, li, -1)}
                        onDown={() => moveLesson(section, li, 1)}
                      />
                    </div>

                    <span
                      className={`grid h-7 w-7 shrink-0 place-items-center rounded-md ${
                        typeTint[lesson.type] ?? "bg-zinc-100 text-zinc-500"
                      }`}
                    >
                      <LessonIcon type={lesson.type} size={14} />
                    </span>

                    <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5 sm:flex-nowrap">
                      <select
                        value={lesson.type}
                        onChange={(e) => {
                          const next = { ...lesson, type: e.target.value };
                          patchLesson(section.id, lesson.id, {
                            type: e.target.value,
                          });
                          saveLesson(next);
                        }}
                        className="shrink-0 rounded-md border border-zinc-200 bg-white px-1.5 py-1 text-xs text-zinc-600 outline-none focus:border-brand-500"
                      >
                        {LESSON_TYPES.map((t) => (
                          <option key={t} value={t}>
                            {lessonTypeLabels[t]}
                          </option>
                        ))}
                      </select>

                      <input
                        value={lesson.duration ?? ""}
                        onChange={(e) =>
                          patchLesson(section.id, lesson.id, {
                            duration: e.target.value,
                          })
                        }
                        onBlur={() => saveLesson(lesson)}
                        onKeyDown={(e) =>
                          e.key === "Enter" && e.currentTarget.blur()
                        }
                        placeholder="durasi"
                        className={`${bareInput} w-[46%] shrink-0 text-right text-xs text-zinc-500 sm:order-last sm:w-[84px]`}
                      />

                      <input
                        value={lesson.title}
                        onChange={(e) =>
                          patchLesson(section.id, lesson.id, {
                            title: e.target.value,
                          })
                        }
                        onBlur={() => saveLesson(lesson)}
                        onKeyDown={(e) =>
                          e.key === "Enter" && e.currentTarget.blur()
                        }
                        placeholder="Judul materi"
                        className={`${bareInput} order-last w-full font-medium sm:order-none sm:w-auto sm:flex-1`}
                      />
                    </div>

                    <button
                      type="button"
                      onClick={() => removeLesson(section, lesson)}
                      aria-label="Hapus materi"
                      className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-zinc-300 transition-colors hover:bg-rose-50 hover:text-rose-500 sm:opacity-0 sm:group-hover/row:opacity-100 sm:group-focus-within/row:opacity-100"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}

                <button
                  type="button"
                  onClick={() => addLesson(section)}
                  className="flex w-full items-center gap-1.5 rounded-b-lg px-3 py-2 text-xs font-semibold text-brand-600 transition-colors hover:bg-brand-50/60"
                >
                  <Plus size={13} /> Tambah materi
                </button>
              </div>
            </div>
          ))}

        {status === "ready" && (
          <button
            type="button"
            onClick={addSection}
            className="flex items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-zinc-200 py-3 text-xs font-semibold text-zinc-500 transition-colors hover:border-brand-300 hover:bg-brand-50/30 hover:text-brand-600"
          >
            <Layers size={14} /> Tambah pertemuan
          </button>
        )}
      </div>
    </div>
  );
}
