import { useEffect, useRef, useState } from "react";
import { ChevronDown, UserCheck, NotebookPen } from "lucide-react";
import { getCourse } from "../../lib/courses";
import { getUsers } from "../../lib/users";
import {
  getLessonAttendance,
  getLessonReflections,
} from "../../lib/sessions";
import Skeleton from "../ui/Skeleton";

const fullName = (u) =>
  [u?.first_name, u?.last_name].filter(Boolean).join(" ") || u?.email || "";

const fmt = (iso) => {
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

function SessionRow({ lesson, usersById }) {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState(null); // null (belum) | []
  const [failed, setFailed] = useState(false);
  const loadedRef = useRef(false);

  useEffect(() => {
    if (!open || loadedRef.current) return;
    loadedRef.current = true;
    const load =
      lesson.type === "presensi"
        ? getLessonAttendance(lesson.id)
        : getLessonReflections(lesson.id);
    load
      .then((d) => {
        setRows(d);
        setFailed(false);
      })
      .catch((err) => {
        console.error("[admin] gagal memuat rekap sesi:", err);
        loadedRef.current = false; // biar bisa dicoba lagi
        setFailed(true);
      });
  }, [open, lesson.id, lesson.type]);

  const Icon = lesson.type === "presensi" ? UserCheck : NotebookPen;
  const status = failed ? "error" : rows === null ? "loading" : "ready";

  return (
    <li className="overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-zinc-50"
      >
        <span
          className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${
            lesson.type === "presensi"
              ? "bg-emerald-50 text-emerald-600"
              : "bg-rose-50 text-rose-600"
          }`}
        >
          <Icon size={15} />
        </span>
        <span className="min-w-0 flex-1 truncate text-sm font-medium text-zinc-800">
          {lesson.title}
          <span className="ml-1.5 text-xs font-normal text-zinc-400">
            {lesson.type === "presensi" ? "Presensi" : "Refleksi"}
          </span>
        </span>
        {status === "ready" && (
          <span className="shrink-0 rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-semibold text-zinc-500">
            {rows.length}
          </span>
        )}
        <ChevronDown
          size={15}
          className={`shrink-0 text-zinc-400 transition-transform ${
            open ? "" : "-rotate-90"
          }`}
        />
      </button>

      {open && (
        <div className="border-t border-zinc-100 bg-zinc-50/50 px-4 py-3">
          {status === "loading" && <Skeleton className="h-10 w-full rounded" />}
          {status === "error" && (
            <p className="text-xs text-rose-500">Gagal memuat.</p>
          )}
          {status === "ready" && rows.length === 0 && (
            <p className="text-xs text-zinc-400">Belum ada.</p>
          )}
          {status === "ready" && rows.length > 0 && (
            <ul className="flex flex-col gap-2">
              {rows.map((r) => {
                const u = usersById.get(r.user_id);
                return (
                  <li key={r.user_id} className="text-sm">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="font-medium text-zinc-800">
                        {u ? fullName(u) : r.user_id}
                      </span>
                      <span className="shrink-0 text-xs text-zinc-400">
                        {fmt(r.checked_in_at ?? r.updated_at)}
                      </span>
                    </div>
                    {lesson.type === "refleksi" && (
                      <p className="mt-0.5 whitespace-pre-wrap text-xs text-zinc-600">
                        {r.body}
                      </p>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </li>
  );
}

export default function CourseSessionRecap({ courseId }) {
  const [status, setStatus] = useState("loading");
  const [lessons, setLessons] = useState([]);
  const [usersById, setUsersById] = useState(new Map());

  useEffect(() => {
    let alive = true;
    Promise.all([getCourse(courseId), getUsers()])
      .then(([course, users]) => {
        if (!alive) return;
        const items = (course?.sections ?? [])
          .flatMap((s) => s.items.map((it) => ({ ...it, section: s.title })))
          .filter((it) => it.type === "presensi" || it.type === "refleksi");
        setLessons(items);
        setUsersById(new Map(users.map((u) => [u.id, u])));
        setStatus("ready");
      })
      .catch((err) => {
        console.error("[admin] gagal memuat sesi:", err);
        if (alive) setStatus("error");
      });
    return () => {
      alive = false;
    };
  }, [courseId]);

  return (
    <div className="overflow-hidden rounded-2xl border border-zinc-200/80 bg-white">
      <div className="border-b border-zinc-100 px-5 py-3">
        <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-zinc-400">
          Presensi &amp; Refleksi
        </span>
      </div>
      <div className="p-2">
        {status === "loading" && (
          <div className="flex flex-col gap-2 p-3">
            {Array.from({ length: 2 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full rounded-lg" />
            ))}
          </div>
        )}
        {status === "error" && (
          <p className="p-3 text-sm text-rose-500">Gagal memuat.</p>
        )}
        {status === "ready" && lessons.length === 0 && (
          <p className="p-3 text-sm text-zinc-400">
            Belum ada item Presensi / Refleksi di course ini. Tambahin lewat
            editor kurikulum di atas.
          </p>
        )}
        {status === "ready" && lessons.length > 0 && (
          <ul className="divide-y divide-zinc-100">
            {lessons.map((l) => (
              <SessionRow key={l.id} lesson={l} usersById={usersById} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
