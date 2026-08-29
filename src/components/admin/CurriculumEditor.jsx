import { useEffect, useState } from "react";
import { ChevronUp, ChevronDown, Plus, Trash2 } from "lucide-react";
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

const LESSON_TYPES = Object.keys(lessonTypeLabels);

const cell =
  "rounded-md border border-zinc-200 px-2 py-1 text-[13px] text-zinc-800 outline-none transition-colors focus:border-brand-500";

function move(arr, from, to) {
  const next = arr.slice();
  const [it] = next.splice(from, 1);
  next.splice(to, 0, it);
  return next;
}

function Reorder({ onUp, onDown, first, last, label }) {
  const btn =
    "grid h-4 w-5 place-items-center rounded text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700 disabled:opacity-25";
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

  return (
    <section className="flex flex-col gap-2.5">
      <div className="flex items-center gap-2">
        <h2 className="text-sm font-bold tracking-tight text-zinc-900">
          Kurikulum
        </h2>
        {saving && <span className="text-xs text-zinc-400">menyimpan…</span>}
      </div>

      {status === "loading" && <p className="text-xs text-zinc-400">Memuat…</p>}
      {status === "error" && (
        <p className="rounded-lg border border-dashed border-rose-300 bg-white px-4 py-5 text-center text-sm text-rose-500">
          Gagal memuat kurikulum.
        </p>
      )}

      {status === "ready" &&
        sections.map((section, si) => (
          <div
            key={section.id}
            className="overflow-hidden rounded-xl border border-zinc-200 bg-white"
          >
            {/* Section header */}
            <div className="flex items-center gap-1.5 border-b border-zinc-100 bg-zinc-50 px-2.5 py-1.5">
              <Reorder
                label="pertemuan"
                first={si === 0}
                last={si === sections.length - 1}
                onUp={() => moveSection(si, -1)}
                onDown={() => moveSection(si, 1)}
              />
              <input
                defaultValue={section.title}
                onBlur={(e) => renameSection(section.id, e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
                placeholder="Nama pertemuan"
                className="min-w-0 flex-1 rounded-md border border-transparent bg-transparent px-2 py-1 text-sm font-bold text-zinc-900 outline-none transition-colors hover:border-zinc-200 focus:border-brand-500 focus:bg-white"
              />
              <button
                type="button"
                onClick={() => removeSection(section)}
                aria-label="Hapus pertemuan"
                className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-zinc-400 transition-colors hover:bg-rose-50 hover:text-rose-500"
              >
                <Trash2 size={14} />
              </button>
            </div>

            {/* Lessons */}
            <ul>
              {section.items.map((lesson, li) => (
                <li
                  key={lesson.id}
                  className="flex items-center gap-1.5 border-b border-zinc-100 px-2.5 py-1.5 last:border-b-0"
                >
                  <Reorder
                    label="materi"
                    first={li === 0}
                    last={li === section.items.length - 1}
                    onUp={() => moveLesson(section, li, -1)}
                    onDown={() => moveLesson(section, li, 1)}
                  />

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
                      className={`${cell} w-[46%] shrink-0 sm:w-[108px]`}
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
                      className={`${cell} w-[46%] shrink-0 sm:order-last sm:w-[84px]`}
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
                      className={`${cell} order-last w-full sm:order-none sm:w-auto sm:flex-1`}
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() => removeLesson(section, lesson)}
                    aria-label="Hapus materi"
                    className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-zinc-400 transition-colors hover:bg-rose-50 hover:text-rose-500"
                  >
                    <Trash2 size={13} />
                  </button>
                </li>
              ))}
            </ul>

            <button
              type="button"
              onClick={() => addLesson(section)}
              className="flex w-full items-center gap-1.5 px-2.5 py-2 text-xs font-semibold text-brand-600 transition-colors hover:bg-brand-50/60"
            >
              <Plus size={13} /> Tambah materi
            </button>
          </div>
        ))}

      {status === "ready" && (
        <button
          type="button"
          onClick={addSection}
          className="inline-flex w-fit items-center gap-1.5 rounded-lg border border-dashed border-zinc-300 px-3 py-2 text-xs font-semibold text-zinc-600 transition-colors hover:border-zinc-400 hover:bg-zinc-50"
        >
          <Plus size={14} /> Tambah pertemuan
        </button>
      )}
    </section>
  );
}
