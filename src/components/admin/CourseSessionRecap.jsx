import { useCallback, useEffect, useRef, useState } from "react";
import {
  ChevronDown,
  UserCheck,
  NotebookPen,
  Plus,
  Trash2,
} from "lucide-react";
import { getCourse } from "../../lib/courses";
import { getUsers } from "../../lib/users";
import { supabase, hasSupabase } from "../../lib/supabase";
import {
  getRounds,
  getRoundAttendance,
  createRound,
  setRoundOpen,
  deleteRound,
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

const QUICK = ["Presensi 1", "Presensi 2", "Presensi 3"];

function PresensiRow({ lesson, usersById }) {
  const [open, setOpen] = useState(false);
  const [rounds, setRounds] = useState(null); // null | [{ ...round, people: [] }]
  const [failed, setFailed] = useState(false);
  const [label, setLabel] = useState("");
  const [busy, setBusy] = useState(false);
  const loadedRef = useRef(false);

  const load = useCallback(() => {
    getRounds(lesson.id)
      .then(async (rs) => {
        const people = await Promise.all(
          rs.map((r) => getRoundAttendance(r.id).catch(() => []))
        );
        setRounds(rs.map((r, i) => ({ ...r, people: people[i] })));
        setFailed(false);
      })
      .catch((err) => {
        console.error("[admin] gagal memuat presensi:", err);
        loadedRef.current = false;
        setFailed(true);
      });
  }, [lesson.id]);

  useEffect(() => {
    if (!open || loadedRef.current) return;
    loadedRef.current = true;
    load();
  }, [open, load]);

  // Realtime: check-in murid masuk -> refresh (debounce biar nggak spam).
  useEffect(() => {
    if (!open || !hasSupabase) return;
    let t;
    const channel = supabase
      .channel(`att:${lesson.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "coaching_attendance" },
        () => {
          clearTimeout(t);
          t = setTimeout(load, 400);
        }
      )
      .subscribe();
    return () => {
      clearTimeout(t);
      supabase.removeChannel(channel);
    };
  }, [open, load, lesson.id]);

  const total = rounds?.reduce((n, r) => n + r.people.length, 0) ?? 0;

  const toggle = async (r) => {
    setRounds((p) =>
      p.map((x) => (x.id === r.id ? { ...x, is_open: !x.is_open } : x))
    );
    try {
      await setRoundOpen(r.id, !r.is_open);
    } catch (err) {
      window.alert(`Gagal: ${err?.message ?? err}`);
      load();
    }
  };

  const add = async (lbl) => {
    const name = (lbl ?? label).trim();
    if (!name || busy) return;
    setBusy(true);
    try {
      const row = await createRound(lesson.id, name);
      setRounds((p) => [...(p ?? []), { ...row, people: [] }]);
      setLabel("");
    } catch (err) {
      window.alert(`Gagal: ${err?.message ?? err}`);
    } finally {
      setBusy(false);
    }
  };

  const remove = async (r) => {
    if (!window.confirm(`Hapus presensi "${r.label}"?`)) return;
    try {
      await deleteRound(r.id);
      setRounds((p) => p.filter((x) => x.id !== r.id));
    } catch (err) {
      window.alert(`Gagal: ${err?.message ?? err}`);
    }
  };

  return (
    <li>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-zinc-50"
      >
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-emerald-50 text-emerald-600">
          <UserCheck size={15} />
        </span>
        <span className="min-w-0 flex-1 truncate text-sm font-medium text-zinc-800">
          {lesson.title}
          <span className="ml-1.5 text-xs font-normal text-zinc-400">
            Presensi
          </span>
        </span>
        {rounds && (
          <span className="shrink-0 rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-semibold text-zinc-500">
            {rounds.length} presensi · {total} hadir
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
          {!rounds && !failed && <Skeleton className="h-10 w-full rounded" />}
          {failed && <p className="text-xs text-rose-500">Gagal memuat.</p>}

          {rounds && (
            <div className="flex flex-col gap-3">
              {rounds.length === 0 && (
                <p className="text-xs text-zinc-400">Belum ada presensi.</p>
              )}

              {rounds.map((r) => (
                <div
                  key={r.id}
                  className="rounded-lg border border-zinc-200 bg-white p-3"
                >
                  <div className="flex items-center gap-2">
                    <span className="flex-1 text-sm font-semibold text-zinc-800">
                      {r.label}
                    </span>
                    <span className="text-xs text-zinc-400">
                      {r.people.length} hadir
                    </span>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={r.is_open}
                      onClick={() => toggle(r)}
                      className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${
                        r.is_open ? "bg-emerald-500" : "bg-zinc-300"
                      }`}
                      title={r.is_open ? "Tutup presensi" : "Buka presensi"}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                          r.is_open ? "translate-x-4" : "translate-x-0.5"
                        }`}
                      />
                    </button>
                    <button
                      type="button"
                      onClick={() => remove(r)}
                      aria-label="Hapus presensi"
                      className="grid h-6 w-6 shrink-0 place-items-center rounded text-zinc-300 transition-colors hover:bg-rose-50 hover:text-rose-500"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                  {r.people.length > 0 && (
                    <ul className="mt-2 flex flex-col gap-0.5 border-t border-zinc-100 pt-2">
                      {r.people.map((p) => {
                        const u = usersById.get(p.user_id);
                        return (
                          <li
                            key={p.user_id}
                            className="flex items-baseline justify-between gap-3 text-xs"
                          >
                            <span className="text-zinc-700">
                              {u ? fullName(u) : p.user_id}
                            </span>
                            <span className="shrink-0 text-zinc-400">
                              {fmt(p.checked_in_at)}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              ))}

              <div className="flex flex-wrap items-center gap-1.5">
                {QUICK.map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => add(q)}
                    disabled={busy}
                    className="rounded-md border border-zinc-200 bg-white px-2 py-1 text-xs font-medium text-zinc-600 transition-colors hover:bg-zinc-50 disabled:opacity-50"
                  >
                    + {q}
                  </button>
                ))}
                <input
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && add()}
                  placeholder="nama presensi…"
                  className="min-w-0 flex-1 rounded-md border border-zinc-300 px-2 py-1 text-xs text-zinc-800 outline-none focus:border-brand-500"
                />
                <button
                  type="button"
                  onClick={() => add()}
                  disabled={busy || !label.trim()}
                  className="inline-flex items-center gap-1 rounded-md bg-brand-500 px-2 py-1 text-xs font-semibold text-white transition-colors hover:bg-brand-600 disabled:opacity-50"
                >
                  <Plus size={12} /> Presensi
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </li>
  );
}

function RefleksiRow({ lesson, usersById }) {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState(null);
  const [failed, setFailed] = useState(false);
  const loadedRef = useRef(false);

  const load = useCallback(() => {
    getLessonReflections(lesson.id)
      .then((d) => {
        setRows(d);
        setFailed(false);
      })
      .catch((err) => {
        console.error("[admin] gagal memuat refleksi:", err);
        loadedRef.current = false;
        setFailed(true);
      });
  }, [lesson.id]);

  useEffect(() => {
    if (!open || loadedRef.current) return;
    loadedRef.current = true;
    load();
  }, [open, load]);

  // Realtime: murid submit / edit refleksi -> refresh.
  useEffect(() => {
    if (!open || !hasSupabase) return;
    let t;
    const channel = supabase
      .channel(`refl:${lesson.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "coaching_reflections",
          filter: `lesson_id=eq.${lesson.id}`,
        },
        () => {
          clearTimeout(t);
          t = setTimeout(load, 400);
        }
      )
      .subscribe();
    return () => {
      clearTimeout(t);
      supabase.removeChannel(channel);
    };
  }, [open, load, lesson.id]);

  return (
    <li>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-zinc-50"
      >
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-rose-50 text-rose-600">
          <NotebookPen size={15} />
        </span>
        <span className="min-w-0 flex-1 truncate text-sm font-medium text-zinc-800">
          {lesson.title}
          <span className="ml-1.5 text-xs font-normal text-zinc-400">
            Refleksi
          </span>
        </span>
        {rows && (
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
          {!rows && !failed && <Skeleton className="h-10 w-full rounded" />}
          {failed && <p className="text-xs text-rose-500">Gagal memuat.</p>}
          {rows && rows.length === 0 && (
            <p className="text-xs text-zinc-400">Belum ada.</p>
          )}
          {rows && rows.length > 0 && (
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
                        {fmt(r.updated_at)}
                      </span>
                    </div>
                    <p className="mt-0.5 whitespace-pre-wrap text-xs text-zinc-600">
                      {r.body}
                    </p>
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
          .flatMap((s) => s.items)
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
            {lessons.map((l) =>
              l.type === "presensi" ? (
                <PresensiRow key={l.id} lesson={l} usersById={usersById} />
              ) : (
                <RefleksiRow key={l.id} lesson={l} usersById={usersById} />
              )
            )}
          </ul>
        )}
      </div>
    </div>
  );
}
