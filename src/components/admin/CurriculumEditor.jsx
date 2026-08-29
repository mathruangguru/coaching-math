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

const inputCls =
  "w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 outline-none transition-colors focus:border-brand-500";
const iconBtn =
  "grid h-7 w-7 shrink-0 place-items-center rounded-md text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700 disabled:opacity-30";

function move(arr, from, to) {
  const next = arr.slice();
  const [it] = next.splice(from, 1);
  next.splice(to, 0, it);
  return next;
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

  // Jalankan op ke DB; kalau gagal -> alert + resync dari server.
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
      setSections((prev) => [...prev, { id: row.id, title: row.title, items: [] }]);
    });

  const renameSection = (id, title) =>
    run(() => updateSection(id, { title: title.trim() || "Tanpa judul" }));

  const removeSection = (section) => {
    if (
      !window.confirm(
        `Hapus "${section.title}" beserta ${section.items.length} materinya?`
      )
    )
      return;
    run(async () => {
      await deleteSection(section.id);
      setSections((prev) => prev.filter((s) => s.id !== section.id));
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
  const patchLessonLocal = (sid, lid, patch) =>
    setSections((prev) =>
      prev.map((s) =>
        s.id !== sid
          ? s
          : {
              ...s,
              items: s.items.map((it) =>
                it.id === lid ? { ...it, ...patch } : it
              ),
            }
      )
    );

  const addLesson = (section) =>
    run(async () => {
      const row = await createLesson(section.id, {
        type: "video",
        title: "Materi baru",
        duration: "",
        position: section.items.length,
      });
      setSections((prev) =>
        prev.map((s) =>
          s.id !== section.id ? s : { ...s, items: [...s.items, row] }
        )
      );
    });

  const saveLesson = (section, lesson) =>
    run(() =>
      updateLesson(lesson.id, {
        type: lesson.type,
        title: lesson.title.trim() || "Tanpa judul",
        duration: lesson.duration,
      })
    );

  const removeLesson = (section, lesson) => {
    if (!window.confirm(`Hapus materi "${lesson.title}"?`)) return;
    run(async () => {
      await deleteLesson(lesson.id);
      setSections((prev) =>
        prev.map((s) =>
          s.id !== section.id
            ? s
            : { ...s, items: s.items.filter((it) => it.id !== lesson.id) }
        )
      );
    });
  };

  const moveLesson = (section, index, dir) => {
    const to = index + dir;
    if (to < 0 || to >= section.items.length) return;
    const nextItems = move(section.items, index, to);
    setSections((prev) =>
      prev.map((s) => (s.id === section.id ? { ...s, items: nextItems } : s))
    );
    run(() => reorderLessons(nextItems.map((it) => it.id)));
  };

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold tracking-tight text-zinc-900">
          Kurikulum
        </h2>
        {saving && <span className="text-xs text-zinc-400">menyimpan…</span>}
      </div>

      {status === "loading" && (
        <p className="text-xs text-zinc-400">Memuat…</p>
      )}
      {status === "error" && (
        <p className="rounded-xl border border-dashed border-rose-300 bg-white px-4 py-6 text-center text-sm text-rose-500">
          Gagal memuat kurikulum.
        </p>
      )}

      {status === "ready" && (
        <>
          {sections.map((section, si) => (
            <div
              key={section.id}
              className="overflow-hidden rounded-2xl border border-zinc-200 bg-white"
            >
              {/* Section header */}
              <div className="flex items-center gap-2 border-b border-zinc-100 bg-zinc-50/60 px-3 py-2.5">
                <div className="flex shrink-0 flex-col">
                  <button
                    type="button"
                    className={iconBtn}
                    disabled={si === 0}
                    onClick={() => moveSection(si, -1)}
                    aria-label="Naikkan pertemuan"
                  >
                    <ChevronUp size={14} />
                  </button>
                  <button
                    type="button"
                    className={iconBtn}
                    disabled={si === sections.length - 1}
                    onClick={() => moveSection(si, 1)}
                    aria-label="Turunkan pertemuan"
                  >
                    <ChevronDown size={14} />
                  </button>
                </div>

                <input
                  defaultValue={section.title}
                  onBlur={(e) => renameSection(section.id, e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
                  className={`${inputCls} font-semibold`}
                  placeholder="Nama pertemuan"
                />

                <button
                  type="button"
                  onClick={() => removeSection(section)}
                  aria-label="Hapus pertemuan"
                  className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-rose-500 transition-colors hover:bg-rose-50"
                >
                  <Trash2 size={14} />
                </button>
              </div>

              {/* Lessons */}
              <ul className="flex flex-col">
                {section.items.map((lesson, li) => (
                  <li
                    key={lesson.id}
                    className="flex flex-wrap items-center gap-2 border-b border-zinc-100 px-3 py-2 last:border-b-0"
                  >
                    <div className="flex shrink-0 flex-col">
                      <button
                        type="button"
                        className={iconBtn}
                        disabled={li === 0}
                        onClick={() => moveLesson(section, li, -1)}
                        aria-label="Naikkan materi"
                      >
                        <ChevronUp size={14} />
                      </button>
                      <button
                        type="button"
                        className={iconBtn}
                        disabled={li === section.items.length - 1}
                        onClick={() => moveLesson(section, li, 1)}
                        aria-label="Turunkan materi"
                      >
                        <ChevronDown size={14} />
                      </button>
                    </div>

                    <select
                      value={lesson.type}
                      onChange={(e) => {
                        patchLessonLocal(section.id, lesson.id, {
                          type: e.target.value,
                        });
                        saveLesson(section, { ...lesson, type: e.target.value });
                      }}
                      className="shrink-0 rounded-lg border border-zinc-300 px-2 py-2 text-xs text-zinc-700 outline-none focus:border-brand-500"
                    >
                      {LESSON_TYPES.map((t) => (
                        <option key={t} value={t}>
                          {lessonTypeLabels[t]}
                        </option>
                      ))}
                    </select>

                    <input
                      value={lesson.title}
                      onChange={(e) =>
                        patchLessonLocal(section.id, lesson.id, {
                          title: e.target.value,
                        })
                      }
                      onBlur={() => saveLesson(section, lesson)}
                      onKeyDown={(e) =>
                        e.key === "Enter" && e.currentTarget.blur()
                      }
                      className={`${inputCls} min-w-[140px] flex-1`}
                      placeholder="Judul materi"
                    />

                    <input
                      value={lesson.duration ?? ""}
                      onChange={(e) =>
                        patchLessonLocal(section.id, lesson.id, {
                          duration: e.target.value,
                        })
                      }
                      onBlur={() => saveLesson(section, lesson)}
                      onKeyDown={(e) =>
                        e.key === "Enter" && e.currentTarget.blur()
                      }
                      className={`${inputCls} w-28 shrink-0`}
                      placeholder="12 mnt"
                    />

                    <button
                      type="button"
                      onClick={() => removeLesson(section, lesson)}
                      aria-label="Hapus materi"
                      className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-rose-500 transition-colors hover:bg-rose-50"
                    >
                      <Trash2 size={13} />
                    </button>
                  </li>
                ))}
              </ul>

              <div className="px-3 py-2">
                <button
                  type="button"
                  onClick={() => addLesson(section)}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-brand-600 transition-colors hover:text-brand-700"
                >
                  <Plus size={13} /> Tambah materi
                </button>
              </div>
            </div>
          ))}

          <button
            type="button"
            onClick={addSection}
            className="inline-flex w-fit items-center gap-1.5 rounded-lg border border-dashed border-zinc-300 px-3 py-2 text-xs font-semibold text-zinc-600 transition-colors hover:border-zinc-400 hover:bg-zinc-50"
          >
            <Plus size={14} /> Tambah pertemuan
          </button>
        </>
      )}
    </section>
  );
}
