import { useCallback, useEffect, useRef, useState } from "react";
import {
  ChevronUp,
  ChevronDown,
  Plus,
  Trash2,
  Layers,
  Pencil,
  X,
  Link2,
  ListChecks,
  Eye,
  FileText,
  Upload,
  Lock,
  Clock,
  UserCheck,
} from "lucide-react";
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
import { getQuestionSets, quizAccessNow } from "../../lib/quiz";
import { getForms } from "../../lib/forms";
import { getCourseEnrollments } from "../../lib/enroll";
import { getUsers } from "../../lib/users";
import { uploadLessonPdf, deleteLessonPdf, PDF_MAX_MB } from "../../lib/pdf";
import { lessonTypeLabels } from "../../lib/lessonTypes";
import LessonIcon from "../ui/LessonIcon";
import MateriEditor from "./MateriEditor";

const LESSON_TYPES = Object.keys(lessonTypeLabels);

const fullName = (u) =>
  [u?.first_name, u?.last_name].filter(Boolean).join(" ") || u?.email || "";
const URL_TYPES = ["meet", "recording", "slide", "form"];

function PdfField({ lesson, onChange }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const inputRef = useRef(null);

  const pick = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBusy(true);
    setErr("");
    try {
      const old = lesson.url;
      const url = await uploadLessonPdf(lesson.id, file);
      onChange(url);
      if (old) deleteLessonPdf(old);
    } catch (e2) {
      setErr(e2?.message ?? "Gagal upload.");
    } finally {
      setBusy(false);
    }
  };

  const remove = () => {
    if (!window.confirm("Hapus PDF?")) return;
    const old = lesson.url;
    onChange(null);
    deleteLessonPdf(old);
  };

  return (
    <div className="mt-1.5 flex flex-wrap items-center gap-2 pl-9">
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf"
        className="hidden"
        onChange={pick}
      />
      <button
        type="button"
        disabled={busy}
        onClick={() => inputRef.current?.click()}
        className="inline-flex items-center gap-1.5 rounded-md border border-zinc-200 bg-white px-2 py-1 text-xs font-medium text-zinc-600 transition-colors hover:bg-zinc-50 disabled:opacity-50"
      >
        <Upload size={12} className="text-zinc-400" />
        {busy ? "Mengupload…" : lesson.url ? "Ganti PDF" : "Upload PDF"}
      </button>
      {lesson.url && !busy && (
        <>
          <a
            href={lesson.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-medium text-brand-600 hover:text-brand-700"
          >
            Lihat PDF
          </a>
          <button
            type="button"
            onClick={remove}
            className="text-xs font-medium text-zinc-400 transition-colors hover:text-rose-500"
          >
            Hapus
          </button>
        </>
      )}
      {err ? (
        <span className="text-xs text-rose-500">{err}</span>
      ) : (
        <span className="text-[11px] text-zinc-400">maks {PDF_MAX_MB} MB</span>
      )}
    </div>
  );
}

const typeTint = {
  materi: "bg-zinc-100 text-zinc-500",
  soal: "bg-amber-50 text-amber-600",
  meet: "bg-sky-50 text-sky-600",
  recording: "bg-teal-50 text-teal-600",
  slide: "bg-orange-50 text-orange-600",
  form: "bg-violet-50 text-violet-600",
  presensi: "bg-emerald-50 text-emerald-600",
  refleksi: "bg-rose-50 text-rose-600",
};

const cell =
  "min-w-0 rounded-md border border-zinc-200 bg-white px-2 py-1 text-sm text-zinc-800 outline-none transition-colors focus:border-brand-500";

function move(arr, from, to) {
  const next = arr.slice();
  const [it] = next.splice(from, 1);
  next.splice(to, 0, it);
  return next;
}

