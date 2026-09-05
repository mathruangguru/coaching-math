import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronDown,
  UserCheck,
  UserPlus,
  Link2,
  NotebookPen,
  Plus,
  Trash2,
  Download,
} from "lucide-react";
import { getCourse } from "../../lib/courses";
import { getUsers } from "../../lib/users";
import { supabase, hasSupabase } from "../../lib/supabase";
import {
  getRounds,
  getRoundAttendance,
  createRound,
  setRoundOpen,
  renameRound,
  setRoundSource,
  deleteRound,
  bulkCheckIn,
} from "../../lib/sessions";
import {
  getForm,
  getFormResponses,
  deleteFormResponse,
  responsesToCsv,
} from "../../lib/forms";
import { getAttemptUserIdsByLesson } from "../../lib/quiz";
import FormSummary from "./FormSummary";
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

// Inisial dari nama: huruf pertama kata pertama + kata terakhir.
const initialsOf = (name) => {
  const parts = (name || "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

const AV_TINTS = [
  "bg-emerald-100 text-emerald-700",
  "bg-sky-100 text-sky-700",
  "bg-amber-100 text-amber-700",
  "bg-violet-100 text-violet-700",
  "bg-rose-100 text-rose-700",
  "bg-teal-100 text-teal-700",
];
const tintFor = (s) => {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return AV_TINTS[Math.abs(h) % AV_TINTS.length];
};

// Avatar bulat inisial; hover → popup nama + email + waktu hadir.
function AttendeeAvatar({ user, uid, at }) {
  const [tip, setTip] = useState(null); // { left, top, above } | null
  const name = user ? fullName(user) : uid;
  const show = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    const vw = window.innerWidth || 1024;
    const vh = window.innerHeight || 768;
    const above = r.bottom + 72 > vh;
    setTip({
      left: Math.min(Math.max(140, r.left + r.width / 2), vw - 140),
      top: above ? r.top - 6 : r.bottom + 6,
      above,
    });
  };
  return (
    <span
      className="relative inline-flex"
      onMouseEnter={show}
      onMouseLeave={() => setTip(null)}
    >
      <span
        aria-label={name}
        className={`grid h-9 w-9 cursor-default place-items-center rounded-full text-[11px] font-bold ring-1 ring-inset ring-black/[0.04] ${tintFor(
          uid || name
        )}`}
      >
        {initialsOf(name)}
      </span>
      {tip && (
        <span
          className={`pointer-events-none fixed z-50 -translate-x-1/2 rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-left shadow-lg ${
            tip.above ? "-translate-y-full" : ""
          }`}
          style={{ left: tip.left, top: tip.top }}
        >
          <span className="block whitespace-nowrap text-xs font-semibold text-zinc-800">
            {name}
          </span>
          {user?.email && (
            <span className="block whitespace-nowrap text-[11px] text-zinc-400">
              {user.email}
            </span>
          )}
          <span className="block whitespace-nowrap text-[11px] text-zinc-400">
            Hadir {fmt(at)}
          </span>
        </span>
      )}
    </span>
  );
}

// user_id[] peserta sebuah sumber (latihan soal / form / ronde presensi lain).
async function sourceUserIds(val, rounds) {
  const [kind, a, b] = val.split(":");
  if (kind === "soal") return getAttemptUserIdsByLesson(a);
  if (kind === "form") {
    const rows = await getFormResponses(b, a); // (formId, lessonId)
    return [...new Set(rows.map((r) => r.user_id).filter(Boolean))];
  }
  if (kind === "round") {
    const r = rounds.find((x) => x.id === a);
    return [...new Set((r?.people ?? []).map((p) => p.user_id))];
  }
  return [];
}

// Bikin ronde presensi BARU dari peserta sebuah aktivitas (latihan soal /
// form / ronde presensi lain di course yang sama).
function ImportRound({ lessonId, soalSrc, formSrc, rounds, onDone }) {
  const [sel, setSel] = useState("");
  const [label, setLabel] = useState("");
  const [edited, setEdited] = useState(false);
  const [preview, setPreview] = useState(null); // { total, ids } | null
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const titleOf = (val) => {
    const [kind, a] = val.split(":");
    if (kind === "soal" || kind === "form")
      return [...soalSrc, ...formSrc].find((i) => i.id === a)?.title ?? "";
    if (kind === "round") return rounds.find((r) => r.id === a)?.label ?? "";
    return "";
  };

  const pick = async (val) => {
    setSel(val);
    setPreview(null);
    setErr("");
    if (!edited) setLabel(val ? `Presensi: ${titleOf(val)}` : "");
    if (!val) return;
    setBusy(true);
    try {
      const ids = await sourceUserIds(val, rounds);
      setPreview({ total: ids.length, ids });
    } catch (e) {
      setErr(e?.message ?? "Gagal memuat sumber.");
    } finally {
      setBusy(false);
    }
  };

  const create = async () => {
    if (!sel || busy) return;
    const [kind, a] = sel.split(":");
    setBusy(true);
    setErr("");
    try {
      const name = label.trim() || titleOf(sel);
      if (kind === "round") {
        // Ronde lain → salinan sekali jalan (nggak ke-link).
        const ids = preview?.ids ?? (await sourceUserIds(sel, rounds));
        const row = await createRound(lessonId, name);
        if (ids.length) await bulkCheckIn(row.id, ids);
      } else {
        // Latihan soal / form → ronde ter-link, isinya dijaga trigger DB.
        await createRound(lessonId, name, { kind, lessonId: a });
      }
      onDone(true);
    } catch (e) {
      setErr(e?.message ?? "Gagal membuat presensi.");
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-1.5 rounded-lg border border-zinc-200 bg-white p-2.5">
      <p className="text-[11px] font-semibold text-zinc-500">
        Presensi baru dari aktivitas
      </p>
      <select
        value={sel}
        onChange={(e) => pick(e.target.value)}
        disabled={busy}
        className="w-full rounded-md border border-zinc-300 bg-white px-2 py-1 text-xs text-zinc-800 outline-none focus:border-brand-500 disabled:opacity-50"
      >
        <option value="">Ambil peserta dari…</option>
        {soalSrc.length > 0 && (
          <optgroup label="Latihan soal — yang sudah mengerjakan">
            {soalSrc.map((i) => (
              <option key={i.id} value={`soal:${i.id}`}>
                {i.title}
              </option>
            ))}
          </optgroup>
        )}
        {formSrc.length > 0 && (
          <optgroup label="Form / Refleksi — yang sudah mengisi">
            {formSrc.map((i) => (
              <option key={i.id} value={`form:${i.id}:${i.form_id}`}>
                {i.title}
              </option>
            ))}
          </optgroup>
        )}
        {rounds.length > 0 && (
          <optgroup label="Presensi lain — yang hadir">
            {rounds.map((r) => (
              <option key={r.id} value={`round:${r.id}`}>
                {r.label}
              </option>
            ))}
          </optgroup>
        )}
      </select>

      <input
        value={label}
        onChange={(e) => {
          setLabel(e.target.value);
          setEdited(true);
        }}
        placeholder="nama presensi baru…"
        className="rounded-md border border-zinc-300 px-2 py-1 text-xs text-zinc-800 outline-none focus:border-brand-500"
      />

      {err && <p className="text-[11px] text-rose-500">{err}</p>}

      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] text-zinc-500">
          {busy && !preview
            ? "Memuat…"
            : !preview
              ? "Pilih sumbernya dulu"
              : sel.startsWith("round:")
                ? `${preview.total} orang bakal ditandai hadir`
                : `${preview.total} orang sekarang · nyambung otomatis`}
        </span>
        <div className="flex gap-1.5">
          <button
            type="button"
            onClick={() => onDone(false)}
            className="rounded-md border border-zinc-200 px-2 py-1 text-xs font-medium text-zinc-500 transition-colors hover:bg-zinc-50"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={create}
            disabled={!sel || busy}
            className="inline-flex items-center gap-1 rounded-md bg-emerald-500 px-2 py-1 text-xs font-semibold text-white transition-colors hover:bg-emerald-600 disabled:opacity-50"
          >
            <Plus size={12} /> Buat presensi
            {preview ? ` (${preview.total})` : ""}
          </button>
        </div>
      </div>
    </div>
  );
}

function PresensiRow({ lesson, usersById, courseItems = [] }) {
  const [open, setOpen] = useState(false);
  const [rounds, setRounds] = useState(null); // null | [{ ...round, people: [] }]
  const [showImport, setShowImport] = useState(false);
  const [failed, setFailed] = useState(false);
  const [label, setLabel] = useState("");
  const [busy, setBusy] = useState(false);
  const [view, setView] = useState("sesi"); // sesi | rekap
  const [editId, setEditId] = useState(null); // ronde yang lagi diganti namanya
  const [draft, setDraft] = useState("");
  const escRef = useRef(false);
  const loadedRef = useRef(false);

  // Rekap per orang: hadir berapa sesi dari total sesi presensi.
  const recap = useMemo(() => {
    if (!rounds || rounds.length === 0) return [];
    const cnt = new Map();
    for (const r of rounds)
      for (const p of r.people) cnt.set(p.user_id, (cnt.get(p.user_id) ?? 0) + 1);
    return [...cnt.entries()]
      .map(([uid, n]) => {
        const u = usersById.get(uid);
        return { uid, u, name: u ? fullName(u) : uid, n };
      })
      .sort((a, b) => b.n - a.n || a.name.localeCompare(b.name));
  }, [rounds, usersById]);

  // Aktivitas lain di course yang bisa jadi sumber kehadiran.
  const soalSrc = courseItems.filter(
    (i) => i.type === "soal" && i.question_set_id
  );
  const formSrc = courseItems.filter(
    (i) => (i.type === "form" || i.type === "refleksi") && i.form_id
  );
  const hasSrc = soalSrc.length > 0 || formSrc.length > 0;

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

  // Realtime: check-in / sync trigger masuk-keluar -> refresh (debounce).
  useEffect(() => {
    if (!open || !hasSupabase) return;
    let t;
    const channel = supabase
      .channel(`att:${lesson.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "coaching_attendance" },
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

  // Orang unik yang pernah hadir di ronde mana pun (bukan total check-in).
  const total = rounds
    ? new Set(rounds.flatMap((r) => r.people.map((p) => p.user_id))).size
    : 0;

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

  const startRename = (r) => {
    escRef.current = false;
    setDraft(r.label);
    setEditId(r.id);
  };

  const commitRename = async (r) => {
    setEditId(null);
    if (escRef.current) {
      escRef.current = false;
      return;
    }
    const name = draft.trim();
    if (!name || name === r.label) return;
    setRounds((p) => p.map((x) => (x.id === r.id ? { ...x, label: name } : x)));
    try {
      await renameRound(r.id, name);
    } catch (err) {
      window.alert(`Gagal ganti nama: ${err?.message ?? err}`);
      load();
    }
  };

  const sourceTitle = (r) =>
    courseItems.find((i) => i.id === r.source_lesson_id)?.title ??
    "aktivitas dihapus";

  const unlink = async (r) => {
    if (
      !window.confirm(
        `Lepas link "${r.label}" dari ${sourceTitle(r)}? Daftar hadir yang ada sekarang dibekukan (nggak auto-update lagi).`
      )
    )
      return;
    setRounds((p) =>
      p.map((x) =>
        x.id === r.id
          ? { ...x, source_kind: null, source_lesson_id: null }
          : x
      )
    );
    try {
      await setRoundSource(r.id, null);
    } catch (err) {
      window.alert(`Gagal: ${err?.message ?? err}`);
      load();
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

              {rounds.length > 0 && (
                <div className="inline-flex w-fit rounded-lg border border-zinc-200 bg-white p-0.5 text-xs font-semibold">
                  {[
                    ["sesi", "Per sesi"],
                    ["rekap", "Rekap kehadiran"],
                  ].map(([k, lbl]) => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => setView(k)}
                      className={`rounded-md px-2.5 py-1 transition-colors ${
                        view === k
                          ? "bg-brand-500 text-white"
                          : "text-zinc-500 hover:text-zinc-800"
                      }`}
                    >
                      {lbl}
                    </button>
                  ))}
                </div>
              )}

              {view === "rekap" && rounds.length > 0 && (
                <div className="rounded-lg border border-zinc-200 bg-white">
                  {recap.length === 0 ? (
                    <p className="px-3 py-4 text-center text-xs text-zinc-400">
                      Belum ada yang hadir.
                    </p>
                  ) : (
                    <ul className="divide-y divide-zinc-100">
                      {recap.map((x) => {
                        const p = Math.round((x.n / rounds.length) * 100);
                        return (
                          <li
                            key={x.uid}
                            className="flex items-center gap-3 px-3 py-2"
                          >
                            <span
                              className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-[10px] font-bold ${tintFor(
                                x.uid
                              )}`}
                            >
                              {initialsOf(x.name)}
                            </span>
                            <span className="flex min-w-0 flex-1 flex-col">
                              <span className="truncate text-xs font-medium text-zinc-800">
                                {x.name}
                              </span>
                              {x.u?.email && (
                                <span className="truncate text-[11px] text-zinc-400">
                                  {x.u.email}
                                </span>
                              )}
                            </span>
                            <span className="h-1.5 w-14 shrink-0 overflow-hidden rounded-full bg-zinc-100">
                              <span
                                className="block h-full rounded-full bg-emerald-500"
                                style={{ width: `${p}%` }}
                              />
                            </span>
                            <span className="w-12 shrink-0 text-right text-xs font-semibold text-zinc-600">
                              {x.n}/{rounds.length}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              )}

              {view === "sesi" &&
                rounds.map((r) => (
                <div
                  key={r.id}
                  className="rounded-lg border border-zinc-200 bg-white p-3"
                >
                  <div className="flex items-center gap-2">
                    {editId === r.id ? (
                      <input
                        autoFocus
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        onBlur={() => commitRename(r)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") e.currentTarget.blur();
                          else if (e.key === "Escape") {
                            escRef.current = true;
                            e.currentTarget.blur();
                          }
                        }}
                        className="min-w-0 flex-1 rounded border border-brand-400 px-1.5 py-0.5 text-sm font-semibold text-zinc-800 outline-none"
                      />
                    ) : (
                      <button
                        type="button"
                        onClick={() => startRename(r)}
                        title="Klik buat ganti nama"
                        className="min-w-0 flex-1 truncate text-left text-sm font-semibold text-zinc-800 transition-colors hover:text-brand-600"
                      >
                        {r.label}
                      </button>
                    )}
                    {r.source_kind && (
                      <button
                        type="button"
                        onClick={() => unlink(r)}
                        title={`Otomatis dari ${sourceTitle(r)} — klik buat lepas link`}
                        className="inline-flex shrink-0 items-center gap-1 rounded-full bg-sky-50 px-1.5 py-0.5 text-[10px] font-semibold text-sky-600 transition-colors hover:bg-rose-50 hover:text-rose-600"
                      >
                        <Link2 size={10} /> otomatis
                      </button>
                    )}
                    <span className="shrink-0 text-xs text-zinc-400">
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
                    <div className="mt-2 flex flex-wrap gap-1.5 border-t border-zinc-100 pt-2.5">
                      {r.people.map((p) => (
                        <AttendeeAvatar
                          key={p.user_id}
                          user={usersById.get(p.user_id)}
                          uid={p.user_id}
                          at={p.checked_in_at}
                        />
                      ))}
                    </div>
                  )}
                </div>
              ))}

              {view === "sesi" && hasSrc && showImport && (
                <ImportRound
                  lessonId={lesson.id}
                  soalSrc={soalSrc}
                  formSrc={formSrc}
                  rounds={rounds}
                  onDone={(created) => {
                    setShowImport(false);
                    if (created) load();
                  }}
                />
              )}

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

              {view === "sesi" && hasSrc && !showImport && (
                <button
                  type="button"
                  onClick={() => setShowImport(true)}
                  className="inline-flex w-fit items-center gap-1 text-[11px] font-medium text-zinc-400 transition-colors hover:text-zinc-700"
                >
                  <UserPlus size={11} /> Buat presensi dari aktivitas lain
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </li>
  );
}

