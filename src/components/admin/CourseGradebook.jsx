import { useEffect, useMemo, useState } from "react";
import { Search, Download, Copy, Check } from "lucide-react";
import { getCourse } from "../../lib/courses";
import { getCourseEnrollments } from "../../lib/enroll";
import { getUsers } from "../../lib/users";
import { getCourseAttempts } from "../../lib/quiz";
import Skeleton from "../ui/Skeleton";

const fullName = (u) =>
  [u?.first_name, u?.last_name].filter(Boolean).join(" ") || u?.email || "";

const pct = (s, t) => (t > 0 ? Math.round((s / t) * 100) : 0);

// Warna teks skor: hijau kalau kuat, kuning sedang, merah lemah.
const toneText = (p) =>
  p == null
    ? "text-zinc-300"
    : p >= 70
      ? "text-teal-600"
      : p >= 40
        ? "text-amber-600"
        : "text-rose-600";

// Tint background sel — sedikit lebih ketat dari toneText biar nggak norak.
const toneCell = (p) =>
  p >= 80 ? "bg-teal-50" : p >= 50 ? "bg-amber-50" : "bg-rose-50";

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

const csvCell = (v) => {
  const s = String(v ?? "");
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

// Buat paste ke spreadsheet: tab/enter di dalam sel diganti spasi.
const tsvCell = (v) => String(v ?? "").replace(/[\t\r\n]+/g, " ");

// Nilai buat sorting sebuah baris di kolom `key` ('name' | 'avg' | <quizId>).
const sortVal = (r, key) => {
  if (key === "name") return fullName(r.user).toLowerCase() || r.uid;
  if (key === "avg") return r.avgPct;
  return r.cells[key]?.pct; // kolom soal
};

// Penanda arah sort di header. state: 'asc' | 'desc' | null.
function SortCaret({ state }) {
  return (
    <span
      className={`ml-0.5 inline-block shrink-0 text-[8px] leading-none ${
        state ? "text-brand-500" : "text-zinc-300"
      }`}
    >
      {state === "asc" ? "▲" : state === "desc" ? "▼" : "↕"}
    </span>
  );
}

/**
 * Gradebook satu course: matriks nilai murid × latihan soal. Baris = murid
 * enrolled (plus siapa pun yang punya attempt walau nggak enroll), kolom =
 * item soal urut kurikulum. Sel = attempt TERAKHIR murid itu di soal itu.
 */
export default function CourseGradebook({ courseId }) {
  const [status, setStatus] = useState("loading"); // loading | error | empty | ready
  const [quizzes, setQuizzes] = useState([]); // [{ id, title }]
  const [rows, setRows] = useState([]);
  const [q, setQ] = useState("");
  const [copied, setCopied] = useState(false);
  const [hidden, setHidden] = useState(() => new Set()); // quizId yang disembunyiin
  // { key: 'name' | 'avg' | <quizId>, dir: 'asc' | 'desc' } | null (urutan default)
  const [sort, setSort] = useState(null);

  const toggleQuiz = (id) =>
    setHidden((h) => {
      const n = new Set(h);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n; // boleh sembunyiin semua — tombol "semua" balikin
    });

  const clickSort = (key) => {
    const primary = key === "name" ? "asc" : "desc"; // arah pertama saat diklik
    setSort((s) => {
      if (s?.key !== key) return { key, dir: primary };
      if (s.dir === primary)
        return { key, dir: primary === "asc" ? "desc" : "asc" };
      return null; // klik ketiga -> balik ke urutan default
    });
  };

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const course = await getCourse(courseId);
        const items = (course?.sections ?? [])
          .flatMap((s) => s.items ?? [])
          .filter((it) => it.type === "soal" && it.question_set_id)
          .map((it) => ({ id: it.id, title: it.title || "Latihan soal" }));

        if (items.length === 0) {
          if (alive) {
            setQuizzes([]);
            setRows([]);
            setStatus("empty");
          }
          return;
        }

        const [enrollments, users, attempts] = await Promise.all([
          getCourseEnrollments(courseId),
          getUsers(),
          getCourseAttempts(items.map((i) => i.id)),
        ]);
        if (!alive) return;

        const usersById = new Map(users.map((u) => [u.id, u]));
        const enrolledIds = new Set(enrollments.map((e) => e.user_id));

        // attempts urut terbaru dulu → yang pertama ketemu = attempt terakhir.
        const last = new Map(); // `${uid}|${lessonId}` -> attempt
        for (const a of attempts) {
          const k = `${a.user_id}|${a.lesson_id}`;
          if (!last.has(k)) last.set(k, a);
        }

        const ids = [
          ...new Set([...enrolledIds, ...attempts.map((a) => a.user_id)]),
        ];

        const built = ids
          .map((uid) => {
            const cells = {};
            let sumP = 0;
            let done = 0;
            for (const qz of items) {
              const a = last.get(`${uid}|${qz.id}`);
              if (!a) continue;
              const p = pct(a.score, a.total);
              cells[qz.id] = {
                score: a.score,
                total: a.total,
                pct: p,
                at: a.created_at,
              };
              sumP += p;
              done += 1;
            }
            return {
              uid,
              user: usersById.get(uid) ?? null,
              enrolled: enrolledIds.has(uid),
              cells,
              doneCount: done,
              avgPct: done ? Math.round(sumP / done) : null,
            };
          })
          .sort((a, b) => {
            if (a.enrolled !== b.enrolled) return a.enrolled ? -1 : 1;
            return fullName(a.user).localeCompare(fullName(b.user), "id");
          });

        setQuizzes(items);
        setRows(built);
        setStatus("ready");
      } catch (err) {
        console.error("[admin] gagal memuat gradebook:", err);
        if (alive) setStatus("error");
      }
    })();
    return () => {
      alive = false;
    };
  }, [courseId]);

  // Filter kolom: latihan soal yang ditampilkan (default semua).
  const visibleQuizzes = useMemo(
    () => quizzes.filter((qz) => !hidden.has(qz.id)),
    [quizzes, hidden],
  );

  // Sort yang berlaku: diabaikan kalau kolomnya lagi disembunyiin.
  const effSort =
    sort && sort.key !== "name" && sort.key !== "avg" && hidden.has(sort.key)
      ? null
      : sort;

  // avgPct / doneCount dihitung ulang atas latihan soal yang KELIHATAN.
  const rowsView = useMemo(
    () =>
      rows.map((r) => {
        let sum = 0;
        let done = 0;
        for (const qz of visibleQuizzes) {
          const c = r.cells[qz.id];
          if (c) {
            sum += c.pct;
            done += 1;
          }
        }
        return {
          ...r,
          avgPct: done ? Math.round(sum / done) : null,
          doneCount: done,
        };
      }),
    [rows, visibleQuizzes],
  );

  // Rata-rata per kolom (soal) + jumlah murid yang ngerjain.
  const colStats = useMemo(() => {
    const m = {};
    for (const qz of visibleQuizzes) {
      let sum = 0;
      let n = 0;
      for (const r of rowsView) {
        const c = r.cells[qz.id];
        if (c) {
          sum += c.pct;
          n += 1;
        }
      }
      m[qz.id] = { avg: n ? Math.round(sum / n) : null, n };
    }
    return m;
  }, [visibleQuizzes, rowsView]);

  const overall = useMemo(() => {
    const vals = rowsView.map((r) => r.avgPct).filter((v) => v != null);
    return vals.length
      ? Math.round(vals.reduce((s, v) => s + v, 0) / vals.length)
      : null;
  }, [rowsView]);

  const needle = q.trim().toLowerCase();

  const shown = useMemo(() => {
    const filtered = rowsView.filter(
      (r) =>
        fullName(r.user).toLowerCase().includes(needle) ||
        (r.user?.email ?? "").toLowerCase().includes(needle),
    );
    if (!effSort) {
      return [...filtered].sort((a, b) => {
        if (a.enrolled !== b.enrolled) return a.enrolled ? -1 : 1;
        return fullName(a.user).localeCompare(fullName(b.user), "id");
      });
    }
    const mul = effSort.dir === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => {
      const va = sortVal(a, effSort.key);
      const vb = sortVal(b, effSort.key);
      const ma = va == null || va === "";
      const mb = vb == null || vb === "";
      if (ma && mb) return fullName(a.user).localeCompare(fullName(b.user), "id");
      if (ma) return 1; // yang belum ngerjain selalu di bawah
      if (mb) return -1;
      if (effSort.key === "name")
        return String(va).localeCompare(String(vb), "id") * mul;
      return (
        (va - vb) * mul ||
        fullName(a.user).localeCompare(fullName(b.user), "id")
      );
    });
  }, [rowsView, needle, effSort]);

  // Matriks nilai sebagai baris teks — dipakai export CSV & copy TSV.
  // Tiap latihan soal jadi 2 kolom: skor ("13/30") + persen (angka "43").
  const tableMatrix = () => {
    const head = [
      "Nama",
      "Email",
      "Status",
      ...visibleQuizzes.flatMap((qz) => [qz.title, `${qz.title} (%)`]),
      "Rata-rata (%)",
      "Selesai",
    ];
    const body = rowsView.map((r) => [
      fullName(r.user) || r.uid,
      r.user?.email ?? "",
      r.enrolled ? "enrolled" : "tidak enroll",
      ...visibleQuizzes.flatMap((qz) => {
        const c = r.cells[qz.id];
        return c ? [`${c.score}/${c.total}`, c.pct] : ["", ""];
      }),
      r.avgPct ?? "",
      `${r.doneCount}/${visibleQuizzes.length}`,
    ]);
    return [head, ...body];
  };

  const exportCsv = () => {
    const csv = tableMatrix()
      .map((row) => row.map(csvCell).join(","))
      .join("\n");
    const url = URL.createObjectURL(
      new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = `nilai-${courseId}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Salin sebagai TSV — langsung kebaca jadi sel-sel pas di-paste ke
  // Google Sheets / Excel.
  const copyTable = async () => {
    const tsv = tableMatrix()
      .map((row) => row.map(tsvCell).join("\t"))
      .join("\n");
    try {
      await navigator.clipboard.writeText(tsv);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = tsv;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand("copy");
      } catch {
        /* nggak bisa nyalin — biarin */
      }
      document.body.removeChild(ta);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const stickyHead =
    "sticky left-0 z-20 border-b border-zinc-100 bg-zinc-50 px-3 py-2 text-left text-xs font-semibold text-zinc-500";
  const cellCol =
    "border-b border-l border-zinc-100 px-2 py-1.5 text-center align-middle";

  return (
    <div className="overflow-hidden rounded-2xl border border-zinc-200/80 bg-white">
      <div className="flex items-center justify-between gap-3 border-b border-zinc-100 px-5 py-3">
        <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-zinc-400">
          Nilai
        </span>
        {status === "ready" && rows.length > 0 && (
          <div className="flex flex-wrap items-center justify-end gap-2">
            <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-semibold text-zinc-500">
              {overall != null ? `rata-rata ${overall}%` : "belum ada nilai"}
            </span>
            <button
              type="button"
              onClick={copyTable}
              className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs font-medium transition-colors ${
                copied
                  ? "border-teal-200 bg-teal-50 text-teal-700"
                  : "border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50"
              }`}
              title="Salin tabel — tinggal paste ke Google Sheets / Excel"
            >
              {copied ? <Check size={12} /> : <Copy size={12} />}
              {copied ? "Tersalin" : "Salin tabel"}
            </button>
            <button
              type="button"
              onClick={exportCsv}
              className="inline-flex items-center gap-1.5 rounded-md border border-zinc-200 bg-white px-2 py-1 text-xs font-medium text-zinc-600 transition-colors hover:bg-zinc-50"
            >
              <Download size={12} /> CSV
            </button>
          </div>
        )}
      </div>

      <div className="p-5">
        {status === "loading" && (
          <div className="flex flex-col gap-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-11 w-full rounded-lg" />
            ))}
          </div>
        )}

        {status === "error" && (
          <p className="text-sm text-rose-500">Gagal memuat nilai.</p>
        )}

        {status === "empty" && (
          <p className="text-sm text-zinc-400">
            Belum ada latihan soal di course ini. Tambahin lewat editor
            kurikulum.
          </p>
        )}

        {status === "ready" && rows.length === 0 && (
          <p className="text-sm text-zinc-400">
            Belum ada murid enroll atau nilai yang masuk.
          </p>
        )}

        {status === "ready" && rows.length > 0 && (
          <div className="flex flex-col gap-3">
            {quizzes.length > 1 && (
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-zinc-400">
                  Latihan soal
                </span>
                {quizzes.map((qz) => {
                  const on = !hidden.has(qz.id);
                  return (
                    <button
                      key={qz.id}
                      type="button"
                      onClick={() => toggleQuiz(qz.id)}
                      className={`max-w-[180px] truncate rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
                        on
                          ? "border-brand-300 bg-brand-50 text-brand-700"
                          : "border-zinc-200 bg-white text-zinc-400 line-through"
                      }`}
                    >
                      {qz.title}
                    </button>
                  );
                })}
                {hidden.size > 0 && (
                  <button
                    type="button"
                    onClick={() => setHidden(new Set())}
                    className="text-[11px] font-medium text-brand-600 transition-colors hover:text-brand-700"
                  >
                    tampilkan semua
                  </button>
                )}
              </div>
            )}

            {rows.length > 8 && (
              <label className="relative sm:max-w-xs">
                <Search
                  size={14}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400"
                />
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Cari nama / email…"
                  className="w-full rounded-lg border border-zinc-300 py-2 pl-8 pr-3 text-sm text-zinc-900 outline-none transition-colors focus:border-brand-500"
                />
              </label>
            )}

            {visibleQuizzes.length === 0 ? (
              <p className="rounded-lg border border-dashed border-zinc-300 px-3 py-4 text-center text-xs text-zinc-400">
                Semua latihan soal disembunyiin. Pilih minimal satu di atas.
              </p>
            ) : (
            <div className="no-scrollbar overflow-x-auto rounded-xl border border-zinc-200">
              <table className="min-w-full border-collapse">
                <thead>
                  <tr className="bg-zinc-50">
                    <th className={stickyHead}>
                      <button
                        type="button"
                        onClick={() => clickSort("name")}
                        className="flex items-center font-semibold text-zinc-500 transition-colors hover:text-zinc-800"
                      >
                        Murid
                        <SortCaret
                          state={effSort?.key === "name" ? effSort.dir : null}
                        />
                      </button>
                    </th>
                    {visibleQuizzes.map((qz) => (
                      <th
                        key={qz.id}
                        title={qz.title}
                        className="min-w-[72px] border-b border-l border-zinc-100 px-2.5 py-2 text-center text-xs font-semibold text-zinc-500"
                      >
                        <button
                          type="button"
                          onClick={() => clickSort(qz.id)}
                          className="mx-auto flex max-w-[120px] items-center justify-center transition-colors hover:text-zinc-800"
                        >
                          <span className="min-w-0 truncate">{qz.title}</span>
                          <SortCaret
                            state={effSort?.key === qz.id ? effSort.dir : null}
                          />
                        </button>
                      </th>
                    ))}
                    <th className="min-w-[72px] border-b border-l border-zinc-100 px-2.5 py-2 text-center text-xs font-semibold text-zinc-500">
                      <button
                        type="button"
                        onClick={() => clickSort("avg")}
                        className="mx-auto flex items-center justify-center transition-colors hover:text-zinc-800"
                      >
                        Rata-rata
                        <SortCaret
                          state={effSort?.key === "avg" ? effSort.dir : null}
                        />
                      </button>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {shown.map((r) => (
                    <tr key={r.uid} className="group">
                      <td className="sticky left-0 z-10 border-b border-zinc-100 bg-white px-3 py-2 group-hover:bg-zinc-50">
                        <span className="block max-w-[220px] truncate text-sm text-zinc-800">
                          {fullName(r.user) || r.uid}
                        </span>
                        <span className="block max-w-[220px] truncate text-[11px] text-zinc-400">
                          {r.user?.email || "—"}
                          {!r.enrolled && (
                            <span className="ml-1 rounded bg-amber-50 px-1 py-px text-[10px] font-medium text-amber-600">
                              tidak enroll
                            </span>
                          )}
                        </span>
                      </td>
                      {visibleQuizzes.map((qz) => {
                        const c = r.cells[qz.id];
                        return (
                          <td
                            key={qz.id}
                            title={
                              c
                                ? `${c.score}/${c.total} · ${fmtDate(c.at)}`
                                : "belum dikerjakan"
                            }
                            className={`${cellCol} ${c ? toneCell(c.pct) : ""}`}
                          >
                            {c ? (
                              <>
                                <span className="block text-xs font-semibold text-zinc-800">
                                  {c.score}/{c.total}
                                </span>
                                <span
                                  className={`block text-[10px] font-semibold ${toneText(c.pct)}`}
                                >
                                  {c.pct}%
                                </span>
                              </>
                            ) : (
                              <span className="text-xs text-zinc-300">–</span>
                            )}
                          </td>
                        );
                      })}
                      <td className={cellCol}>
                        {r.avgPct != null ? (
                          <>
                            <span
                              className={`block text-sm font-bold ${toneText(r.avgPct)}`}
                            >
                              {r.avgPct}%
                            </span>
                            <span className="block text-[10px] text-zinc-400">
                              {r.doneCount}/{visibleQuizzes.length}
                            </span>
                          </>
                        ) : (
                          <span className="text-xs text-zinc-300">–</span>
                        )}
                      </td>
                    </tr>
                  ))}
                  {shown.length === 0 && (
                    <tr>
                      <td
                        colSpan={visibleQuizzes.length + 2}
                        className="px-3 py-4 text-center text-xs text-zinc-400"
                      >
                        Nggak ada yang cocok.
                      </td>
                    </tr>
                  )}
                </tbody>
                <tfoot>
                  <tr className="bg-zinc-50/80">
                    <td className="sticky left-0 z-10 border-t border-zinc-100 bg-zinc-50 px-3 py-2 text-xs font-semibold text-zinc-500">
                      Rata-rata kelas
                    </td>
                    {visibleQuizzes.map((qz) => {
                      const st = colStats[qz.id];
                      return (
                        <td
                          key={qz.id}
                          className="border-l border-t border-zinc-100 px-2 py-2 text-center"
                        >
                          {st.avg != null ? (
                            <>
                              <span
                                className={`block text-xs font-bold ${toneText(st.avg)}`}
                              >
                                {st.avg}%
                              </span>
                              <span className="block text-[10px] font-normal text-zinc-400">
                                {st.n} murid
                              </span>
                            </>
                          ) : (
                            <span className="text-xs text-zinc-300">–</span>
                          )}
                        </td>
                      );
                    })}
                    <td className="border-l border-t border-zinc-100 px-2 py-2 text-center">
                      {overall != null ? (
                        <span
                          className={`text-sm font-bold ${toneText(overall)}`}
                        >
                          {overall}%
                        </span>
                      ) : (
                        <span className="text-xs text-zinc-300">–</span>
                      )}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
            )}

            <p className="text-[11px] text-zinc-400">
              Nilai diambil dari attempt terakhir tiap murid. Klik header buat
              urutkan (klik lagi buat balik / reset). {rows.length} murid ·{" "}
              {visibleQuizzes.length}
              {hidden.size > 0 ? ` dari ${quizzes.length}` : ""} latihan soal.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