// ISO <-> value <input type="datetime-local"> (YYYY-MM-DDTHH:mm, waktu lokal).
const toLocalInput = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(
    d.getHours()
  )}:${p(d.getMinutes())}`;
};

function ReorderBtns({ onUp, onDown, first, last, label }) {
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

function Modal({ title, onClose, children }) {
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-zinc-900/40 p-4 sm:p-8"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl rounded-2xl border border-zinc-200 bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 border-b border-zinc-100 px-5 py-3.5">
          <h3 className="truncate text-sm font-bold text-zinc-900">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup"
            className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700"
          >
            <X size={16} />
          </button>
        </div>
        <div className="max-h-[68vh] overflow-y-auto p-5">{children}</div>
        <div className="flex justify-end border-t border-zinc-100 px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-zinc-700"
          >
            Selesai
          </button>
        </div>
      </div>
    </div>
  );
}

export default function CurriculumEditor({ courseId }) {
  const [sections, setSections] = useState([]);
  const [status, setStatus] = useState("loading"); // loading | error | ready
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [questionSets, setQuestionSets] = useState([]);
  const [forms, setForms] = useState([]);
  const [students, setStudents] = useState([]); // murid enrolled -- target feedback
  const [contentLesson, setContentLesson] = useState(null); // lesson materi yg lagi diedit isinya
  const [now] = useState(() => Date.now()); // buat badge "Akses ditutup" (jadwal)

  const closeModal = useCallback(() => setEditingId(null), []);

  useEffect(() => {
    let alive = true;
    getQuestionSets()
      .then((d) => alive && setQuestionSets(d))
      .catch((err) => console.error("[admin] gagal memuat set soal:", err));
    getForms()
      .then((d) => alive && setForms(d))
      .catch((err) => console.error("[admin] gagal memuat form:", err));
    Promise.all([getCourseEnrollments(courseId), getUsers()])
      .then(([enrollments, users]) => {
        if (!alive) return;
        const byId = new Map(users.map((u) => [u.id, u]));
        setStudents(
          enrollments
            .map((e) => byId.get(e.user_id))
            .filter(Boolean)
            .sort((a, b) => fullName(a).localeCompare(fullName(b), "id"))
        );
      })
      .catch((err) => console.error("[admin] gagal memuat murid:", err));
    return () => {
      alive = false;
    };
  }, [courseId]);

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

  const patchSectionLocal = (id, patch) =>
    setSections((p) => p.map((s) => (s.id === id ? { ...s, ...patch } : s)));

  const patchLessonLocal = (sid, lid, patch) =>
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

  // ── Section ops ──────────────────────────────────────────────────
  const addSection = () =>
    run(async () => {
      const row = await createSection(courseId, {
        title: "Pertemuan baru",
        position: sections.length,
      });
      setSections((p) => [...p, { id: row.id, title: row.title, items: [] }]);
      setEditingId(row.id);
    });

  const saveSectionTitle = (section) => {
    const title = section.title.trim() || "Tanpa judul";
    if (title !== section.title) patchSectionLocal(section.id, { title });
    run(() => updateSection(section.id, { title }));
  };

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
      setEditingId((id) => (id === section.id ? null : id));
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
  const addLesson = (section) =>
    run(async () => {
      const row = await createLesson(section.id, {
        type: "materi",
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
        url: lesson.url ?? null,
        question_set_id: lesson.question_set_id ?? null,
        form_id: lesson.form_id ?? null,
        prompt: lesson.prompt ?? null,
        publish_status: lesson.publish_status ?? "none",
        access_open: lesson.access_open ?? true,
        access_opens_at: lesson.access_opens_at ?? null,
        access_closes_at: lesson.access_closes_at ?? null,
        target_user_id: lesson.target_user_id ?? null,
        target_name: lesson.target_name ?? null,
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
  const editing = sections.find((s) => s.id === editingId) ?? null;
  const editingIndex = sections.findIndex((s) => s.id === editingId);

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

        {/* Read-only summary */}
        {status === "ready" &&
          sections.map((section, si) => (
            <div
              key={section.id}
              className="rounded-xl border border-zinc-200 bg-white"
            >
              <div className="flex items-center gap-2 px-3 py-2">
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-lg bg-zinc-900 text-xs font-bold text-white">
                  {si + 1}
                </span>
                <p className="flex-1 truncate px-1 text-sm font-bold text-zinc-900">
                  {section.title}
                </p>
                <span className="shrink-0 text-[11px] text-zinc-400">
                  {section.items.length} materi
                </span>
                <ReorderBtns
                  label="pertemuan"
                  first={si === 0}
                  last={si === sections.length - 1}
                  onUp={() => moveSection(si, -1)}
                  onDown={() => moveSection(si, 1)}
                />
                <button
                  type="button"
                  onClick={() => setEditingId(section.id)}
                  className="inline-flex shrink-0 items-center gap-1 rounded-md border border-zinc-200 px-2.5 py-1.5 text-xs font-medium text-zinc-600 transition-colors hover:bg-zinc-50"
                >
                  <Pencil size={12} /> Edit
                </button>
              </div>

              {section.items.length > 0 && (
                <ul className="border-t border-zinc-100">
                  {section.items.map((lesson) => (
                    <li
                      key={lesson.id}
                      className="flex items-center gap-2.5 border-b border-zinc-100 px-3 py-2 last:border-b-0"
                    >
                      <span
                        className={`grid h-7 w-7 shrink-0 place-items-center rounded-md ${
                          typeTint[lesson.type] ?? "bg-zinc-100 text-zinc-500"
                        }`}
                      >
                        <LessonIcon type={lesson.type} size={14} />
                      </span>
                      <span className="min-w-0 flex-1 truncate text-sm text-zinc-700">
                        {lesson.title}
                      </span>
                      {lesson.publish_status !== "all" && (
                        <span className="shrink-0 rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] font-semibold text-zinc-500">
                          Not publish
                        </span>
                      )}
                      {lesson.type === "soal" &&
                        !quizAccessNow(lesson, now).open && (
                          <span className="shrink-0 rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-600">
                            Akses ditutup
                          </span>
                        )}
                      <span className="shrink-0 text-xs text-zinc-400">
                        {lessonTypeLabels[lesson.type]}
                        {lesson.duration ? ` · ${lesson.duration}` : ""}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
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

      {/* Edit modal (per pertemuan) */}
      {editing && (
        <Modal title={`Pertemuan ${editingIndex + 1}`} onClose={closeModal}>
          <div className="flex flex-col gap-4">
            <label className="block">
              <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-zinc-400">
                Nama pertemuan
              </span>
              <input
                value={editing.title}
                onChange={(e) =>
                  patchSectionLocal(editing.id, { title: e.target.value })
                }
                onBlur={() => saveSectionTitle(editing)}
                className={`${cell} mt-1.5 w-full text-sm font-semibold`}
                placeholder="Nama pertemuan"
              />
            </label>

            <label className="block">
              <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-zinc-400">
                Jadwal pertemuan
                <span className="ml-2 font-normal normal-case tracking-normal text-zinc-400">
                  buat "pertemuan berikutnya" di lobby
                </span>
              </span>
              <input
                type="datetime-local"
                value={toLocalInput(editing.meet_at)}
                onChange={(e) => {
                  const meet_at = e.target.value
                    ? new Date(e.target.value).toISOString()
                    : null;
                  patchSectionLocal(editing.id, { meet_at });
                  run(() => updateSection(editing.id, { meet_at }));
                }}
                className={`${cell} mt-1.5 w-full text-sm sm:w-64`}
              />
            </label>

            <div>
              <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-zinc-400">
                Materi
              </span>
              <div className="mt-1.5 overflow-hidden rounded-lg border border-zinc-200">
                {editing.items.length === 0 && (
                  <p className="px-3 py-3 text-xs text-zinc-400">
                    Belum ada materi.
                  </p>
                )}

                {editing.items.map((lesson, li) => {
                  const hasUrl = URL_TYPES.includes(lesson.type);
                  return (
                    <div
                      key={lesson.id}
                      className="border-b border-zinc-100 px-2.5 py-2 last:border-b-0"
                    >
                      <div className="flex items-center gap-2">
                        <ReorderBtns
                          label="materi"
                          first={li === 0}
                          last={li === editing.items.length - 1}
                          onUp={() => moveLesson(editing, li, -1)}
                          onDown={() => moveLesson(editing, li, 1)}
                        />
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
                              patchLessonLocal(editing.id, lesson.id, {
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
                              patchLessonLocal(editing.id, lesson.id, {
                                duration: e.target.value,
                              })
                            }
                            onBlur={() => saveLesson(lesson)}
                            onKeyDown={(e) =>
                              e.key === "Enter" && e.currentTarget.blur()
                            }
                            placeholder="durasi"
                            className={`${cell} w-[46%] shrink-0 text-right text-xs text-zinc-500 sm:order-last sm:w-[84px]`}
                          />
                          <input
                            value={lesson.title}
                            onChange={(e) =>
                              patchLessonLocal(editing.id, lesson.id, {
                                title: e.target.value,
                              })
                            }
                            onBlur={() => saveLesson(lesson)}
                            onKeyDown={(e) =>
                              e.key === "Enter" && e.currentTarget.blur()
                            }
                            placeholder="Judul materi"
                            className={`${cell} order-last w-full font-medium sm:order-none sm:w-auto sm:flex-1`}
                          />
                        </div>

                        <button
                          type="button"
                          onClick={() => removeLesson(editing, lesson)}
                          aria-label="Hapus materi"
                          className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-zinc-300 transition-colors hover:bg-rose-50 hover:text-rose-500"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>

                      <div className="mt-1.5 flex items-center gap-2 pl-9">
                        <Eye size={12} className="shrink-0 text-zinc-400" />
                        {(() => {
                          const published =
                            (lesson.publish_status ?? "none") === "all";
                          const toggle = () => {
                            const next = published ? "none" : "all";
                            patchLessonLocal(editing.id, lesson.id, {
                              publish_status: next,
                            });
                            saveLesson({ ...lesson, publish_status: next });
                          };
                          return (
                            <>
                              <button
                                type="button"
                                role="switch"
                                aria-checked={published}
                                onClick={toggle}
                                className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${
                                  published ? "bg-brand-500" : "bg-zinc-200"
                                }`}
                              >
                                <span
                                  className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                                    published ? "translate-x-4" : "translate-x-0.5"
                                  }`}
                                />
                              </button>
                              <span className="text-xs text-zinc-600">
                                {published ? "Publish" : "Not publish"}
                              </span>
                            </>
                          );
                        })()}
                      </div>

                      {hasUrl && (
                        <div className="mt-1.5 flex items-center gap-1.5 pl-9">
                          <Link2 size={12} className="shrink-0 text-zinc-400" />
                          <input
                            type="url"
                            value={lesson.url ?? ""}
                            onChange={(e) =>
                              patchLessonLocal(editing.id, lesson.id, {
                                url: e.target.value,
                              })
                            }
                            onBlur={() => saveLesson(lesson)}
                            onKeyDown={(e) =>
                              e.key === "Enter" && e.currentTarget.blur()
                            }
                            placeholder={
                              lesson.type === "meet"
                                ? "https://meet.google.com/…"
                                : lesson.type === "form"
                                  ? "https://forms.gle/…"
                                  : lesson.type === "slide"
                                    ? "https://docs.google.com/presentation/d/…"
                                    : "Link video (Drive / YouTube / …)"
                            }
                            className={`${cell} flex-1 text-xs`}
                          />
                        </div>
                      )}

                      {lesson.type === "soal" && (
                        <div className="mt-1.5 flex items-center gap-1.5 pl-9">
                          <ListChecks
                            size={12}
                            className="shrink-0 text-zinc-400"
                          />
                          <select
                            value={lesson.question_set_id ?? ""}
                            onChange={(e) => {
                              const v = e.target.value || null;
                              patchLessonLocal(editing.id, lesson.id, {
                                question_set_id: v,
                              });
                              saveLesson({ ...lesson, question_set_id: v });
                            }}
                            className={`${cell} flex-1 text-xs`}
                          >
                            <option value="">— pilih set soal —</option>
                            {questionSets.map((qs) => (
                              <option key={qs.id} value={qs.id}>
                                {qs.title}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}

                      {lesson.type === "soal" && (
                        <div className="mt-1.5 flex items-center gap-2 pl-9">
                          <Lock size={12} className="shrink-0 text-zinc-400" />
                          {(() => {
                            const open = lesson.access_open !== false;
                            const toggle = () => {
                              const next = !open;
                              patchLessonLocal(editing.id, lesson.id, {
                                access_open: next,
                              });
                              saveLesson({ ...lesson, access_open: next });
                            };
                            return (
                              <>
                                <button
                                  type="button"
                                  role="switch"
                                  aria-checked={open}
                                  onClick={toggle}
                                  className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${
                                    open ? "bg-emerald-500" : "bg-zinc-300"
                                  }`}
                                >
                                  <span
                                    className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                                      open ? "translate-x-4" : "translate-x-0.5"
                                    }`}
                                  />
                                </button>
                                <span className="text-xs text-zinc-600">
                                  {open ? "Akses dibuka" : "Akses ditutup"}
                                </span>
                                <span className="text-[11px] text-zinc-400">
                                  {open
                                    ? "murid bisa mulai ngerjain"
                                    : "yang belum mulai ketahan di lobby"}
                                </span>
                              </>
                            );
                          })()}
                        </div>
                      )}

                      {lesson.type === "soal" && (
                        <div className="mt-1.5 flex flex-wrap items-center gap-1.5 pl-9">
                          <Clock size={12} className="shrink-0 text-zinc-400" />
                          <input
                            type="datetime-local"
                            value={toLocalInput(lesson.access_opens_at)}
                            onChange={(e) => {
                              const v = e.target.value
                                ? new Date(e.target.value).toISOString()
                                : null;
                              patchLessonLocal(editing.id, lesson.id, {
                                access_opens_at: v,
                              });
                              saveLesson({ ...lesson, access_opens_at: v });
                            }}
                            title="Buka mulai (opsional)"
                            className={`${cell} text-xs`}
                          />
                          <span className="shrink-0 text-[11px] text-zinc-400">
                            s/d
                          </span>
                          <input
                            type="datetime-local"
                            value={toLocalInput(lesson.access_closes_at)}
                            onChange={(e) => {
                              const v = e.target.value
                                ? new Date(e.target.value).toISOString()
                                : null;
                              patchLessonLocal(editing.id, lesson.id, {
                                access_closes_at: v,
                              });
                              saveLesson({ ...lesson, access_closes_at: v });
                            }}
                            title="Tutup pada (opsional)"
                            className={`${cell} text-xs`}
                          />
                          <span className="shrink-0 text-[11px] text-zinc-400">
                            jadwal opsional, kosongin = ikut toggle di atas
                          </span>
                        </div>
                      )}

                      {(lesson.type === "form" ||
                        lesson.type === "refleksi") && (
                        <div className="mt-1.5 flex items-center gap-1.5 pl-9">
                          <ListChecks
                            size={12}
                            className="shrink-0 text-zinc-400"
                          />
                          <select
                            value={lesson.form_id ?? ""}
                            onChange={(e) => {
                              const v = e.target.value || null;
                              patchLessonLocal(editing.id, lesson.id, {
                                form_id: v,
                              });
                              saveLesson({ ...lesson, form_id: v });
                            }}
                            className={`${cell} flex-1 text-xs`}
                          >
                            <option value="">
                              {lesson.type === "refleksi"
                                ? "— pilih form —"
                                : "— form in-app (opsional) —"}
                            </option>
                            {forms.map((fm) => (
                              <option key={fm.id} value={fm.id}>
                                {fm.title}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}

                      {lesson.type === "feedback" && (
                        <>
                          <div className="mt-1.5 flex items-center gap-1.5 pl-9">
                            <ListChecks
                              size={12}
                              className="shrink-0 text-zinc-400"
                            />
                            <select
                              value={lesson.form_id ?? ""}
                              onChange={(e) => {
                                const v = e.target.value || null;
                                patchLessonLocal(editing.id, lesson.id, {
                                  form_id: v,
                                });
                                saveLesson({ ...lesson, form_id: v });
                              }}
                              className={`${cell} flex-1 text-xs`}
                            >
                              <option value="">
                                — pilih form pertanyaan —
                              </option>
                              {forms.map((fm) => (
                                <option key={fm.id} value={fm.id}>
                                  {fm.title}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div className="mt-1.5 flex items-center gap-1.5 pl-9">
                            <UserCheck
                              size={12}
                              className="shrink-0 text-zinc-400"
                            />
                            <select
                              value={lesson.target_user_id ?? ""}
                              onChange={(e) => {
                                const uid = e.target.value || null;
                                const target = students.find(
                                  (s) => s.id === uid,
                                );
                                const patch = {
                                  target_user_id: uid,
                                  target_name: target
                                    ? fullName(target)
                                    : null,
                                };
                                patchLessonLocal(
                                  editing.id,
                                  lesson.id,
                                  patch,
                                );
                                saveLesson({ ...lesson, ...patch });
                              }}
                              className={`${cell} flex-1 text-xs`}
                            >
                              <option value="">
                                — buat siapa (target) —
                              </option>
                              {students.map((s) => (
                                <option key={s.id} value={s.id}>
                                  {fullName(s)}
                                </option>
                              ))}
                            </select>
                          </div>
                          <p className="mt-1.5 pl-9 text-[11px] text-zinc-400">
                            Murid lain ngisi form ini buat kasih feedback
                            soal target. Ganti target = bikin lesson baru,
                            bukan ubah yang ini.
                          </p>
                        </>
                      )}

                      {lesson.type === "presensi" && (
                        <p className="mt-1.5 pl-9 text-[11px] text-zinc-400">
                          Murid klik “Hadir” buat presensi. Rekapnya di bawah.
                        </p>
                      )}

                      {lesson.type === "materi" && (
                        <div className="mt-1.5 pl-9">
                          <button
                            type="button"
                            onClick={() => setContentLesson(lesson)}
                            className="inline-flex items-center gap-1.5 rounded-md border border-zinc-200 bg-white px-2 py-1 text-xs font-medium text-zinc-600 transition-colors hover:bg-zinc-50"
                          >
                            <FileText size={12} className="text-zinc-400" />
                            {lesson.content ? "Edit isi materi" : "Tulis isi materi"}
                          </button>
                        </div>
                      )}

                      {lesson.type === "pdf" && (
                        <PdfField
                          lesson={lesson}
                          onChange={(url) => {
                            patchLessonLocal(editing.id, lesson.id, { url });
                            saveLesson({ ...lesson, url });
                          }}
                        />
                      )}
                    </div>
                  );
                })}

                <button
                  type="button"
                  onClick={() => addLesson(editing)}
                  className="flex w-full items-center gap-1.5 px-3 py-2 text-xs font-semibold text-brand-600 transition-colors hover:bg-brand-50/60"
                >
                  <Plus size={13} /> Tambah materi
                </button>
              </div>
            </div>

            <button
              type="button"
              onClick={() => removeSection(editing)}
              className="inline-flex w-fit items-center gap-1.5 rounded-lg border border-rose-200 px-3 py-2 text-xs font-medium text-rose-600 transition-colors hover:bg-rose-50"
            >
              <Trash2 size={13} /> Hapus pertemuan ini
            </button>
          </div>
        </Modal>
      )}

      {contentLesson && (
        <MateriEditor
          lesson={contentLesson}
          onClose={() => setContentLesson(null)}
          onSaved={(content) =>
            editing &&
            patchLessonLocal(editing.id, contentLesson.id, { content })
          }
        />
      )}
    </div>
  );
}
