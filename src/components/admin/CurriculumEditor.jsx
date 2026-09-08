import { useEffect, useRef, useState } from "react";
import {
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  Plus,
  Trash2,
  Layers,
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
import {
  uploadLessonImage,
  deleteLessonImage,
  IMAGE_MAX_MB,
} from "../../lib/images";
import { lessonTypeLabels } from "../../lib/lessonTypes";
import LessonIcon from "../ui/LessonIcon";
import MateriEditor from "./MateriEditor";

const LESSON_TYPES = Object.keys(lessonTypeLabels);

const fullName = (u) =>
  [u?.first_name, u?.last_name].filter(Boolean).join(" ") || u?.email || "";
const URL_TYPES = ["meet", "recording", "slide", "form"];
// Item yang isian-nya form in-app (dirender FormPage) — semua kena toggle
// buka/tutup akses per-lesson, sama kayak soal tapi tanpa jadwal.
const FORM_LIKE = new Set(["form", "refleksi", "feedback"]);

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
    <div className="flex flex-wrap items-center gap-2">
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

// Upload gambar + preview. Mirip PdfField.
function ImageField({ lesson, onChange }) {
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
      const url = await uploadLessonImage(lesson.id, file);
      onChange(url);
      if (old) deleteLessonImage(old);
    } catch (e2) {
      setErr(e2?.message ?? "Gagal upload.");
    } finally {
      setBusy(false);
    }
  };

  const remove = () => {
    if (!window.confirm("Hapus gambar?")) return;
    const old = lesson.url;
    onChange(null);
    deleteLessonImage(old);
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
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
          {busy ? "Mengupload…" : lesson.url ? "Ganti gambar" : "Upload gambar"}
        </button>
        {lesson.url && !busy && (
          <button
            type="button"
            onClick={remove}
            className="text-xs font-medium text-zinc-400 transition-colors hover:text-rose-500"
          >
            Hapus
          </button>
        )}
        {err ? (
          <span className="text-xs text-rose-500">{err}</span>
        ) : (
          <span className="text-[11px] text-zinc-400">
            PNG / JPG / WEBP / GIF · maks {IMAGE_MAX_MB} MB
          </span>
        )}
      </div>
      {lesson.url && !busy && (
        <img
          src={lesson.url}
          alt=""
          className="max-h-40 w-auto max-w-full rounded-lg border border-zinc-200"
        />
      )}
    </div>
  );
}