const answerText = (v) =>
  Array.isArray(v) ? v.join(", ") : v == null || v === "" ? "—" : String(v);

function RefleksiRow({ lesson, usersById }) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState(null); // { form, responses } | null
  const [failed, setFailed] = useState(false);
  const [tab, setTab] = useState("ringkasan"); // ringkasan | jawaban
  const loadedRef = useRef(false);

  const load = useCallback(() => {
    Promise.all([
      getForm(lesson.form_id),
      getFormResponses(lesson.form_id, lesson.id),
    ])
      .then(([form, responses]) => {
        setData({ form, responses });
        setFailed(false);
      })
      .catch((err) => {
        console.error("[admin] gagal memuat respons refleksi:", err);
        loadedRef.current = false;
        setFailed(true);
      });
  }, [lesson.form_id, lesson.id]);

  useEffect(() => {
    if (!open || !lesson.form_id || loadedRef.current) return;
    loadedRef.current = true;
    load();
  }, [open, load, lesson.form_id]);

  const removeResp = async (id) => {
    if (!window.confirm("Hapus respons ini?")) return;
    try {
      await deleteFormResponse(id);
      setData((d) =>
        d ? { ...d, responses: d.responses.filter((r) => r.id !== id) } : d
      );
    } catch (err) {
      window.alert(`Gagal: ${err?.message ?? err}`);
    }
  };

  const downloadCsv = () => {
    const csv = responsesToCsv(data.form, data.responses, usersById);
    const url = URL.createObjectURL(
      new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" })
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = `${lesson.title.replace(/[^\w.-]+/g, "_")}-refleksi.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!lesson.form_id)
    return (
      <li className="flex items-center gap-3 px-4 py-2.5">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-rose-50 text-rose-600">
          <NotebookPen size={15} />
        </span>
        <span className="min-w-0 flex-1 truncate text-sm font-medium text-zinc-800">
          {lesson.title}
          <span className="ml-1.5 text-xs font-normal text-zinc-400">
            Refleksi
          </span>
        </span>
        <span className="shrink-0 text-xs text-zinc-400">belum ada form</span>
      </li>
    );

  const fields = data?.form?.fields ?? [];

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
        {data && (
          <span className="shrink-0 rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-semibold text-zinc-500">
            {data.responses.length} respons
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
          {!data && !failed && <Skeleton className="h-10 w-full rounded" />}
          {failed && <p className="text-xs text-rose-500">Gagal memuat.</p>}

          {data && data.responses.length === 0 && (
            <p className="text-xs text-zinc-400">Belum ada yang mengisi.</p>
          )}

          {data && data.responses.length > 0 && (
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between gap-2">
                <div className="inline-flex w-fit rounded-lg border border-zinc-200 bg-white p-0.5 text-xs font-semibold">
                  {[
                    ["ringkasan", "Ringkasan"],
                    ["jawaban", "Jawaban"],
                  ].map(([k, label]) => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => setTab(k)}
                      className={`rounded-md px-2.5 py-1 transition-colors ${
                        tab === k
                          ? "bg-brand-500 text-white"
                          : "text-zinc-500 hover:text-zinc-800"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={downloadCsv}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-zinc-200 bg-white px-2 py-1 text-xs font-medium text-zinc-600 transition-colors hover:bg-zinc-50"
                >
                  <Download size={12} /> CSV
                </button>
              </div>

              {tab === "ringkasan" && (
                <FormSummary form={data.form} responses={data.responses} paged />
              )}

              {tab === "jawaban" && (
                <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white">
                  <table className="min-w-full border-collapse text-xs">
                    <thead>
                      <tr className="bg-zinc-50 text-left text-zinc-500">
                        <th className="whitespace-nowrap border-b border-zinc-100 px-2.5 py-1.5 font-semibold">
                          Nama
                        </th>
                        <th className="whitespace-nowrap border-b border-zinc-100 px-2.5 py-1.5 font-semibold">
                          Waktu
                        </th>
                        {fields.map((f) => (
                          <th
                            key={f.id}
                            className="border-b border-zinc-100 px-2.5 py-1.5 font-semibold"
                          >
                            {f.label || "(tanpa label)"}
                          </th>
                        ))}
                        <th className="border-b border-zinc-100" />
                      </tr>
                    </thead>
                    <tbody>
                      {data.responses.map((r) => {
                        const u = usersById.get(r.user_id);
                        return (
                          <tr key={r.id} className="align-top">
                            <td className="whitespace-nowrap border-b border-zinc-100 px-2.5 py-1.5 text-zinc-700">
                              {u ? fullName(u) : r.user_id}
                            </td>
                            <td className="whitespace-nowrap border-b border-zinc-100 px-2.5 py-1.5 text-zinc-400">
                              {fmt(r.created_at)}
                            </td>
                            {fields.map((f) => (
                              <td
                                key={f.id}
                                className="border-b border-zinc-100 px-2.5 py-1.5 text-zinc-700"
                              >
                                {answerText(r.answers?.[f.id])}
                              </td>
                            ))}
                            <td className="border-b border-zinc-100 px-1.5 py-1.5">
                              <button
                                type="button"
                                onClick={() => removeResp(r.id)}
                                aria-label="Hapus respons"
                                className="grid h-6 w-6 place-items-center rounded text-zinc-300 transition-colors hover:bg-rose-50 hover:text-rose-500"
                              >
                                <Trash2 size={11} />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </li>
  );
}

export default function CourseSessionRecap({ courseId, only }) {
  const [status, setStatus] = useState("loading");
  const [lessons, setLessons] = useState([]);
  const [courseItems, setCourseItems] = useState([]);
  const [usersById, setUsersById] = useState(new Map());

  const kinds = only ? [only] : ["presensi", "refleksi"];

  useEffect(() => {
    let alive = true;
    Promise.all([getCourse(courseId), getUsers()])
      .then(([course, users]) => {
        if (!alive) return;
        const all = (course?.sections ?? []).flatMap((s) => s.items ?? []);
        const items = all.filter((it) =>
          only
            ? it.type === only
            : it.type === "presensi" || it.type === "refleksi"
        );
        setLessons(items);
        setCourseItems(
          all
            .filter(
              (i) =>
                i.type === "soal" || i.type === "form" || i.type === "refleksi"
            )
            .map((i) => ({
              id: i.id,
              type: i.type,
              title: i.title,
              question_set_id: i.question_set_id,
              form_id: i.form_id,
            }))
        );
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
  }, [courseId, only]);

  const heading =
    only === "presensi"
      ? "Presensi"
      : only === "refleksi"
        ? "Refleksi"
        : "Presensi & Refleksi";

  return (
    <div className="overflow-hidden rounded-2xl border border-zinc-200/80 bg-white">
      <div className="border-b border-zinc-100 px-5 py-3">
        <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-zinc-400">
          {heading}
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
            Belum ada item {kinds.map((k) => (k === "presensi" ? "Presensi" : "Refleksi")).join(" / ")}{" "}
            di course ini. Tambahin lewat editor kurikulum.
          </p>
        )}
        {status === "ready" && lessons.length > 0 && (
          <ul className="divide-y divide-zinc-100">
            {lessons.map((l) =>
              l.type === "presensi" ? (
                <PresensiRow
                  key={l.id}
                  lesson={l}
                  usersById={usersById}
                  courseItems={courseItems}
                />
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
