import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Check,
  X,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { getCourse } from "../lib/courses";
import { getQuestionSet, submitQuiz } from "../lib/quiz";
import Skeleton from "../components/ui/Skeleton";
import MathText from "../components/ui/MathText";

const GROUP = 10;

export default function QuizPage() {
  const { courseId, lessonId } = useParams();
  const [data, setData] = useState({ status: "loading" });
  const [answers, setAnswers] = useState({}); // { qid: idx }
  const [current, setCurrent] = useState(0);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null); // { score, total, results }

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
        <Skeleton className="h-64 w-full rounded-2xl" />
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
  const total = questions.length;

  const submit = async () => {
    setBusy(true);
    try {
      const res = await submitQuiz(lessonId, set.id, answers);
      setResult(res);
      setCurrent(0);
    } catch (err) {
      window.alert(err?.message ?? "Gagal submit.");
    } finally {
      setBusy(false);
    }
  };

  const retry = () => {
    setResult(null);
    setAnswers({});
    setCurrent(0);
  };

  const allAnswered =
    total > 0 && questions.every((q) => answers[q.id] != null);

  const header = (
    <div>
      <p className="text-xs text-zinc-400">{course.title}</p>
      <h1 className="mt-1 text-xl font-bold tracking-tight text-zinc-900">
        {lesson.title}
      </h1>
      {set?.description && (
        <p className="mt-1 text-xs text-zinc-500">{set.description}</p>
      )}
    </div>
  );

  // ── Soal belum ada ────────────────────────────────────────────────
  if (!set || total === 0) {
    return (
      <div className="mx-auto flex max-w-2xl flex-col gap-5">
        {backLink}
        {header}
        <p className="rounded-2xl border border-dashed border-zinc-300 bg-white px-6 py-10 text-center text-sm text-zinc-400">
          Soal belum tersedia.
        </p>
      </div>
    );
  }

  // ── Hasil ─────────────────────────────────────────────────────────
  if (result) {
    return (
      <div className="mx-auto flex max-w-2xl flex-col gap-5">
        {backLink}
        {header}

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
                  {ok ? (
                    <Check size={12} strokeWidth={3} />
                  ) : (
                    <X size={12} strokeWidth={3} />
                  )}
                </span>
                <p className="text-sm font-medium text-zinc-900">
                  {i + 1}. <MathText>{q.prompt}</MathText>
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
                    <span className="font-semibold text-zinc-400">
                      {String.fromCharCode(65 + oi)}.
                    </span>{" "}
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
      </div>
    );
  }

  // ── Ngerjakan (satu soal per layar) ──────────────────────────────
  const q = questions[current];
  const groupStart = Math.floor(current / GROUP) * GROUP;
  const groupEnd = Math.min(groupStart + GROUP, total);
  const isLast = current === total - 1;

  return (
    <div className="flex min-h-full flex-col">
      <div className="mx-auto my-auto flex w-full max-w-2xl flex-col gap-5 py-2">
        {backLink}
        {header}

        {/* Strip nomor soal, per 10 */}
        <div className="flex items-center gap-1.5">
          {groupStart > 0 && (
            <button
              type="button"
              onClick={() => setCurrent(groupStart - GROUP)}
              aria-label="10 soal sebelumnya"
              className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-zinc-200 text-zinc-500 transition-colors hover:bg-zinc-50"
            >
              <ChevronLeft size={15} />
            </button>
          )}
          <div className="flex flex-wrap gap-1.5">
            {Array.from({ length: groupEnd - groupStart }, (_, k) => {
              const idx = groupStart + k;
              const answered = answers[questions[idx].id] != null;
              const active = idx === current;
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setCurrent(idx)}
                  className={`h-8 w-8 shrink-0 rounded-lg border text-xs font-semibold transition-colors ${
                    active
                      ? "border-brand-500 bg-brand-500 text-white"
                      : answered
                        ? "border-teal-300 bg-teal-50 text-teal-700"
                        : "border-zinc-200 bg-white text-zinc-500 hover:bg-zinc-50"
                  }`}
                >
                  {idx + 1}
                </button>
              );
            })}
          </div>
          {groupEnd < total && (
            <button
              type="button"
              onClick={() => setCurrent(groupEnd)}
              aria-label="10 soal berikutnya"
              className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-zinc-200 text-zinc-500 transition-colors hover:bg-zinc-50"
            >
              <ChevronRight size={15} />
            </button>
          )}
        </div>

        {/* Soal */}
        <div className="rounded-2xl border border-zinc-200/80 bg-white p-5">
          <p className="text-xs text-zinc-400">
            Soal {current + 1} dari {total}
          </p>
          <p className="mt-1.5 text-sm font-medium text-zinc-900">
            <MathText>{q.prompt}</MathText>
          </p>
          <div className="mt-3 flex flex-col gap-2">
            {q.options.map((opt, oi) => {
              const picked = answers[q.id] === oi;
              return (
                <label
                  key={oi}
                  className={`flex cursor-pointer items-center gap-2.5 rounded-lg border px-3 py-2 text-sm transition-colors ${
                    picked
                      ? "border-brand-500 bg-brand-50 text-brand-800"
                      : "border-zinc-200 text-zinc-700 hover:bg-zinc-50"
                  }`}
                >
                  <input
                    type="radio"
                    name={q.id}
                    checked={picked}
                    onChange={() => setAnswers((a) => ({ ...a, [q.id]: oi }))}
                    className="sr-only"
                  />
                  <span
                    className={`grid h-6 w-6 shrink-0 place-items-center rounded-full border text-xs font-bold ${
                      picked
                        ? "border-brand-500 bg-brand-500 text-white"
                        : "border-zinc-300 text-zinc-500"
                    }`}
                  >
                    {String.fromCharCode(65 + oi)}
                  </span>
                  <MathText>{opt}</MathText>
                </label>
              );
            })}
          </div>
        </div>

        {/* Navigasi */}
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => setCurrent((c) => c - 1)}
            disabled={current === 0}
            className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 px-3.5 py-2 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-50 disabled:opacity-40"
          >
            <ChevronLeft size={15} /> Sebelumnya
          </button>

          {isLast ? (
            <button
              type="button"
              onClick={submit}
              disabled={busy || !allAnswered}
              className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-600 disabled:opacity-50"
            >
              {busy
                ? "Mengirim…"
                : allAnswered
                  ? "Kirim jawaban"
                  : "Jawab semua soal dulu"}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setCurrent((c) => c + 1)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 px-3.5 py-2 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-50"
            >
              Berikutnya <ChevronRight size={15} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
