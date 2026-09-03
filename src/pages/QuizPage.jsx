import { Suspense, lazy, useCallback, useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, ChevronLeft, ChevronRight, Clock } from "lucide-react";
import { getCourse } from "../lib/courses";
import {
  getQuestionSet,
  getMyAttempt,
  submitQuiz,
  openQuizProgress,
  getQuizProgress,
  saveQuizDraft,
} from "../lib/quiz";
import Skeleton from "../components/ui/Skeleton";

const Markdown = lazy(() => import("../components/ui/Markdown"));

const GROUP = 10;

const fmtDur = (sec) => {
  if (sec == null) return null;
  const s = Math.max(0, Math.round(sec));
  const m = Math.floor(s / 60);
  return m > 0 ? `${m} mnt ${s % 60} dtk` : `${s} dtk`;
};

// mm:ss atau h:mm:ss
const fmtClock = (ms) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const p = (x) => String(x).padStart(2, "0");
  return h > 0 ? `${h}:${p(m)}:${p(s % 60)}` : `${p(m)}:${p(s % 60)}`;
};

export default function QuizPage() {
  const { courseId, lessonId } = useParams();
  const [data, setData] = useState({ status: "loading" });
  const [answers, setAnswers] = useState({}); // { qid: idx }
  const [current, setCurrent] = useState(0);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null); // { score, total, results, duration_sec }
  const [startedAt, setStartedAt] = useState(null); // ms epoch, dari server
  const [started, setStarted] = useState(false); // udah klik "Mulai" / lanjut sesi
  const [now, setNow] = useState(() => Date.now());
  const [confirmBlanks, setConfirmBlanks] = useState(0); // >0 = modal konfirmasi kirim
  const [timeUp, setTimeUp] = useState(false); // modal "waktu habis"
  const autoFiredRef = useRef(false);

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
        // Udah pernah ngerjain? -> langsung tampilkan hasilnya (1x per set).
        const attempt = await getMyAttempt(lesson.question_set_id).catch(
          () => null
        );
        if (!alive) return;
        if (attempt) {
          setResult({
            score: attempt.score,
            total: attempt.total,
            duration_sec: attempt.duration_sec ?? null,
          });
        } else if (set) {
          // Sesi udah jalan (dari sebelumnya / device lain)? -> lanjut,
          // lewati lobby. Belum -> tampilkan lobby dulu.
          const prog = await getQuizProgress(set.id).catch(() => null);
          if (!alive) return;
          if (prog?.started_at) {
            setStartedAt(new Date(prog.started_at).getTime());
            if (prog.answers && typeof prog.answers === "object") {
              setAnswers(prog.answers);
            }
            setStarted(true);
          }
        }
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

  const submit = useCallback(
    async ({ silent = false } = {}) => {
      if (busy || result || data.status !== "ready" || !data.set) return;
      const qs = data.set.questions ?? [];
      if (!silent) {
        const blanks = qs.filter((qq) => {
          const v = answers[qq.id];
          return Array.isArray(v) ? v.length === 0 : v == null;
        }).length;
        // Ada yang kosong -> minta konfirmasi lewat modal, jangan submit dulu.
        if (blanks > 0) {
          setConfirmBlanks(blanks);
          return;
        }
      }
      setConfirmBlanks(0);
      setBusy(true);
      try {
        const durationMs = startedAt != null ? Date.now() - startedAt : null;
        const res = await submitQuiz(lessonId, data.set.id, answers, durationMs);
        setResult(res);
        setCurrent(0);
      } catch (err) {
        if (!silent) window.alert(err?.message ?? "Gagal submit.");
      } finally {
        setBusy(false);
      }
    },
    [busy, result, data, answers, lessonId, startedAt]
  );

  const limitMs =
    data.status === "ready" && data.set?.time_limit_min
      ? data.set.time_limit_min * 60000
      : null;

  const handleStart = async () => {
    if (busy || data.status !== "ready" || !data.set) return;
    setBusy(true);
    try {
      const prog = await openQuizProgress(data.set.id);
      if (prog?.started_at) setStartedAt(new Date(prog.started_at).getTime());
      if (prog?.answers && typeof prog.answers === "object") {
        setAnswers(prog.answers);
      }
      setStarted(true);
    } catch (err) {
      window.alert(err?.message ?? "Gagal memulai.");
    } finally {
      setBusy(false);
    }
  };

  // Simpan draft jawaban ke server (ter-debounce) -> lanjut di device lain.
  useEffect(() => {
    if (data.status !== "ready" || !data.set || result || !started) return;
    const t = setTimeout(() => {
      saveQuizDraft(data.set.id, answers).catch((e) =>
        console.warn("[QuizPage] draft gagal disimpan:", e)
      );
    }, 800);
    return () => clearTimeout(t);
  }, [answers, data, result, started]);

  // Detak per detik buat tampilan timer.
  useEffect(() => {
    if (data.status !== "ready" || !data.set || result || startedAt == null)
      return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [data, result, startedAt]);

  // Auto-submit kalau batas waktu set kelewat.
  useEffect(() => {
    if (
      data.status !== "ready" ||
      !data.set ||
      result ||
      startedAt == null ||
      limitMs == null
    )
      return;
    const fire = () => {
      if (autoFiredRef.current) return;
      autoFiredRef.current = true;
      setConfirmBlanks(0);
      setTimeUp(true);
      submit({ silent: true });
    };
    const left = startedAt + limitMs - Date.now();
    if (left <= 0) {
      fire();
      return;
    }
    const t = setTimeout(fire, left);
    return () => clearTimeout(t);
  }, [data, result, submit, startedAt, limitMs]);

  // Esc nutup modal konfirmasi kirim.
  useEffect(() => {
    if (!confirmBlanks) return;
    const onKey = (e) => e.key === "Escape" && setConfirmBlanks(0);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [confirmBlanks]);

  const backLink = (
    <Link
      to={`/course/${courseId}/materi`}
      className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-500 transition-colors hover:text-zinc-800"
    >
      <ArrowLeft size={14} /> Kembali ke materi
    </Link>
  );

  const timeUpModal = timeUp && (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/40 p-4">
      <div className="w-full max-w-sm rounded-2xl border border-zinc-200 bg-white p-5 shadow-xl">
        <p className="text-sm font-bold text-zinc-900">Waktu habis</p>
        <p className="mt-1.5 text-sm text-zinc-600">
          Jawaban kamu sudah otomatis dikirim.
        </p>
        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={() => setTimeUp(false)}
            className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-600"
          >
            Lihat hasil
          </button>
        </div>
      </div>
    </div>
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

  const isAnswered = (qq) => {
    const v = answers[qq.id];
    return Array.isArray(v) ? v.length > 0 : v != null;
  };

  // Pilih opsi. multi = toggle di array; single = ganti.
  const pick = (qq, oi) =>
    setAnswers((a) => {
      if (qq.type !== "multi") return { ...a, [qq.id]: oi };
      const cur = Array.isArray(a[qq.id]) ? a[qq.id] : [];
      const next = cur.includes(oi)
        ? cur.filter((x) => x !== oi)
        : [...cur, oi].sort((m, n) => m - n);
      return { ...a, [qq.id]: next };
    });

  const answeredCount = questions.filter(isAnswered).length;

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
    // Sampai 2 desimal, tapi buang nol di belakang (50 bukan 50.00; 3.33; 66.67).
    const p = result.total
      ? +((result.score / result.total) * 100).toFixed(2)
      : 0;
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
          <p className="mt-1 text-sm font-semibold text-zinc-400">({p}%)</p>
          {result.duration_sec != null && (
            <p className="mt-2 text-xs text-zinc-400">
              Waktu pengerjaan: {fmtDur(result.duration_sec)}
            </p>
          )}
        </div>
        {timeUpModal}
      </div>
    );
  }

  // ── Lobby (instruksi + tombol Mulai) ────────────────────────────
  if (!started) {
    const limitMin = set.time_limit_min ?? null;
    return (
      <div className="mx-auto flex max-w-2xl flex-col gap-5">
        {backLink}
        {header}

        <div className="rounded-2xl border border-zinc-200/80 bg-white p-6">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-medium text-zinc-500">
            <span>{total} soal</span>
            {limitMin != null && (
              <span className="inline-flex items-center gap-1">
                <Clock size={13} /> {limitMin} menit
              </span>
            )}
            <span>1x kesempatan</span>
          </div>

          {set.intro && (
            <div className="mt-4 border-t border-zinc-100 pt-4">
              <Suspense
                fallback={<Skeleton className="h-16 w-full rounded" />}
              >
                <Markdown className="text-sm text-zinc-700">
                  {set.intro}
                </Markdown>
              </Suspense>
            </div>
          )}

          <button
            type="button"
            onClick={handleStart}
            disabled={busy}
            className="mt-5 w-full rounded-lg bg-brand-500 px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-brand-600 disabled:opacity-50"
          >
            {busy ? "Memulai…" : "MULAI SEKARANG"}
          </button>
        </div>
      </div>
    );
  }

  // ── Ngerjakan (satu soal per layar) ──────────────────────────────
  const q = questions[current];
  const groupStart = Math.floor(current / GROUP) * GROUP;
  const groupEnd = Math.min(groupStart + GROUP, total);
  const isLast = current === total - 1;

  const elapsedMs = startedAt != null ? Math.max(0, now - startedAt) : 0;
  const remainingMs = limitMs != null ? limitMs - elapsedMs : null;
  const timerTone =
    remainingMs == null
      ? "text-zinc-400"
      : remainingMs < 60000
        ? "text-rose-600"
        : remainingMs < 5 * 60000
          ? "text-amber-600"
          : "text-zinc-400";

  return (
    <div className="flex min-h-full flex-col">
      <div className="mx-auto my-auto flex w-full max-w-2xl flex-col gap-5 py-2">
        {backLink}
        {header}

        {startedAt != null && (
          <p
            className={`flex items-center justify-center gap-1.5 text-xs font-semibold tabular-nums ${timerTone}`}
          >
            <Clock size={13} />
            {remainingMs != null
              ? `Sisa waktu ${fmtClock(remainingMs)}`
              : `Waktu ${fmtClock(elapsedMs)}`}
          </p>
        )}

        {/* Strip nomor soal, per 10 */}
        <div className="flex items-center justify-center gap-1.5">
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
          <div className="flex flex-wrap justify-center gap-1.5">
            {Array.from({ length: groupEnd - groupStart }, (_, k) => {
              const idx = groupStart + k;
              const answered = isAnswered(questions[idx]);
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
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs text-zinc-400">
              Soal {current + 1} dari {total}
            </p>
            {isAnswered(q) && (
              <button
                type="button"
                onClick={() =>
                  setAnswers((a) => {
                    const next = { ...a };
                    delete next[q.id];
                    return next;
                  })
                }
                className="text-xs font-medium text-zinc-400 transition-colors hover:text-rose-500"
              >
                Clear
              </button>
            )}
          </div>
          <Suspense
            fallback={<Skeleton className="mt-3 h-40 w-full rounded" />}
          >
            <div className="mt-1.5 text-sm font-medium text-zinc-900">
              <Markdown>{q.prompt}</Markdown>
            </div>
            {q.type === "multi" && (
              <p className="mt-1 text-xs font-medium text-brand-600">
                Bisa pilih lebih dari satu.
              </p>
            )}
            <div className="mt-3 flex flex-col gap-2">
              {q.options.map((opt, oi) => {
                const multi = q.type === "multi";
                const chosen = answers[q.id];
                const picked = multi
                  ? Array.isArray(chosen) && chosen.includes(oi)
                  : chosen === oi;
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
                      type={multi ? "checkbox" : "radio"}
                      name={q.id}
                      checked={picked}
                      onChange={() => pick(q, oi)}
                      className="sr-only"
                    />
                    <span
                      className={`grid h-6 w-6 shrink-0 place-items-center border text-xs font-bold ${
                        multi ? "rounded-md" : "rounded-full"
                      } ${
                        picked
                          ? "border-brand-500 bg-brand-500 text-white"
                          : "border-zinc-300 text-zinc-500"
                      }`}
                    >
                      {String.fromCharCode(65 + oi)}
                    </span>
                    <Markdown inline>{opt}</Markdown>
                  </label>
                );
              })}
            </div>
          </Suspense>
        </div>

        {/* Navigasi */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => setCurrent((c) => c - 1)}
              disabled={current === 0}
              className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 px-3.5 py-2 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-50 disabled:opacity-40"
            >
              <ChevronLeft size={15} /> Sebelumnya
            </button>

            {!isLast && (
              <button
                type="button"
                onClick={() => setCurrent((c) => c + 1)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 px-3.5 py-2 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-50"
              >
                Berikutnya <ChevronRight size={15} />
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={() => submit()}
            disabled={busy}
            className="rounded-lg bg-brand-500 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-600 disabled:opacity-50"
          >
            {busy
              ? "Mengirim…"
              : `Kirim jawaban · ${answeredCount}/${total} terjawab`}
          </button>
        </div>
      </div>

      {confirmBlanks > 0 && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/40 p-4"
          onClick={() => setConfirmBlanks(0)}
        >
          <div
            className="w-full max-w-sm rounded-2xl border border-zinc-200 bg-white p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-sm font-bold text-zinc-900">
              Kirim jawaban sekarang?
            </p>
            <p className="mt-1.5 text-sm text-zinc-600">
              Masih ada{" "}
              <span className="font-semibold text-zinc-900">
                {confirmBlanks} soal
              </span>{" "}
              yang belum dijawab.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmBlanks(0)}
                className="rounded-lg border border-zinc-200 px-3.5 py-2 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-50"
              >
                Lanjut kerjakan
              </button>
              <button
                type="button"
                onClick={() => {
                  setConfirmBlanks(0);
                  submit({ silent: true });
                }}
                className="rounded-lg bg-brand-500 px-3.5 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-600"
              >
                Kirim sekarang
              </button>
            </div>
          </div>
        </div>
      )}

      {timeUpModal}
    </div>
  );
}
