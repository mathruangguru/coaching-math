import { useEffect, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { ArrowLeft, NotebookPen } from "lucide-react";
import { useCourse } from "../hooks/useCourse";
import { getMyRefleksiEntries } from "../lib/forms";
import Skeleton from "../components/ui/Skeleton";

const fmtSent = (iso) => {
  const d = new Date(iso);
  const tgl = d.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const jam = d
    .toLocaleTimeString("id-ID", {
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
    .replace(/\./g, ":");
  return `${tgl} · ${jam}`;
};

const fmtAnswer = (a) => {
  const v = a.value;
  if (v == null || v === "" || (Array.isArray(v) && v.length === 0)) return "—";
  if (a.type === "rating") {
    const max = a.scaleMax || 5;
    const n = Math.max(0, Math.min(max, Math.round(Number(v) || 0)));
    return "★".repeat(n) + "☆".repeat(max - n);
  }
  return Array.isArray(v) ? v.join(", ") : String(v);
};

export default function MyRefleksiPage() {
  const { courseId } = useParams();
  const { status, course, canView } = useCourse(courseId);
  const [state, setState] = useState({ status: "loading", entries: [] });

  useEffect(() => {
    if (status !== "ready" || !canView || !course) return;
    const rLessons = (course.sections ?? [])
      .flatMap((s) => s.items ?? [])
      .filter((it) => it.type === "refleksi" && it.form_id)
      .map((it) => ({ id: it.id, title: it.title, form_id: it.form_id }));
    let alive = true;
    getMyRefleksiEntries(rLessons)
      .then((entries) => {
        if (alive) setState({ status: "ready", entries });
      })
      .catch((err) => {
        console.error("[MyRefleksiPage] gagal memuat refleksi:", err);
        if (alive) setState({ status: "error", entries: [] });
      });
    return () => {
      alive = false;
    };
  }, [status, canView, course]);

  const backLink = (
    <Link
      to={`/course/${courseId}`}
      className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-500 transition-colors hover:text-zinc-800"
    >
      <ArrowLeft size={14} /> Kembali ke course
    </Link>
  );

  if (status === "loading") {
    return (
      <div className="mx-auto flex max-w-2xl flex-col gap-4">
        <Skeleton className="h-3 w-28" />
        <Skeleton className="h-7 w-2/3" />
        <Skeleton className="h-40 w-full rounded-2xl" />
      </div>
    );
  }

  if (status === "not-found" || status === "error") {
    return (
      <div className="mx-auto max-w-2xl">
        <p className="text-sm text-zinc-500">
          {status === "not-found"
            ? "Course tidak ditemukan. "
            : "Gagal memuat course. "}
          <Link to="/course" className="font-semibold text-brand-600">
            Kembali ke daftar
          </Link>
        </p>
      </div>
    );
  }

  if (!canView) return <Navigate replace to={`/course/${courseId}`} />;

  const { entries } = state;

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-5">
      <div>
        {backLink}
        <h1 className="mt-3 text-xl font-bold tracking-tight text-zinc-900">
          Refleksi Saya
        </h1>
        <p className="mt-1 text-xs text-zinc-500">{course.title}</p>
      </div>

      {state.status === "loading" ? (
        <Skeleton className="h-40 w-full rounded-2xl" />
      ) : state.status === "error" ? (
        <p className="rounded-2xl border border-dashed border-rose-300 bg-white px-6 py-10 text-center text-sm text-rose-500">
          Gagal memuat refleksi.
        </p>
      ) : entries.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-zinc-300 bg-white px-6 py-12 text-center">
          <NotebookPen size={22} className="mx-auto text-zinc-300" />
          <p className="mt-2 text-sm text-zinc-400">
            Kamu belum pernah mengirim refleksi di course ini.
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {entries.map((e) => (
            <li
              key={`${e.lessonId}-${e.at}`}
              className="rounded-2xl border border-zinc-200/80 bg-white p-5"
            >
              <div className="flex items-baseline justify-between gap-3">
                <p className="text-sm font-bold tracking-tight text-zinc-900">
                  {e.title}
                </p>
                <span className="shrink-0 text-[11px] text-zinc-400">
                  {fmtSent(e.at)}
                </span>
              </div>
              {e.answers.length > 0 && (
                <dl className="mt-3 flex flex-col gap-3">
                  {e.answers.map((a, i) => (
                    <div key={i}>
                      <dt className="text-[11px] font-medium uppercase tracking-wide text-zinc-400">
                        {a.label}
                      </dt>
                      <dd className="mt-0.5 whitespace-pre-wrap text-sm leading-relaxed text-zinc-700">
                        {fmtAnswer(a)}
                      </dd>
                    </div>
                  ))}
                </dl>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
