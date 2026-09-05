import { useEffect, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { ArrowLeft, MessageSquareHeart } from "lucide-react";
import { useCourse } from "../hooks/useCourse";
import { getMyFeedback } from "../lib/forms";
import FormSummary from "../components/ui/FormSummary";
import Skeleton from "../components/ui/Skeleton";

export default function MyFeedbackPage() {
  const { courseId } = useParams();
  const { status, course, canView } = useCourse(courseId);
  const [state, setState] = useState({ status: "loading", rounds: [] });

  useEffect(() => {
    if (status !== "ready" || !canView || !course) return;
    let alive = true;
    getMyFeedback(courseId)
      .then((rounds) => {
        if (alive) setState({ status: "ready", rounds });
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

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-5">
      <div>
        {backLink}
        <h1 className="mt-3 text-xl font-bold tracking-tight text-zinc-900">
          Feedback untuk Saya
        </h1>
        <p className="mt-1 text-xs text-zinc-500">{course.title}</p>
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
          {rounds.map((round) => (
            <div key={round.lessonId} className="flex flex-col gap-2">
              <p className="text-sm font-bold tracking-tight text-zinc-900">
                {round.title}
              </p>
              {round.form ? (
                <FormSummary
                  form={round.form}
                  responses={round.responses}
                  paged
                />
              ) : (
                <p className="text-xs text-zinc-400">
                  Form pertanyaan nggak ditemukan.
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
