import { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { getCourse } from "../../lib/courses";
import { getCourseEnrollments } from "../../lib/enroll";
import { getUsers } from "../../lib/users";
import {
  ACTIVITY_KINDS,
  getActivityMarks,
  setActivityMark,
} from "../../lib/activity";
import Skeleton from "../ui/Skeleton";

const fullName = (u) =>
  [u?.first_name, u?.last_name].filter(Boolean).join(" ") || u?.email || "";

/**
 * Tab "Keaktifan" admin course: per materi tipe 'keaktifan', admin memilih
 * jenis keaktifan tiap murid yang enroll. Murid melihat catatannya sendiri
 * di halaman materi (supabase/keaktifan.sql).
 */
export default function CourseActivity({ courseId }) {
  const [state, setState] = useState({ status: "loading" });
  const [students, setStudents] = useState([]); // [{ id, name, email }]
  const [lessons, setLessons] = useState([]); // [{ id, title, section }]
  const [marks, setMarks] = useState(() => new Map()); // `${lessonId}|${userId}` -> kinds[]
  const [q, setQ] = useState("");
  const [savingKey, setSavingKey] = useState(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [course, enrollments, users] = await Promise.all([
          getCourse(courseId),
          getCourseEnrollments(courseId),
          getUsers(),
        ]);
        const ls = (course?.sections ?? []).flatMap((s) =>
          (s.items ?? [])
            .filter((it) => it.type === "keaktifan")
            .map((it) => ({ id: it.id, title: it.title, section: s.title }))
        );
        const rows = ls.length ? await getActivityMarks(ls.map((l) => l.id)) : [];
        if (!alive) return;
        const byId = new Map(users.map((u) => [u.id, u]));
        setStudents(
          enrollments
            .map((e) => byId.get(e.user_id))
            .filter(Boolean)
            .map((u) => ({ id: u.id, name: fullName(u), email: u.email ?? "" }))
            .sort((a, b) => a.name.localeCompare(b.name, "id"))
        );
        setLessons(ls);
        setMarks(
          new Map(rows.map((r) => [`${r.lesson_id}|${r.user_id}`, r.kinds ?? []]))
        );
        setState({ status: "ready" });
      } catch (err) {
        console.error("[admin] gagal memuat keaktifan:", err);
        if (alive) setState({ status: "error" });
      }
    })();
    return () => {
      alive = false;
    };
  }, [courseId]);

  const needle = q.trim().toLowerCase();
  const shown = useMemo(
    () =>
      students.filter(
        (s) =>
          s.name.toLowerCase().includes(needle) ||
          s.email.toLowerCase().includes(needle)
      ),
    [students, needle]
  );

  const toggle = async (lessonId, userId, kindKey) => {
    const key = `${lessonId}|${userId}`;
    const prev = marks.get(key) ?? [];
    const next = prev.includes(kindKey)
      ? prev.filter((k) => k !== kindKey)
      : [...prev, kindKey];
    const apply = (ks) =>
      setMarks((m) => {
        const n = new Map(m);
        if (ks.length) n.set(key, ks);
        else n.delete(key);
        return n;
      });
    apply(next);
    setSavingKey(key);
    try {
      await setActivityMark(lessonId, userId, next);
    } catch (err) {
      console.error("[admin] gagal menyimpan keaktifan:", err);
      apply(prev);
      window.alert(
        "Gagal menyimpan. Pastikan supabase/keaktifan.sql sudah dijalankan."
      );
    } finally {
      setSavingKey((k) => (k === key ? null : k));
    }
  };

  if (state.status === "loading")
    return (
      <div className="flex flex-col gap-3">
        <Skeleton className="h-10 w-full rounded-xl" />
        <Skeleton className="h-40 w-full rounded-xl" />
      </div>
    );
  if (state.status === "error")
    return (
      <p className="rounded-xl border border-dashed border-rose-300 bg-white px-6 py-8 text-center text-sm text-rose-500">
        Gagal memuat keaktifan. Pastikan{" "}
        <code className="rounded bg-zinc-100 px-1 py-0.5">
          supabase/keaktifan.sql
        </code>{" "}
        sudah dijalankan.
      </p>
    );
  if (lessons.length === 0)
    return (
      <p className="rounded-xl border border-dashed border-zinc-300 bg-white px-6 py-10 text-center text-sm text-zinc-400">
        Belum ada materi bertipe <b>Keaktifan</b>. Tambahkan lewat tab
        Kurikulum (pilih tipe &ldquo;Keaktifan&rdquo; di sebuah pertemuan).
      </p>
    );

  return (
    <div className="flex flex-col gap-5">
      <label className="relative max-w-xs">
        <Search
          size={14}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400"
        />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Cari murid…"
          className="w-full rounded-lg border border-zinc-300 py-2 pl-8 pr-3 text-sm text-zinc-900 outline-none transition-colors focus:border-brand-500"
        />
      </label>

      {lessons.map((lesson) => {
        const counts = ACTIVITY_KINDS.map((k) => ({
          ...k,
          n: students.filter((s) =>
            marks.get(`${lesson.id}|${s.id}`)?.includes(k.key)
          ).length,
        }));
        const total = students.filter(
          (s) => (marks.get(`${lesson.id}|${s.id}`)?.length ?? 0) > 0
        ).length;
        return (
          <section
            key={lesson.id}
            className="overflow-hidden rounded-xl border border-zinc-200 bg-white"
          >
            <div className="border-b border-zinc-100 px-4 py-3">
              <p className="text-xs text-zinc-400">{lesson.section}</p>
              <h3 className="text-sm font-bold text-zinc-900">{lesson.title}</h3>
              <p className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-zinc-500">
                <span className="font-semibold text-zinc-700">
                  {total}/{students.length} tercatat aktif
                </span>
                {counts
                  .filter((c) => c.n > 0)
                  .map((c) => (
                    <span key={c.key}>
                      {c.label}: {c.n}
                    </span>
                  ))}
              </p>
            </div>

            {shown.length === 0 ? (
              <p className="px-4 py-6 text-center text-xs text-zinc-400">
                {students.length === 0
                  ? "Belum ada murid yang enroll."
                  : "Nggak ada murid yang cocok."}
              </p>
            ) : (
              <ul className="divide-y divide-zinc-100">
                {shown.map((s) => {
                  const key = `${lesson.id}|${s.id}`;
                  const picked = marks.get(key) ?? [];
                  return (
                    <li
                      key={s.id}
                      className="flex flex-wrap items-center justify-between gap-2 px-4 py-2"
                    >
                      <span className="min-w-0 truncate text-sm text-zinc-700">
                        {s.name}
                      </span>
                      <span className="flex items-center gap-2">
                        {savingKey === key && (
                          <span className="text-[11px] text-zinc-400">
                            menyimpan…
                          </span>
                        )}
                        {ACTIVITY_KINDS.map((k) => {
                          const on = picked.includes(k.key);
                          return (
                            <button
                              key={k.key}
                              type="button"
                              role="switch"
                              aria-checked={on}
                              onClick={() => toggle(lesson.id, s.id, k.key)}
                              className={`rounded-full border px-2.5 py-1 text-xs font-semibold transition-colors ${
                                on
                                  ? "border-teal-500 bg-teal-500 text-white"
                                  : "border-zinc-200 bg-white text-zinc-400 hover:border-zinc-300 hover:text-zinc-600"
                              }`}
                            >
                              {k.label}
                            </button>
                          );
                        })}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}
