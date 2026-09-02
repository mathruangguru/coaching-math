import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, UserCheck, Check } from "lucide-react";
import { getCourse } from "../lib/courses";
import { getMyAttendance, checkIn } from "../lib/sessions";
import Skeleton from "../components/ui/Skeleton";

const fmtTime = (iso) => {
  try {
    return new Date(iso).toLocaleString("id-ID", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
};

export default function PresensiPage() {
  const { courseId, lessonId } = useParams();
  const [data, setData] = useState({ status: "loading" });
  const [at, setAt] = useState(null); // ISO waktu presensi
  const [busy, setBusy] = useState(false);
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
        const mine = await getMyAttendance(lessonId).catch(() => null);
        if (!alive) return;
        setAt(mine);
        setData({ status: "ready", course, lesson });
      } catch (e) {
        console.error("[PresensiPage] gagal memuat:", e);
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
        <Skeleton className="h-40 w-full rounded-2xl" />
      </div>
    );
  if (data.status !== "ready")
    return (
      <div className="mx-auto max-w-2xl">
        {backLink}
        <p className="mt-4 text-sm text-zinc-500">
          {data.status === "not-found"
            ? "Materi tidak ditemukan."
            : "Gagal memuat presensi."}
        </p>
      </div>
    );

  const { course, lesson } = data;

  const doCheckIn = async () => {
    setBusy(true);
    setErr("");
    try {
      await checkIn(lessonId);
      setAt(new Date().toISOString());
    } catch (e) {
      setErr(e?.message ?? "Gagal presensi.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-5">
      {backLink}
      <div>
        <p className="text-xs text-zinc-400">{course.title}</p>
        <h1 className="mt-1 text-xl font-bold tracking-tight text-zinc-900">
          {lesson.title}
        </h1>
      </div>

      <div className="rounded-2xl border border-zinc-200/80 bg-white p-8 text-center">
        {at ? (
          <>
            <span className="mx-auto grid h-11 w-11 place-items-center rounded-full bg-emerald-500 text-white">
              <Check size={20} strokeWidth={3} />
            </span>
            <p className="mt-3 text-sm font-semibold text-zinc-900">
              Kamu sudah presensi
            </p>
            <p className="mt-0.5 text-xs text-zinc-400">{fmtTime(at)}</p>
          </>
        ) : (
          <>
            <p className="text-sm text-zinc-500">
              Klik tombol di bawah buat mencatat kehadiran kamu di pertemuan ini.
            </p>
            <button
              type="button"
              onClick={doCheckIn}
              disabled={busy}
              className="mt-4 inline-flex items-center gap-2 rounded-xl bg-brand-500 px-6 py-2.5 text-sm font-bold text-white transition-colors hover:bg-brand-600 disabled:opacity-50"
            >
              <UserCheck size={16} /> {busy ? "Mencatat…" : "Saya Hadir"}
            </button>
            {err && <p className="mt-2 text-xs text-rose-600">{err}</p>}
          </>
        )}
      </div>
    </div>
  );
}
