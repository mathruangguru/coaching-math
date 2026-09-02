import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, UserCheck, Check } from "lucide-react";
import { getCourse } from "../lib/courses";
import { supabase, hasSupabase } from "../lib/supabase";
import { getRounds, getMyCheckins, checkInRound } from "../lib/sessions";
import Skeleton from "../components/ui/Skeleton";

export default function PresensiPage() {
  const { courseId, lessonId } = useParams();
  const [data, setData] = useState({ status: "loading" });
  const [rounds, setRounds] = useState([]);
  const [mine, setMine] = useState(() => new Set()); // round_id yang udah hadir
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const refreshRounds = useCallback(async () => {
    const rs = await getRounds(lessonId).catch(() => []);
    setRounds(rs);
    const done = await getMyCheckins(rs.map((r) => r.id)).catch(() => []);
    setMine(new Set(done));
  }, [lessonId]);

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
        await refreshRounds();
        if (!alive) return;
        setData({ status: "ready", course, lesson });
      } catch (e) {
        console.error("[PresensiPage] gagal memuat:", e);
        if (alive) setData({ status: "error" });
      }
    })();
    return () => {
      alive = false;
    };
  }, [courseId, lessonId, refreshRounds]);

  // Ikutin admin buka/tutup ronde secara live.
  useEffect(() => {
    if (!hasSupabase) return;
    const channel = supabase
      .channel(`attendance_rounds:${lessonId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "coaching_attendance_rounds",
          filter: `lesson_id=eq.${lessonId}`,
        },
        () => {
          refreshRounds();
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [lessonId, refreshRounds]);

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
  const openRound = rounds.find((r) => r.is_open);

  const doCheckIn = async () => {
    if (!openRound) return;
    setBusy(true);
    setErr("");
    try {
      await checkInRound(openRound.id);
      setMine((s) => new Set(s).add(openRound.id));
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
        {!openRound ? (
          <p className="text-sm text-zinc-500">
            Belum ada presensi yang dibuka.
          </p>
        ) : mine.has(openRound.id) ? (
          <>
            <span className="mx-auto grid h-11 w-11 place-items-center rounded-full bg-emerald-500 text-white">
              <Check size={20} strokeWidth={3} />
            </span>
            <p className="mt-3 text-sm font-semibold text-zinc-900">
              Kamu hadir · {openRound.label}
            </p>
          </>
        ) : (
          <>
            <p className="text-sm text-zinc-500">
              <span className="font-semibold">{openRound.label}</span> sedang
              dibuka.
            </p>
            <button
              type="button"
              onClick={doCheckIn}
              disabled={busy}
              className="mt-4 inline-flex items-center gap-2 rounded-xl bg-brand-500 px-6 py-2.5 text-sm font-bold text-white transition-colors hover:bg-brand-600 disabled:opacity-50"
            >
              <UserCheck size={16} /> {busy ? "Mencatat…" : "Hadir"}
            </button>
            {err && <p className="mt-2 text-xs text-rose-600">{err}</p>}
          </>
        )}
      </div>

      {rounds.length > 0 && (
        <ul className="flex flex-col gap-1.5">
          {rounds.map((r) => (
            <li
              key={r.id}
              className="flex items-center justify-between gap-3 rounded-lg border border-zinc-200 bg-white px-3.5 py-2 text-sm"
            >
              <span className="font-medium text-zinc-700">{r.label}</span>
              {mine.has(r.id) ? (
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600">
                  <Check size={13} strokeWidth={3} /> Hadir
                </span>
              ) : (
                <span className="text-xs text-zinc-400">
                  {r.is_open ? "dibuka" : "belum hadir"}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
