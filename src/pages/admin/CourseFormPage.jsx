import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { getCourse, createCourse, updateCourse } from "../../lib/courses";
import { subjectIcons } from "../../lib/subjectIcons";
import SubjectIcon from "../../components/ui/SubjectIcon";
import Skeleton from "../../components/ui/Skeleton";
import CurriculumEditor from "../../components/admin/CurriculumEditor";

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
  });
  const [idTouched, setIdTouched] = useState(false);
  const [status, setStatus] = useState(isEdit ? "loading" : "ready");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!isEdit) return;
    let alive = true;

    getCourse(courseId)
      .then((data) => {
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
        setSaved(true);
        setBusy(false);
      } else {
        await createCourse({
          id: effectiveId,
          title,
          description,
          icon: form.icon,
        });
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
    return <Skeleton className="h-80 w-full rounded-2xl" />;
  }
  if (status === "error") {
    return <BackNote text="Gagal memuat course." />;
  }
  if (status === "not-found") {
    return <BackNote text="Course tidak ditemukan." />;
  }

  return (
    <div className="flex flex-col gap-5">
      <Link
        to="/admin"
        className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-500 transition-colors hover:text-zinc-800"
      >
        <ArrowLeft size={14} /> Semua course
      </Link>

      <h1 className="text-xl font-bold tracking-tight text-zinc-900">
        {isEdit ? "Edit course" : "Course baru"}
      </h1>

      <div
        className={
          isEdit
            ? "grid gap-6 lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)] lg:items-start"
            : "max-w-xl"
        }
      >
        <form
          onSubmit={handleSubmit}
          className={`flex flex-col gap-4 rounded-2xl border border-zinc-200 bg-white p-6 ${
            isEdit ? "lg:sticky lg:top-0" : ""
          }`}
        >
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
                ? "Tidak bisa diubah."
                : "Dipakai di URL. Otomatis dari judul, boleh diubah."
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
                    className={`grid h-10 w-10 place-items-center rounded-lg border-2 transition-colors ${
                      active
                        ? "border-brand-500 bg-brand-50 text-brand-600"
                        : "border-zinc-200 text-zinc-400 hover:border-zinc-300"
                    }`}
                  >
                    <SubjectIcon name={name} size={18} />
                  </button>
                );
              })}
            </div>
          </Field>

          {error && <p className="text-xs text-rose-600">{error}</p>}

          <div className="flex items-center gap-3 pt-1">
            <button
              type="submit"
              disabled={busy}
              className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-600 disabled:opacity-50"
            >
              {busy ? "Menyimpan…" : "Simpan"}
            </button>
            <Link
              to="/admin"
              className="rounded-lg border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-50"
            >
              {isEdit ? "Selesai" : "Batal"}
            </Link>
            {saved && (
              <span className="text-xs text-emerald-600">tersimpan</span>
            )}
          </div>
        </form>

        {isEdit && status === "ready" && (
          <CurriculumEditor courseId={courseId} />
        )}
      </div>
    </div>
  );
}

function Field({ label, hint, children }) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-zinc-600">{label}</span>
      {hint && (
        <span className="ml-2 text-xs font-normal text-zinc-400">{hint}</span>
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
