import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Check } from "lucide-react";
import {
  getCourse,
  createCourse,
  updateCourse,
  getCourseSecret,
  saveCourseSecret,
} from "../../lib/courses";
import { subjectIcons } from "../../lib/subjectIcons";
import SubjectIcon from "../../components/ui/SubjectIcon";
import Skeleton from "../../components/ui/Skeleton";
import CurriculumEditor from "../../components/admin/CurriculumEditor";
import EnrolledStudents from "../../components/admin/EnrolledStudents";
import CourseSessionRecap from "../../components/admin/CourseSessionRecap";

const ICONS = Object.keys(subjectIcons);

const inputCls =
  "w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 outline-none transition-colors focus:border-brand-500 disabled:bg-zinc-100 disabled:text-zinc-400";

const slugify = (s) =>
  s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

export default function CourseFormPage() {
  const { courseId } = useParams();
  const isEdit = Boolean(courseId);
  const navigate = useNavigate();

  const [form, setForm] = useState({
    id: "",
    title: "",
    description: "",
    icon: "sigma",
    passcode: "",
  });
  const [idTouched, setIdTouched] = useState(false);
  const [status, setStatus] = useState(isEdit ? "loading" : "ready");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!isEdit) return;
    let alive = true;

    Promise.all([getCourse(courseId), getCourseSecret(courseId).catch(() => "")])
      .then(([data, passcode]) => {
        if (!alive) return;
        if (!data) {
          setStatus("not-found");
          return;
        }
        setForm({
          id: data.id,
          title: data.title ?? "",
          description: data.description ?? "",
          icon: data.icon ?? "sigma",
          passcode: passcode ?? "",
        });
        setStatus("ready");
      })
      .catch((err) => {
        if (!alive) return;
        console.error("[admin] gagal memuat course:", err);
        setStatus("error");
      });

    return () => {
      alive = false;
    };
  }, [courseId, isEdit]);

  const set = (key, val) => setForm((f) => ({ ...f, [key]: val }));

  // Sebelum ID disentuh manual, ikuti hasil slugify dari judul.
  const effectiveId = isEdit || idTouched ? form.id : slugify(form.title);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSaved(false);

    const title = form.title.trim();
    if (!title) {
      setError("Judul wajib diisi.");
      return;
    }
    if (!isEdit && !/^[a-z0-9-]+$/.test(effectiveId)) {
      setError("ID hanya boleh huruf kecil, angka, dan tanda hubung (-).");
      return;
    }

    const description = form.description.trim() || null;

    setBusy(true);
    try {
      if (isEdit) {
        await updateCourse(courseId, { title, description, icon: form.icon });
        await saveCourseSecret(courseId, form.passcode);
        setBusy(false);
        setSaved(true);
        setTimeout(() => setSaved(false), 2500);
      } else {
        await createCourse({
          id: effectiveId,
          title,
          description,
          icon: form.icon,
        });
        if (form.passcode.trim())
          await saveCourseSecret(effectiveId, form.passcode);
        navigate("/admin", { replace: true });
      }
    } catch (err) {
      // 23505 = unique_violation (id sudah ada)
      setError(
        err?.code === "23505"
          ? "ID itu sudah dipakai course lain."
          : (err?.message ?? "Gagal menyimpan."),
      );
      setBusy(false);
    }
  };

  if (status === "loading") {
    return (
      <div className="mx-auto max-w-[1200px]">
        <Skeleton className="h-9 w-40" />
        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,340px)_minmax(0,1fr)]">
          <Skeleton className="h-80 w-full rounded-2xl" />
          <Skeleton className="h-96 w-full rounded-2xl" />
        </div>
      </div>
    );
  }
  if (status === "error") {
    return <BackNote text="Gagal memuat course." />;
  }
  if (status === "not-found") {
    return <BackNote text="Course tidak ditemukan." />;
  }

  const heading = isEdit ? form.title || "Course" : "Course baru";
  const subLabel = isEdit ? courseId : effectiveId || "slug-otomatis";

  return (
    <div className="mx-auto flex max-w-[1200px] flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col gap-4">
        <Link
          to="/admin"
          className="inline-flex w-fit items-center gap-1.5 text-xs font-medium text-zinc-400 transition-colors hover:text-zinc-700"
        >
          <ArrowLeft size={13} /> Semua course
        </Link>

        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3.5">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-sky-50 text-sky-600">
              <SubjectIcon name={form.icon} size={24} />
            </span>
            <div className="min-w-0">
              <h1 className="truncate text-xl font-bold tracking-tight text-zinc-900">
                {heading}
              </h1>
              <p className="mt-0.5 truncate font-mono text-xs text-zinc-400">
                {subLabel}
              </p>
            </div>
          </div>

          {isEdit && (
            <div className="flex items-center gap-3">
              <span
                className={`inline-flex items-center gap-1 text-xs font-medium text-emerald-600 transition-opacity duration-300 ${
                  saved ? "opacity-100" : "opacity-0"
                }`}
              >
                <Check size={13} strokeWidth={3} /> tersimpan
              </span>
              <button
                type="submit"
                form="course-meta"
                disabled={busy}
                className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white shadow-sm shadow-brand-500/25 transition-colors hover:bg-brand-600 disabled:opacity-50"
              >
                {busy ? "Menyimpan…" : "Simpan detail"}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Body */}
      <div
        className={
          isEdit
            ? "grid gap-6 lg:grid-cols-[minmax(0,340px)_minmax(0,1fr)] lg:items-start"
            : "max-w-xl"
        }
      >
        <form
          id="course-meta"
          onSubmit={handleSubmit}
          className={`overflow-hidden rounded-2xl border border-zinc-200/80 bg-white ${
            isEdit ? "lg:sticky lg:top-0" : ""
          }`}
        >
          <div className="border-b border-zinc-100 px-5 py-3">
            <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-zinc-400">
              Detail
            </span>
          </div>

          <div className="flex flex-col gap-4 p-5">
            <Field label="Judul">
              <input
                value={form.title}
                onChange={(e) => set("title", e.target.value)}
                required
                className={inputCls}
                placeholder="PATOM Matematika 26/27 - 1"
              />
            </Field>

            <Field
              label="ID / slug"
              hint={
                isEdit
                  ? "tidak bisa diubah"
                  : "otomatis dari judul, boleh diubah"
              }
            >
              <input
                value={effectiveId}
                onChange={(e) => {
                  setIdTouched(true);
                  set("id", e.target.value);
                }}
                disabled={isEdit}
                className={`${inputCls} font-mono`}
                placeholder="patom-mtk-2627-1"
              />
            </Field>

            <Field label="Deskripsi">
              <textarea
                value={form.description}
                onChange={(e) => set("description", e.target.value)}
                rows={3}
                className={`${inputCls} resize-y`}
                placeholder="Pathway to Mastery Matematika 2026/2027 Term 1"
              />
            </Field>

            <Field
              label="Passcode enroll"
              hint="kosongin = siapa aja bisa enroll"
            >
              <input
                value={form.passcode}
                onChange={(e) => set("passcode", e.target.value)}
                autoComplete="off"
                className={`${inputCls} font-mono`}
                placeholder="mis. MTK-2627"
              />
            </Field>

            <Field label="Ikon">
              <div className="flex gap-2">
                {ICONS.map((name) => {
                  const active = form.icon === name;
                  return (
                    <button
                      type="button"
                      key={name}
                      onClick={() => set("icon", name)}
                      aria-pressed={active}
                      aria-label={name}
                      className={`grid h-10 w-10 place-items-center rounded-xl border transition-all ${
                        active
                          ? "border-brand-500 bg-brand-50 text-brand-600 ring-2 ring-brand-500/20"
                          : "border-zinc-200 text-zinc-400 hover:border-zinc-300 hover:text-zinc-600"
                      }`}
                    >
                      <SubjectIcon name={name} size={18} />
                    </button>
                  );
                })}
              </div>
            </Field>

            {error && <p className="text-xs text-rose-600">{error}</p>}

            {!isEdit && (
              <div className="flex items-center gap-3 pt-1">
                <button
                  type="submit"
                  disabled={busy}
                  className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-600 disabled:opacity-50"
                >
                  {busy ? "Menyimpan…" : "Buat course"}
                </button>
                <Link
                  to="/admin"
                  className="rounded-lg border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-50"
                >
                  Batal
                </Link>
              </div>
            )}
          </div>
        </form>

        {isEdit && status === "ready" && (
          <CurriculumEditor courseId={courseId} />
        )}
      </div>

      {isEdit && status === "ready" && (
        <EnrolledStudents courseId={courseId} />
      )}

      {isEdit && status === "ready" && (
        <CourseSessionRecap courseId={courseId} />
      )}
    </div>
  );
}

function Field({ label, hint, children }) {
  return (
    <label className="block">
      <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-zinc-400">
        {label}
      </span>
      {hint && (
        <span className="ml-2 text-[11px] font-normal normal-case tracking-normal text-zinc-400">
          {hint}
        </span>
      )}
      <div className="mt-1.5">{children}</div>
    </label>
  );
}

function BackNote({ text }) {
  return (
    <p className="text-sm text-zinc-500">
      {text}{" "}
      <Link to="/admin" className="font-semibold text-brand-600">
        Kembali
      </Link>
    </p>
  );
}
