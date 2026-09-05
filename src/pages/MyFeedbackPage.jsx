import { useEffect, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { ArrowLeft, MessageSquareHeart } from "lucide-react";
import { useCourse } from "../hooks/useCourse";
import { getMyFeedback } from "../lib/forms";
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
    const n = Math.max(0, Math.min(5, Math.round(Number(v) || 0)));
    return "★".repeat(n) + "☆".repeat(5 - n);
  }
  return Array.isArray(v) ? v.join(", ") : String(v);
};

// Satu entri = satu respons anonim. Dikelompokkan per ronde (lesson)
// karena satu ronde bisa punya banyak pengirim.
function groupByLesson(entries) {
  const byLesson = new Map();
  for (const e of entries) {
    if (!byLesson.has(e.lessonId)) {
      byLesson.set(e.lessonId, { lessonId: e.lessonId, title: e.title, entries: [] });
    }
    byLesson.get(e.lessonId).entries.push(e);
  }
  return [...byLesson.values()];
}

export default function MyFeedbackPage() {
  const { courseId } = useParams();
  const { status, course, canView } = useCourse(courseId);
  const [state, setState] = useState({ status: "loading", rounds: [] });

  useEffect(() => {
    if (status !== "ready" || !canView || !course) return;
    let alive = true;
    getMyFeedback(courseId)
      .then((entries) => {
        if (alive) setState({ status: "ready", rounds: groupByLesson(entries) });
      })
      .catch((err) => {
        console.error("[MyFeedbackPage] gagal memuat feedback:", err);
        if (alive) setState({ status: "error", rounds: [] });
      });
    return () => {
      alive = false;
    };
  }, [status, canView, course, courseId]);

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

  const { rounds } = state;
  const totalEntries = rounds.reduce((n, r) => n + r.entries.length, 0);

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-5">
      <div>
        {backLink}
        <h1 className="mt-3 text-xl font-bold tracking-tight text-zinc-900">
          Feedback Buat Saya
        </h1>
        <p className="mt-1 text-xs text-zinc-500">
          {course.title}
          <span className="ml-1.5 text-zinc-400">
            · pengirim disamarkan, nggak ketahuan siapa
          </span>
        </p>
      </div>

      {state.status === "loading" ? (
        <Skeleton className="h-40 w-full rounded-2xl" />
      ) : state.status === "error" ? (
        <p className="rounded-2xl border border-dashed border-rose-300 bg-white px-6 py-10 text-center text-sm text-rose-500">
          Gagal memuat feedback.
        </p>
      ) : rounds.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-zinc-300 bg-white px-6 py-12 text-center">
          <MessageSquareHeart size={22} className="mx-auto text-zinc-300" />
          <p className="mt-2 text-sm text-zinc-400">
            Belum ada feedback buat kamu di course ini.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <p className="text-xs text-zinc-400">
            {totalEntries} feedback · {rounds.length} ronde
          </p>
          {rounds.map((round) => (
            <div
              key={round.lessonId}
              className="overflow-hidden rounded-2xl border border-zinc-200/80 bg-white"
            >
              <div className="flex items-center justify-between gap-3 border-b border-zinc-100 px-5 py-3">
                <p className="text-sm font-bold tracking-tight text-zinc-900">
                  {round.title}
                </p>
                <span className="shrink-0 rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-semibold text-zinc-500">
                  {round.entries.length} feedback
                </span>
              </div>
              <ul className="divide-y divide-zinc-100">
                {round.entries.map((e, i) => (
                  <li key={i} className="p-5">
                    <p className="text-[11px] font-medium text-zinc-400">
                      {fmtSent(e.at)}
                    </p>
                    {e.answers.length > 0 && (
                      <dl className="mt-2 flex flex-col gap-2.5">
                        {e.answers.map((a, j) => (
                          <div key={j}>
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
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
