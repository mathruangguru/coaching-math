import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Check } from "lucide-react";
import { getCourse } from "../lib/courses";
import { getForm, submitFormResponse } from "../lib/forms";
import { useAuth } from "../context/auth-context";
import Skeleton from "../components/ui/Skeleton";

const inputCls =
  "mt-1.5 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 outline-none transition-colors focus:border-brand-500";

const profileFullName = (p) =>
  [p?.first_name, p?.last_name].filter(Boolean).join(" ");

const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
};

export default function FormPage() {
  const { courseId, lessonId } = useParams();
  const { profile } = useAuth();
  const [data, setData] = useState({ status: "loading" });
  const [values, setValues] = useState({}); // { fieldId: string | string[] }
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const course = await getCourse(courseId);
        const lesson = course?.sections
          .flatMap((s) => s.items)
          .find((i) => i.id === lessonId);
        if (!alive) return;
        if (!lesson) return setData({ status: "not-found" });
        if (!lesson.form_id)
          return setData({ status: "ready", course, lesson, form: null });
        const form = await getForm(lesson.form_id);
        if (!alive) return;
        setData({ status: "ready", course, lesson, form });
      } catch (e) {
        console.error("[FormPage] gagal memuat:", e);
        if (alive) setData({ status: "error" });
      }
    })();
    return () => {
      alive = false;
    };
  }, [courseId, lessonId]);

  const backLink = (
    <Link
      to={`/course/${courseId}/materi`}
      className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-500 transition-colors hover:text-zinc-800"
    >
      <ArrowLeft size={14} /> Kembali ke materi
    </Link>
  );

  if (data.status === "loading")
    return (
      <div className="mx-auto flex max-w-2xl flex-col gap-4">
        <Skeleton className="h-3 w-32" />
        <Skeleton className="h-6 w-2/3" />
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    );
  if (data.status === "error")
    return (
      <div className="mx-auto max-w-2xl">
        {backLink}
        <p className="mt-4 text-sm text-zinc-500">Gagal memuat form.</p>
      </div>
    );
  if (data.status === "not-found")
    return (
      <div className="mx-auto max-w-2xl">
        {backLink}
        <p className="mt-4 text-sm text-zinc-500">Materi tidak ditemukan.</p>
      </div>
    );

  const { course, lesson, form } = data;

  const header = (
    <div>
      <p className="text-xs text-zinc-400">{course.title}</p>
      <h1 className="mt-1 text-xl font-bold tracking-tight text-zinc-900">
        {lesson.title}
      </h1>
      {form?.description && (
        <p className="mt-1 text-xs text-zinc-500">{form.description}</p>
      )}
    </div>
  );

  if (!form || form.fields.length === 0)
    return (
      <div className="mx-auto flex max-w-2xl flex-col gap-5">
        {backLink}
        {header}
        <p className="rounded-2xl border border-dashed border-zinc-300 bg-white px-6 py-10 text-center text-sm text-zinc-400">
          Form belum tersedia.
        </p>
      </div>
    );

  if (sent)
    return (
      <div className="mx-auto flex max-w-2xl flex-col gap-5">
        {backLink}
        {header}
        <div className="rounded-2xl border border-zinc-200/80 bg-white p-8 text-center">
          <span className="mx-auto grid h-10 w-10 place-items-center rounded-full bg-teal-500 text-white">
            <Check size={18} strokeWidth={3} />
          </span>
          <p className="mt-3 text-sm font-semibold text-zinc-900">
            Respons terkirim. Terima kasih!
          </p>
          <button
            type="button"
            onClick={() => {
              setValues({});
              setSent(false);
            }}
            className="mt-4 rounded-lg border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-50"
          >
            Isi lagi
          </button>
        </div>
      </div>
    );

  // Nilai efektif: name/email auto dari profil kalau belum diisi.
  const valueFor = (f) => {
    if (f.id in values) return values[f.id];
    if (f.type === "name") return profileFullName(profile);
    if (f.type === "email") return profile?.email ?? "";
    if (f.type === "date") return todayISO();
    return f.type === "multi" || f.type === "check" ? [] : "";
  };

  const setVal = (id, v) => setValues((s) => ({ ...s, [id]: v }));
  const toggleInArray = (id, opt) =>
    setValues((s) => {
      const cur = Array.isArray(s[id]) ? s[id] : [];
      return {
        ...s,
        [id]: cur.includes(opt) ? cur.filter((x) => x !== opt) : [...cur, opt],
      };
    });

  const missing = form.fields.filter((f) => {
    if (!f.required) return false;
    const v = valueFor(f);
    if (f.type === "check")
      return (f.options ?? []).some((opt) => !v.includes(opt));
    return Array.isArray(v) ? v.length === 0 : !String(v ?? "").trim();
  });

  const submit = async (e) => {
    e.preventDefault();
    setErr("");
    if (missing.length) {
      setErr(`Masih ada ${missing.length} isian wajib yang belum lengkap.`);
      return;
    }
    setBusy(true);
    try {
      const payload = {};
      for (const f of form.fields) payload[f.id] = valueFor(f);
      await submitFormResponse(form.id, lessonId, payload);
      setSent(true);
    } catch (e2) {
      setErr(e2?.message ?? "Gagal mengirim.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="mx-auto flex max-w-2xl flex-col gap-5">
      {backLink}
      {header}

      {form.fields.map((f) => (
        <div
          key={f.id}
          className="rounded-2xl border border-zinc-200/80 bg-white p-5"
        >
          <p className="text-sm font-medium text-zinc-900">
            {f.label || "(tanpa label)"}
            {f.required && <span className="text-rose-500"> *</span>}
          </p>

          {f.type === "short" && (
            <input
              value={valueFor(f)}
              onChange={(e) => setVal(f.id, e.target.value)}
              className={inputCls}
            />
          )}
          {(f.type === "name" || f.type === "email") && (
            <input
              type={f.type === "email" ? "email" : "text"}
              value={valueFor(f)}
              readOnly
              className={`${inputCls} cursor-not-allowed bg-zinc-50 text-zinc-500`}
            />
          )}
          {f.type === "long" && (
            <textarea
              rows={3}
              value={valueFor(f)}
              onChange={(e) => setVal(f.id, e.target.value)}
              className={`${inputCls} resize-y`}
            />
          )}
          {f.type === "date" && (
            <input
              type="date"
              value={valueFor(f)}
              onChange={(e) => setVal(f.id, e.target.value)}
              className={`${inputCls} sm:w-auto`}
            />
          )}
          {f.type === "single" && (
            <div className="mt-2 flex flex-col gap-1.5">
              {(f.options ?? []).map((opt, oi) => (
                <label
                  key={oi}
                  className="flex cursor-pointer items-center gap-2 text-sm text-zinc-700"
                >
                  <input
                    type="radio"
                    name={f.id}
                    checked={valueFor(f) === opt}
                    onChange={() => setVal(f.id, opt)}
                  />
                  {opt}
                </label>
              ))}
            </div>
          )}
          {(f.type === "multi" || f.type === "check") && (
            <div className="mt-2 flex flex-col gap-2">
              {(f.options ?? []).map((opt, oi) => (
                <label
                  key={oi}
                  className="flex cursor-pointer items-start gap-2 text-sm text-zinc-700"
                >
                  <input
                    type="checkbox"
                    className="mt-0.5"
                    checked={valueFor(f).includes(opt)}
                    onChange={() => toggleInArray(f.id, opt)}
                  />
                  {opt}
                </label>
              ))}
            </div>
          )}
        </div>
      ))}

      {err && <p className="text-xs text-rose-600">{err}</p>}

      <button
        type="submit"
        disabled={busy}
        className="w-fit rounded-lg bg-brand-500 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-600 disabled:opacity-50"
      >
        {busy ? "Mengirim…" : "Kirim"}
      </button>
    </form>
  );
}