const typeTint = {
  materi: "bg-zinc-100 text-zinc-500",
  soal: "bg-amber-50 text-amber-600",
  meet: "bg-sky-50 text-sky-600",
  recording: "bg-teal-50 text-teal-600",
  image: "bg-cyan-50 text-cyan-600",
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

export default function CurriculumEditor({ courseId }) {
  const [sections, setSections] = useState([]);
  const [status, setStatus] = useState("loading"); // loading | error | ready
  const [saving, setSaving] = useState(false);
  const [selSecId, setSelSecId] = useState(null); // pertemuan yang lagi dibuka (kolom kiri)
  const [selLesId, setSelLesId] = useState(null); // materi yang lagi diatur (kolom kanan)
  const [mobileStep, setMobileStep] = useState("sections"); // HP: sections | items | detail
  const [questionSets, setQuestionSets] = useState([]);
  const [forms, setForms] = useState([]);
  const [students, setStudents] = useState([]); // murid enrolled -- target feedback
  const [contentLesson, setContentLesson] = useState(null); // lesson materi yg lagi diedit isinya
  const [now] = useState(() => Date.now()); // buat badge "Akses ditutup" (jadwal)

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
      setSelSecId(row.id);
      setSelLesId(null);
      setMobileStep("items");
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
      setSelSecId((id) => (id === section.id ? null : id));
      setSelLesId(null);
      setMobileStep("sections");
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
      setSelLesId(row.id);
      setMobileStep("detail");
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
        soal_bypass: lesson.soal_bypass ?? false,
        target_user_id: lesson.target_user_id ?? null,
        target_name: lesson.target_name ?? null,
        allow_download: lesson.allow_download ?? true,
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
      setSelLesId((id) => (id === lesson.id ? null : id));
      setMobileStep((step) => (step === "detail" ? "items" : step));
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
  const activeSec =
    sections.find((s) => s.id === selSecId) ?? sections[0] ?? null;
  const activeLes = activeSec?.items.find((l) => l.id === selLesId) ?? null;

  // ── Kolom 1: daftar pertemuan ────────────────────────────────────
  const secListEl = (
    <div className="flex flex-col gap-1.5">
      {sections.map((section, si) => {
        const on = activeSec?.id === section.id;
        return (
          <div
            key={section.id}
            className={`flex items-center gap-1 rounded-lg border px-2 py-1.5 transition-colors ${
              on
                ? "border-brand-300 bg-brand-50"
                : "border-zinc-200 bg-white hover:bg-zinc-50"
            }`}
          >
            <button
              type="button"
              onClick={() => {
                setSelSecId(section.id);
                setSelLesId(null);
                setMobileStep("items");
              }}
              className="flex min-w-0 flex-1 items-center gap-2 text-left"
            >
              <span className="grid h-6 w-6 shrink-0 place-items-center rounded-lg bg-zinc-900 text-xs font-bold text-white">
                {si + 1}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-zinc-900">
                  {section.title}
                </span>
                <span className="block text-[11px] text-zinc-400">
                  {section.items.length} materi
                  {section.default_open === false ? " · tutup default" : ""}
                </span>
              </span>
            </button>
            <ReorderBtns
              label="pertemuan"
              first={si === 0}
              last={si === sections.length - 1}
              onUp={() => moveSection(si, -1)}
              onDown={() => moveSection(si, 1)}
            />
          </div>
        );
      })}
      <button
        type="button"
        onClick={addSection}
        className="mt-1 flex items-center justify-center gap-1.5 rounded-lg border-2 border-dashed border-zinc-200 py-2 text-xs font-semibold text-zinc-500 transition-colors hover:border-brand-300 hover:bg-brand-50/30 hover:text-brand-600"
      >
        <Layers size={14} /> Tambah pertemuan
      </button>
    </div>
  );

  // ── Kolom 2: setelan pertemuan + daftar materi ───────────────────
  const midPaneEl = activeSec ? (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2 border-b border-zinc-100 pb-3">
        <input
          value={activeSec.title}
          onChange={(e) =>
            patchSectionLocal(activeSec.id, { title: e.target.value })
          }
          onBlur={() => saveSectionTitle(activeSec)}
          onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
          className={`${cell} text-sm font-bold`}
          placeholder="Nama pertemuan"
        />
        <div className="flex flex-wrap items-center gap-2 text-[11px] text-zinc-400">
          <input
            type="datetime-local"
            value={toLocalInput(activeSec.meet_at)}
            onChange={(e) => {
              const meet_at = e.target.value
                ? new Date(e.target.value).toISOString()
                : null;
              patchSectionLocal(activeSec.id, { meet_at });
              run(() => updateSection(activeSec.id, { meet_at }));
            }}
            title='Jadwal — buat "pertemuan berikutnya" di lobby'
            className={`${cell} text-xs`}
          />
          <label className="flex cursor-pointer items-center gap-1 font-medium text-zinc-500">
            <input
              type="checkbox"
              checked={activeSec.default_open !== false}
              onChange={(e) => {
                const default_open = e.target.checked;
                patchSectionLocal(activeSec.id, { default_open });
                run(() => updateSection(activeSec.id, { default_open }));
              }}
            />
            Buka default
          </label>
          <button
            type="button"
            onClick={() => removeSection(activeSec)}
            className="ml-auto inline-flex items-center gap-1 rounded-md border border-rose-200 px-2 py-1 font-medium text-rose-600 transition-colors hover:bg-rose-50"
          >
            <Trash2 size={11} /> Hapus
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        {activeSec.items.length === 0 && (
          <p className="px-1 py-3 text-xs text-zinc-400">Belum ada materi.</p>
        )}
        {activeSec.items.map((lesson, li) => {
          const on = activeLes?.id === lesson.id;
          const closed =
            (lesson.type === "soal" && !quizAccessNow(lesson, now).open) ||
            (FORM_LIKE.has(lesson.type) && lesson.access_open === false);
          return (
            <div
              key={lesson.id}
              onClick={() => {
                setSelLesId(lesson.id);
                setMobileStep("detail");
              }}
              className={`flex cursor-pointer items-center gap-2 rounded-lg border px-2 py-2 transition-colors ${
                on
                  ? "border-brand-300 bg-brand-50"
                  : "border-zinc-200 bg-white hover:bg-zinc-50"
              }`}
            >
              <span onClick={(e) => e.stopPropagation()}>
                <ReorderBtns
                  label="materi"
                  first={li === 0}
                  last={li === activeSec.items.length - 1}
                  onUp={() => moveLesson(activeSec, li, -1)}
                  onDown={() => moveLesson(activeSec, li, 1)}
                />
              </span>
              <span
                className={`grid h-7 w-7 shrink-0 place-items-center rounded-md ${
                  typeTint[lesson.type] ?? "bg-zinc-100 text-zinc-500"
                }`}
              >
                <LessonIcon type={lesson.type} size={14} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-zinc-800">
                  {lesson.title || "Tanpa judul"}
                </span>
                <span className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-zinc-400">
                  <span>
                    {lessonTypeLabels[lesson.type]}
                    {lesson.duration ? ` · ${lesson.duration}` : ""}
                  </span>
                  {lesson.publish_status !== "all" && (
                    <span className="rounded bg-zinc-100 px-1 py-px font-semibold text-zinc-500">
                      Not publish
                    </span>
                  )}
                  {closed && (
                    <span className="rounded bg-amber-50 px-1 py-px font-semibold text-amber-600">
                      Akses ditutup
                    </span>
                  )}
                </span>
              </span>
              <span className="shrink-0 text-[11px] font-semibold text-brand-600">
                Atur ▸
              </span>
            </div>
          );
        })}
        <button
          type="button"
          onClick={() => addLesson(activeSec)}
          className="mt-1 flex items-center justify-center gap-1.5 rounded-lg border-2 border-dashed border-zinc-200 py-2 text-xs font-semibold text-brand-600 transition-colors hover:border-brand-300 hover:bg-brand-50/30"
        >
          <Plus size={13} /> Tambah materi
        </button>
      </div>
    </div>
  ) : (
    <p className="px-1 py-8 text-center text-xs text-zinc-400">
      Pilih pertemuan di kiri.
    </p>
  );

  // ── Kolom 3: detail materi terpilih ─────────────────────────────
  let detailPaneEl;
  if (!activeLes) {
    detailPaneEl = (
      <p className="px-1 py-8 text-center text-xs text-zinc-400">
        Pilih materi di kolom tengah buat atur detailnya.
      </p>
    );
  } else {
    const lesson = activeLes;
    const sid = activeSec.id;
    const hasUrl = URL_TYPES.includes(lesson.type);
    const published = (lesson.publish_status ?? "none") === "all";
    const accOpen = lesson.access_open !== false;
    detailPaneEl = (
      <div className="flex flex-col gap-3">
        <input
          value={lesson.title}
          onChange={(e) =>
            patchLessonLocal(sid, lesson.id, { title: e.target.value })
          }
          onBlur={() => saveLesson(lesson)}
          onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
          placeholder="Judul materi"
          className={`${cell} text-sm font-bold`}
        />
        <div className="flex flex-wrap items-center gap-1.5">
          <select
            value={lesson.type}
            onChange={(e) => {
              const next = { ...lesson, type: e.target.value };
              patchLessonLocal(sid, lesson.id, { type: e.target.value });
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
              patchLessonLocal(sid, lesson.id, { duration: e.target.value })
            }
            onBlur={() => saveLesson(lesson)}
            onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
            placeholder="durasi"
            className={`${cell} w-[90px] shrink-0 text-xs text-zinc-500`}
          />
          <button
            type="button"
            onClick={() => removeLesson(activeSec, lesson)}
            className="ml-auto inline-flex items-center gap-1 rounded-md border border-rose-200 px-2 py-1 text-xs font-medium text-rose-600 transition-colors hover:bg-rose-50"
          >
            <Trash2 size={11} /> Hapus
          </button>
        </div>

        <div className="flex items-center gap-2 border-t border-zinc-100 pt-3">
          <Eye size={12} className="shrink-0 text-zinc-400" />
          <button
            type="button"
            role="switch"
            aria-checked={published}
            onClick={() => {
              const next = published ? "none" : "all";
              patchLessonLocal(sid, lesson.id, { publish_status: next });
              saveLesson({ ...lesson, publish_status: next });
            }}
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
        </div>

        {hasUrl && (
          <div className="flex items-center gap-1.5">
            <Link2 size={12} className="shrink-0 text-zinc-400" />
            <input
              type="url"
              value={lesson.url ?? ""}
              onChange={(e) =>
                patchLessonLocal(sid, lesson.id, { url: e.target.value })
              }
              onBlur={() => saveLesson(lesson)}
              onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
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
          <div className="flex items-center gap-1.5">
            <ListChecks size={12} className="shrink-0 text-zinc-400" />
            <select
              value={lesson.question_set_id ?? ""}
              onChange={(e) => {
                const v = e.target.value || null;
                patchLessonLocal(sid, lesson.id, { question_set_id: v });
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

        {(lesson.type === "soal" || FORM_LIKE.has(lesson.type)) && (
          <div className="flex items-center gap-2">
            <Lock size={12} className="shrink-0 text-zinc-400" />
            <button
              type="button"
              role="switch"
              aria-checked={accOpen}
              onClick={() => {
                const next = !accOpen;
                patchLessonLocal(sid, lesson.id, { access_open: next });
                saveLesson({ ...lesson, access_open: next });
              }}
              className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${
                accOpen ? "bg-emerald-500" : "bg-zinc-300"
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                  accOpen ? "translate-x-4" : "translate-x-0.5"
                }`}
              />
            </button>
            <span className="text-xs text-zinc-600">
              {accOpen ? "Akses dibuka" : "Akses ditutup"}
            </span>
            <span className="text-[11px] text-zinc-400">
              {lesson.type !== "soal"
                ? accOpen
                  ? "murid bisa buka & isi"
                  : "murid nggak bisa buka"
                : accOpen
                  ? "murid bisa mulai ngerjain"
                  : "yang belum mulai ketahan di lobby"}
            </span>
          </div>
        )}

        {lesson.type === "soal" && (
          <div className="flex flex-wrap items-center gap-1.5">
            <Clock size={12} className="shrink-0 text-zinc-400" />
            <input
              type="datetime-local"
              value={toLocalInput(lesson.access_opens_at)}
              onChange={(e) => {
                const v = e.target.value
                  ? new Date(e.target.value).toISOString()
                  : null;
                patchLessonLocal(sid, lesson.id, { access_opens_at: v });
                saveLesson({ ...lesson, access_opens_at: v });
              }}
              title="Buka mulai (opsional)"
              className={`${cell} text-xs`}
            />
            <span className="shrink-0 text-[11px] text-zinc-400">s/d</span>
            <input
              type="datetime-local"
              value={toLocalInput(lesson.access_closes_at)}
              onChange={(e) => {
                const v = e.target.value
                  ? new Date(e.target.value).toISOString()
                  : null;
                patchLessonLocal(sid, lesson.id, { access_closes_at: v });
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

        {lesson.type === "soal" && (
          <label
            className="flex cursor-pointer items-center gap-1.5 text-xs text-zinc-500"
            title="Kalau akses ditutup, murid tetap bisa lihat daftar soal (read-only, nggak bisa dikerjakan). Nggak ngefek kalau akses masih dibuka."
          >
            <input
              type="checkbox"
              checked={lesson.soal_bypass === true}
              onChange={(e) => {
                const soal_bypass = e.target.checked;
                patchLessonLocal(sid, lesson.id, { soal_bypass });
                saveLesson({ ...lesson, soal_bypass });
              }}
            />
            By-pass: boleh lihat soal kalau akses ditutup
          </label>
        )}

        {(lesson.type === "form" || lesson.type === "refleksi") && (
          <div className="flex items-center gap-1.5">
            <ListChecks size={12} className="shrink-0 text-zinc-400" />
            <select
              value={lesson.form_id ?? ""}
              onChange={(e) => {
                const v = e.target.value || null;
                patchLessonLocal(sid, lesson.id, { form_id: v });
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
            <div className="flex items-center gap-1.5">
              <ListChecks size={12} className="shrink-0 text-zinc-400" />
              <select
                value={lesson.form_id ?? ""}
                onChange={(e) => {
                  const v = e.target.value || null;
                  patchLessonLocal(sid, lesson.id, { form_id: v });
                  saveLesson({ ...lesson, form_id: v });
                }}
                className={`${cell} flex-1 text-xs`}
              >
                <option value="">— pilih form pertanyaan —</option>
                {forms.map((fm) => (
                  <option key={fm.id} value={fm.id}>
                    {fm.title}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-1.5">
              <UserCheck size={12} className="shrink-0 text-zinc-400" />
              <select
                value={lesson.target_user_id ?? ""}
                onChange={(e) => {
                  const uid = e.target.value || null;
                  const target = students.find((s) => s.id === uid);
                  const patch = {
                    target_user_id: uid,
                    target_name: target ? fullName(target) : null,
                  };
                  patchLessonLocal(sid, lesson.id, patch);
                  saveLesson({ ...lesson, ...patch });
                }}
                className={`${cell} flex-1 text-xs`}
              >
                <option value="">— buat siapa (target) —</option>
                {students.map((s) => (
                  <option key={s.id} value={s.id}>
                    {fullName(s)}
                  </option>
                ))}
              </select>
            </div>
            <p className="text-[11px] text-zinc-400">
              Murid lain ngisi form ini buat kasih feedback soal target. Ganti
              target = bikin lesson baru, bukan ubah yang ini.
            </p>
          </>
        )}

        {lesson.type === "presensi" && (
          <p className="text-[11px] text-zinc-400">
            Murid klik “Hadir” buat presensi. Rekapnya di tab Presensi.
          </p>
        )}

        {lesson.type === "materi" && (
          <button
            type="button"
            onClick={() => setContentLesson(lesson)}
            className="inline-flex w-fit items-center gap-1.5 rounded-md border border-zinc-200 bg-white px-2 py-1 text-xs font-medium text-zinc-600 transition-colors hover:bg-zinc-50"
          >
            <FileText size={12} className="text-zinc-400" />
            {lesson.content ? "Edit isi materi" : "Tulis isi materi"}
          </button>
        )}

        {lesson.type === "pdf" && (
          <PdfField
            lesson={lesson}
            onChange={(url) => {
              patchLessonLocal(sid, lesson.id, { url });
              saveLesson({ ...lesson, url });
            }}
          />
        )}

        {lesson.type === "image" && (
          <>
            <ImageField
              lesson={lesson}
              onChange={(url) => {
                patchLessonLocal(sid, lesson.id, { url });
                saveLesson({ ...lesson, url });
              }}
            />
            <label className="flex items-center gap-1.5 text-xs text-zinc-500">
              <input
                type="checkbox"
                checked={lesson.allow_download !== false}
                onChange={(e) => {
                  const allow_download = e.target.checked;
                  patchLessonLocal(sid, lesson.id, { allow_download });
                  saveLesson({ ...lesson, allow_download });
                }}
              />
              Murid boleh download gambarnya
            </label>
          </>
        )}
      </div>
    );
  }

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

      <div className="p-4 sm:p-5">
        {status === "loading" && (
          <p className="py-6 text-center text-xs text-zinc-400">Memuat…</p>
        )}
        {status === "error" && (
          <p className="rounded-lg border border-dashed border-rose-300 px-4 py-6 text-center text-sm text-rose-500">
            Gagal memuat kurikulum.
          </p>
        )}

        {status === "ready" && (
          <>
            {/* HP: satu pane, breadcrumb */}
            <div className="md:hidden">
              {mobileStep !== "sections" && (
                <button
                  type="button"
                  onClick={() =>
                    setMobileStep(mobileStep === "detail" ? "items" : "sections")
                  }
                  className="mb-3 inline-flex items-center gap-1 text-xs font-medium text-zinc-500 transition-colors hover:text-zinc-800"
                >
                  <ChevronLeft size={14} />
                  {mobileStep === "items"
                    ? "Semua pertemuan"
                    : (activeSec?.title ?? "Kembali")}
                </button>
              )}
              {mobileStep === "sections" && secListEl}
              {mobileStep === "items" && midPaneEl}
              {mobileStep === "detail" && detailPaneEl}
            </div>

            {/* Laptop+: 3 kolom, geser kalau nggak muat */}
            <div className="hidden gap-4 overflow-x-auto md:flex">
              <div className="w-[210px] shrink-0">{secListEl}</div>
              <div className="w-[360px] shrink-0 border-l border-zinc-100 pl-4">
                {midPaneEl}
              </div>
              <div className="min-w-[320px] flex-1 border-l border-zinc-100 pl-4">
                {detailPaneEl}
              </div>
            </div>
          </>
        )}
      </div>

      {contentLesson && (
        <MateriEditor
          lesson={contentLesson}
          onClose={() => setContentLesson(null)}
          onSaved={(content) =>
            activeSec &&
            patchLessonLocal(activeSec.id, contentLesson.id, { content })
          }
        />
      )}
    </div>
  );
}
