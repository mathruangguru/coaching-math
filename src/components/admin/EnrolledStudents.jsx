import { useEffect, useMemo, useState } from "react";
import { Search, UserMinus } from "lucide-react";
import { getCourseEnrollments, kickEnrollment } from "../../lib/enroll";
import { getUsers } from "../../lib/users";
import Skeleton from "../ui/Skeleton";

const fullName = (u) =>
  [u?.first_name, u?.last_name].filter(Boolean).join(" ") || u?.email || "";

const fmtDate = (iso) => {
  try {
    return new Date(iso).toLocaleDateString("id-ID", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return "";
  }
};

export default function EnrolledStudents({ courseId }) {
  const [status, setStatus] = useState("loading"); // loading | error | ready
  const [rows, setRows] = useState([]); // [{ user_id, created_at, user }]
  const [q, setQ] = useState("");
  const [busyId, setBusyId] = useState(null);

  useEffect(() => {
    let alive = true;
    Promise.all([getCourseEnrollments(courseId), getUsers()])
      .then(([enrollments, users]) => {
        if (!alive) return;
        const byId = new Map(users.map((u) => [u.id, u]));
        const merged = enrollments
          .map((e) => ({ ...e, user: byId.get(e.user_id) ?? null }))
          .sort((a, b) =>
            fullName(a.user).localeCompare(fullName(b.user), "id")
          );
        setRows(merged);
        setStatus("ready");
      })
      .catch((err) => {
        console.error("[admin] gagal memuat murid enrolled:", err);
        if (alive) setStatus("error");
      });
    return () => {
      alive = false;
    };
  }, [courseId]);

  const needle = q.trim().toLowerCase();
  const shown = useMemo(
    () =>
      rows.filter(
        (r) =>
          fullName(r.user).toLowerCase().includes(needle) ||
          (r.user?.email ?? "").toLowerCase().includes(needle) ||
          (r.user?.branch?.name ?? "").toLowerCase().includes(needle)
      ),
    [rows, needle]
  );

  const kick = async (r) => {
    const label = fullName(r.user) || r.user_id;
    if (!window.confirm(`Keluarkan ${label} dari course ini?`)) return;
    setBusyId(r.user_id);
    try {
      await kickEnrollment(courseId, r.user_id);
      setRows((p) => p.filter((x) => x.user_id !== r.user_id));
    } catch (err) {
      window.alert(`Gagal: ${err?.message ?? err}`);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="overflow-hidden rounded-2xl border border-zinc-200/80 bg-white">
      <div className="flex items-center justify-between gap-3 border-b border-zinc-100 px-5 py-3">
        <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-zinc-400">
          Murid enrolled
        </span>
        {status === "ready" && (
          <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-semibold text-zinc-500">
            {rows.length}
          </span>
        )}
      </div>

      <div className="p-5">
        {status === "loading" && (
          <div className="flex flex-col gap-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-11 w-full rounded-lg" />
            ))}
          </div>
        )}

        {status === "error" && (
          <p className="text-sm text-rose-500">Gagal memuat daftar murid.</p>
        )}

        {status === "ready" && rows.length === 0 && (
          <p className="text-sm text-zinc-400">Belum ada murid yang enroll.</p>
        )}

        {status === "ready" && rows.length > 0 && (
          <div className="flex flex-col gap-3">
            {rows.length > 6 && (
              <label className="relative">
                <Search
                  size={14}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400"
                />
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Cari nama / email / cabang…"
                  className="w-full rounded-lg border border-zinc-300 py-2 pl-8 pr-3 text-sm text-zinc-900 outline-none transition-colors focus:border-brand-500"
                />
              </label>
            )}

            <ul className="divide-y divide-zinc-100 rounded-xl border border-zinc-200">
              {shown.map((r) => (
                <li
                  key={r.user_id}
                  className="flex items-center gap-3 px-3 py-2.5"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-zinc-800">
                      {fullName(r.user) || r.user_id}
                      {r.user?.branch?.name && (
                        <span className="ml-2 rounded bg-zinc-100 px-1.5 py-0.5 text-[11px] font-normal text-zinc-500">
                          {r.user.branch.name}
                        </span>
                      )}
                    </p>
                    <p className="truncate text-xs text-zinc-400">
                      {r.user?.email || "—"} · enroll {fmtDate(r.created_at)}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => kick(r)}
                    disabled={busyId === r.user_id}
                    className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-rose-200 px-2.5 py-1.5 text-xs font-medium text-rose-600 transition-colors hover:bg-rose-50 disabled:opacity-50"
                  >
                    <UserMinus size={12} />
                    {busyId === r.user_id ? "…" : "Keluarkan"}
                  </button>
                </li>
              ))}
              {shown.length === 0 && (
                <li className="px-3 py-3 text-center text-xs text-zinc-400">
                  Nggak ada yang cocok.
                </li>
              )}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
