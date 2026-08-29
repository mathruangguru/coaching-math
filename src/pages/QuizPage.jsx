import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Check, X } from "lucide-react";
import { getCourse } from "../lib/courses";
import { getQuestionSet, getLastAttempt, submitQuiz } from "../lib/quiz";
import Skeleton from "../components/ui/Skeleton";
import MathText from "../components/ui/MathText";

export default function QuizPage() {
  const { courseId, lessonId } = useParams();
  const [data, setData] = useState({ status: "loading" });
  const [answers, setAnswers] = useState({}); // { qid: idx }
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null); // { score, total, results }
  const [lastAttempt, setLastAttempt] = useState(null);

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
        if (!lesson.question_set_id)
          return setData({ status: "ready", course, lesson, set: null });

        const set = await getQuestionSet(lesson.question_set_id);
        if (!alive) return;
        setData({ status: "ready", course, lesson, set });
        getLastAttempt(lessonId)
          .then((a) => alive && setLastAttempt(a))
          .catch(() => {});
      } catch (err) {
        console.error("[QuizPage] gagal memuat:", err);
        if (alive) setData({ status: "error" });
      }
    })();

    return () => {
      alive = false;
    };
  }, [courseId, lessonId]);

  const backLink = (
    <Link
      to={`/course/${courseId}`}
      className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-500 transition-colors hover:text-zinc-800"
    >
      <ArrowLeft size={14} /> Kembali ke course
    </Link>
  );

  if (data.status === "loading") {
    return (
      <div className="mx-auto flex max-w-2xl flex-col gap-4">
        <Skeleton className="h-3 w-32" />
        <Skeleton className="h-6 w-2/3" />
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-28 w-full rounded-2xl" />
        ))}
      </div>
    );
  }
  if (data.status === "error")
    return (
      <div className="mx-auto max-w-2xl">
        {backLink}
        <p className="mt-4 text-sm text-zinc-500">Gagal memuat soal.</p>
      </div>
    );
  if (data.status === "not-found")
    return (
      <div className="mx-auto max-w-2xl">
        {backLink}
        <p className="mt-4 text-sm text-zinc-500">Materi tidak ditemukan.</p>
      </div>
    );

  const { course, lesson, set } = data;
  const questions = set?.questions ?? [];

  const submit = async () => {
    setBusy(true);
    try {
      const res = await submitQuiz(lessonId, set.id, answers);
      setResult(res);
      getLastAttempt(lessonId)
        .then(setLastAttempt)
        .catch(() => {});
    } catch (err) {
      window.alert(err?.message ?? "Gagal submit.");
    } finally {
      setBusy(false);
    }
  };

  const retry = () => {
    setResult(null);
    setAnswers({});
  };

  const allAnswered =
    questions.length > 0 && questions.every((q) => answers[q.id] != null);

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-5">
      {backLink}

      <div>
        <p className="text-xs text-zinc-400">{course.title}</p>
        <h1 className="mt-1 text-xl font-bold tracking-tight text-zinc-900">
          {lesson.title}
        </h1>
        {set?.description && (
          <p className="mt-1 text-xs text-zinc-500">{set.description}</p>
        )}
      </div>

      {!set || questions.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-zinc-300 bg-white px-6 py-10 text-center text-sm text-zinc-400">
          Soal belum tersedia.
        </p>
      ) : result ? (
        <>
          <div className="rounded-2xl border border-zinc-200/80 bg-white p-6 text-center">
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
              Skor kamu
            </p>
            <p className="mt-1 text-3xl font-bold text-zinc-900">
              {result.score}
              <span className="text-lg text-zinc-400"> / {result.total}</span>
            </p>
          </div>

          {questions.map((q, i) => {
            const ok = result.results[q.id];
            const chosen = answers[q.id];
            return (
              <div
                key={q.id}
                className="rounded-2xl border border-zinc-200/80 bg-white p-5"
              >
                <div className="flex items-start gap-2">
                  <span
                    className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full text-white ${
                      ok ? "bg-teal-500" : "bg-rose-500"
                    }`}
                  >
                    {ok ? <Check size={12} strokeWidth={3} /> : <X size={12} strokeWidth={3} />}
                  </span>
                  <p className="text-sm font-medium text-zinc-900">
                    {i + 1}.{" "}
                    <MathText>{q.prompt}</MathText>
                  </p>
                </div>
                <ul className="mt-2 flex flex-col gap-1 pl-7">
                  {q.options.map((opt, oi) => (
                    <li
                      key={oi}
                      className={`text-sm ${
                        oi === chosen
                          ? ok
                            ? "font-semibold text-teal-700"
                            : "font-semibold text-rose-700"
                          : "text-zinc-500"
                      }`}
                    >
                      <MathText>{opt}</MathText>
                      {oi === chosen ? " ← jawabanmu" : ""}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}

          <button
            onClick={retry}
            className="w-fit rounded-lg border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-50"
          >
            Ulangi
          </button>
        </>
      ) : (
        <>
          {lastAttempt && (
            <p className="rounded-lg bg-zinc-50 px-3 py-2 text-xs text-zinc-500">
              Skor terakhir: {lastAttempt.score} / {lastAttempt.total}
            </p>
          )}

          {questions.map((q, i) => (
            <div
              key={q.id}
              className="rounded-2xl border border-zinc-200/80 bg-white p-5"
            >
              <p className="text-sm font-medium text-zinc-900">
                {i + 1}. <MathText>{q.prompt}</MathText>
              </p>
              <div className="mt-3 flex flex-col gap-2">
                {q.options.map((opt, oi) => (
                  <label
                    key={oi}
                    className={`flex cursor-pointer items-start gap-2.5 rounded-lg border px-3 py-2 text-sm transition-colors ${
                      answers[q.id] === oi
                        ? "border-brand-500 bg-brand-50 text-brand-800"
                        : "border-zinc-200 text-zinc-700 hover:bg-zinc-50"
                    }`}
                  >
                    <input
                      type="radio"
                      name={q.id}
                      checked={answers[q.id] === oi}
                      onChange={() =>
                        setAnswers((a) => ({ ...a, [q.id]: oi }))
                      }
                      className="mt-0.5 accent-brand-500"
                    />
                    <MathText>{opt}</MathText>
                  </label>
                ))}
              </div>
            </div>
          ))}

          <button
            onClick={submit}
            disabled={busy || !allAnswered}
            className="w-fit rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-600 disabled:opacity-50"
          >
            {busy
              ? "Mengirim…"
              : allAnswered
                ? "Kirim jawaban"
                : "Jawab semua soal dulu"}
          </button>
        </>
      )}
    </div>
  );
}
