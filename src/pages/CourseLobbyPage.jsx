import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ArrowLeft,
  BookOpen,
  ArrowRight,
  Lock,
  UserCheck,
  HelpCircle,
  CalendarClock,
} from "lucide-react";
import { useCourse } from "../hooks/useCourse";
import { getMyAttendanceByLesson } from "../lib/sessions";
import { getMyAttemptsByLesson } from "../lib/quiz";
import Skeleton from "../components/ui/Skeleton";

const fmtMeet = (iso) =>
  new Date(iso).toLocaleString("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  });

export default function CourseLobbyPage() {
  const { courseId } = useParams();
  const {
    status,
    course,
    visibleSections,
    canView,
    enrolling,
    enrollLocked,
    handleEnroll,
  } = useCourse(courseId);
  const [passcode, setPasscode] = useState("");
  const [enrollErr, setEnrollErr] = useState("");
  const [recap, setRecap] = useState(null); // { hasPresensi, ronde, hadir, hasQuiz, quizDone, quizTotal, avgPct }
  const [now] = useState(() => Date.now());

  const submitEnroll = async (e) => {
    e.preventDefault();
    setEnrollErr("");
    const res = await handleEnroll(enrollLocked ? passcode : undefined);
    if (!res.ok) setEnrollErr(res.error);
  };

  useEffect(() => {
    if (status !== "ready" || !canView || !course) return;
    const items = (course.sections ?? []).flatMap((s) => s.items ?? []);
    const pIds = items
      .filter((it) => it.type === "presensi")
      .map((it) => it.id);
    const sIds = items
      .filter((it) => it.type === "soal" && it.question_set_id)
      .map((it) => it.id);
    let alive = true;
    Promise.allSettled([
      pIds.length ? getMyAttendanceByLesson(pIds) : Promise.resolve({}),
      sIds.length ? getMyAttemptsByLesson(sIds) : Promise.resolve({}),
    ]).then(([a, s]) => {
      if (!alive) return;
      const att = a.status === "fulfilled" ? a.value : {};
      const score = s.status === "fulfilled" ? s.value : {};
      const av = Object.values(att);
      const sv = Object.values(score);
      const sumScore = sv.reduce((n, x) => n + (x.score ?? 0), 0);
      const sumTotal = sv.reduce((n, x) => n + (x.total ?? 0), 0);
      setRecap({
        hasPresensi: pIds.length > 0,
        ronde: av.reduce((n, x) => n + x.rounds, 0),
        hadir: av.reduce((n, x) => n + x.mine, 0),
        hasQuiz: sIds.length > 0,
        quizDone: sv.length,
        quizTotal: sIds.length,
        avgPct: sumTotal ? Math.round((sumScore / sumTotal) * 100) : null,
      });
    });
    return () => {
      alive = false;
    };
  }, [status, canView, course]);

  if (status === "loading") {
    return (
      <div className="mx-auto flex max-w-[1180px] flex-col gap-6">
        <div>
          <Skeleton className="h-3 w-28" />
          <Skeleton className="mt-3 h-7 w-2/3" />
          <Skeleton className="mt-2 h-3 w-full max-w-md" />
        </div>
        <Skeleton className="h-28 w-full max-w-sm rounded-2xl" />
      </div>
    );
  }

  if (status === "error" || status === "not-found") {
    return (
      <div className="mx-auto max-w-[1180px]">
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

  const totalMateri = visibleSections.reduce(
    (n, s) => n + (s.items?.length ?? 0),
    0,
  );

  const cardCls =
    "flex flex-col rounded-2xl border border-zinc-200/80 bg-white p-5";

  const nextMeet = (course?.sections ?? [])
    .filter((s) => s.meet_at && new Date(s.meet_at).getTime() > now)
    .sort((a, b) => new Date(a.meet_at) - new Date(b.meet_at))[0];

  return (
    <div className="mx-auto flex max-w-[1180px] flex-col gap-6">
      <div>
        <Link
          to="/course"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-500 transition-colors hover:text-zinc-800"
        >
          <ArrowLeft size={14} /> Semua Course
        </Link>

        <h1 className="mt-3 text-xl font-bold tracking-tight text-zinc-900">
          {course.title}
        </h1>
        <p className="mt-1 text-xs leading-relaxed text-zinc-500">
          {course.description}
        </p>
      </div>

      {course.announcement && (
        <div className="rounded-2xl border border-brand-200 bg-brand-50/60 px-4 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-brand-600">
            Pengumuman
          </p>
          <p className="mt-0.5 whitespace-pre-wrap text-sm text-zinc-700">
            {course.announcement}
          </p>
        </div>
      )}

      {!canView ? (
        <form
          onSubmit={submitEnroll}
          className="mx-auto w-full max-w-sm rounded-2xl border border-zinc-200/80 bg-white px-6 py-10 text-center"
        >
          <p className="text-sm font-semibold text-zinc-900">
            Kamu belum enroll di course ini
          </p>
          <p className="mt-1 text-xs text-zinc-500">
            {enrollLocked
              ? "Course ini butuh passcode. Minta ke pengajar kamu."
              : "Enroll dulu untuk membuka isinya."}
          </p>

          {enrollLocked && (
            <div className="mt-4 flex items-center gap-2 rounded-lg border border-zinc-300 px-3 py-2 focus-within:border-brand-500">
              <Lock size={14} className="shrink-0 text-zinc-400" />
              <input
                value={passcode}
                onChange={(e) => setPasscode(e.target.value)}
                placeholder="Passcode"
                autoComplete="off"
                className="w-full text-sm text-zinc-900 outline-none placeholder:text-zinc-400"
              />
            </div>
          )}

          <button
            type="submit"
            disabled={enrolling || (enrollLocked && !passcode.trim())}
            className="mt-4 w-full rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-600 disabled:opacity-50"
          >
            {enrolling ? "Mendaftar…" : "Enroll sekarang"}
          </button>

          {enrollErr && (
            <p className="mt-2 text-xs text-rose-600">{enrollErr}</p>
          )}
        </form>
      ) : (
        <div className="flex flex-col gap-3">
          {nextMeet && (
            <div className="flex items-center gap-3 rounded-2xl border border-zinc-200/80 bg-white px-4 py-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-600">
                <CalendarClock size={20} />
              </span>
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
                  Pertemuan berikutnya
                </p>
                <p className="truncate text-sm font-semibold text-zinc-900">
                  {nextMeet.title}
                </p>
                <p className="text-xs capitalize text-zinc-500">
                  {fmtMeet(nextMeet.meet_at)}
                </p>
              </div>
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Link
              to="materi"
              className={`group transition hover:border-zinc-300 hover:shadow-sm ${cardCls}`}
            >
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-sky-50 text-sky-600">
                <BookOpen size={20} />
              </span>
              <p className="mt-4 text-sm font-bold tracking-tight text-zinc-900">
                Materi
              </p>
              <p className="mt-1 text-xs text-zinc-500">
                {visibleSections.length} pertemuan · {totalMateri} materi
              </p>
              <span className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-brand-600">
                Lihat materi
                <ArrowRight
                  size={13}
                  strokeWidth={2.5}
                  className="transition-transform group-hover:translate-x-0.5"
                />
              </span>
            </Link>

            {recap?.hasPresensi && (
              <div className={cardCls}>
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-50 text-emerald-600">
                  <UserCheck size={20} />
                </span>
                <p className="mt-4 text-sm font-bold tracking-tight text-zinc-900">
                  Kehadiran
                </p>
                {recap.ronde > 0 ? (
                  <>
                    <p className="mt-1 text-2xl font-bold text-zinc-900">
                      {recap.hadir}
                      <span className="text-base font-semibold text-zinc-400">
                        /{recap.ronde}
                      </span>
                    </p>
                    <p className="mt-0.5 text-xs text-zinc-500">
                      sesi presensi kamu hadiri
                    </p>
                  </>
                ) : (
                  <p className="mt-1 text-xs text-zinc-400">
                    Belum ada sesi presensi.
                  </p>
                )}
              </div>
            )}

            {recap?.hasQuiz && (
              <div className={cardCls}>
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-amber-50 text-amber-600">
                  <HelpCircle size={20} />
                </span>
                <p className="mt-4 text-sm font-bold tracking-tight text-zinc-900">
                  Rata-rata skor
                </p>
                {recap.avgPct != null ? (
                  <>
                    <p className="mt-1 text-2xl font-bold text-zinc-900">
                      {recap.avgPct}%
                    </p>
                    <p className="mt-0.5 text-xs text-zinc-500">
                      {recap.quizDone} dari {recap.quizTotal} kuis dikerjakan
                    </p>
                  </>
                ) : (
                  <p className="mt-1 text-xs text-zinc-400">
                    Belum ada kuis yang dikerjakan.
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
