import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Check } from "lucide-react";
import { getCourse } from "../lib/courses";
import { getMyReflection, saveReflection } from "../lib/sessions";
import Skeleton from "../components/ui/Skeleton";

export default function RefleksiPage() {
  const { courseId, lessonId } = useParams();
  const [data, setData] = useState({ status: "loading" });
  const [body, setBody] = useState("");
  const [savedAt, setSavedAt] = useState(null);
  const [busy, setBusy] = useState(false);
  const [ok, setOk] = useState(false);
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
        const mine = await getMyReflection(lessonId).catch(() => null);
        if (!alive) return;
        if (mine) {
          setBody(mine.body ?? "");
          setSavedAt(mine.updated_at ?? null);
        }
        setData({ status: "ready", course, lesson });
      } catch (e) {
        console.error("[RefleksiPage] gagal memuat:", e);
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
        <Skeleton className="h-48 w-full rounded-2xl" />
      </div>
    );
  if (data.status !== "ready")
    return (
      <div className="mx-auto max-w-2xl">
        {backLink}
        <p className="mt-4 text-sm text-zinc-500">
          {data.status === "not-found"
            ? "Materi tidak ditemukan."
            : "Gagal memuat refleksi."}
        </p>
      </div>
    );

  const { course, lesson } = data;

  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    setOk(false);
    setErr("");
    try {
      await saveReflection(lessonId, body);
      setSavedAt(new Date().toISOString());
      setOk(true);
      setTimeout(() => setOk(false), 2500);
    } catch (e2) {
      setErr(e2?.message ?? "Gagal menyimpan.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={save} className="mx-auto flex max-w-2xl flex-col gap-5">
      {backLink}
      <div>
        <p className="text-xs text-zinc-400">{course.title}</p>
        <h1 className="mt-1 text-xl font-bold tracking-tight text-zinc-900">
          {lesson.title}
        </h1>
      </div>

      <div className="rounded-2xl border border-zinc-200/80 bg-white p-5">
        <p className="text-sm font-medium text-zinc-900">
          {lesson.prompt || "Tulis refleksi kamu tentang pertemuan ini."}
        </p>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={8}
          placeholder="Tulis di sini…"
          className="mt-3 w-full resize-y rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 outline-none transition-colors focus:border-brand-500"
        />
        <div className="mt-3 flex items-center gap-3">
          <button
            type="submit"
            disabled={busy || !body.trim()}
            className="rounded-lg bg-brand-500 px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-600 disabled:opacity-50"
          >
            {busy ? "Menyimpan…" : savedAt ? "Simpan perubahan" : "Simpan"}
          </button>
          {ok && (
            <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600">
              <Check size={13} strokeWidth={3} /> tersimpan
            </span>
          )}
          {savedAt && !ok && (
            <span className="text-xs text-zinc-400">
              Terakhir disimpan{" "}
              {new Date(savedAt).toLocaleString("id-ID", {
                day: "numeric",
                month: "short",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          )}
        </div>
        {err && <p className="mt-2 text-xs text-rose-600">{err}</p>}
      </div>
    </form>
  );
}
