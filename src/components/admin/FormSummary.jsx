import { useMemo, useState } from "react";
import { Star, ChevronLeft, ChevronRight } from "lucide-react";

// Field auto — nggak ada yang perlu diringkas.
const SKIP = new Set(["name", "email", "date"]);
const OPTION_TYPES = new Set(["single", "multi", "check"]);

// Jawaban isian di bawah ini dianggap nggak substansial (mis. "-", "—",
// string kosong) -- nggak usah ikut ditampilkan di daftar Ringkasan.
const MIN_TEXT_LEN = 5;

const isBlank = (v) =>
  v == null ||
  v === 0 ||
  (typeof v === "string" && v.trim() === "") ||
  (Array.isArray(v) && v.length === 0);

const pctOf = (c, n) => (n ? Math.round((c / n) * 100) : 0);

// Daftar jawaban isian — anonim, awalnya 5 baris.
function TextAnswers({ texts }) {
  const [open, setOpen] = useState(false);
  const shown = open ? texts : texts.slice(0, 5);
  return (
    <>
      <ul className="mt-2 flex flex-col gap-1.5">
        {shown.map((t, i) => (
          <li
            key={i}
            className="whitespace-pre-wrap rounded-md bg-zinc-50 px-2.5 py-1.5 text-xs text-zinc-700"
          >
            {t}
          </li>
        ))}
      </ul>
      {texts.length > 5 && (
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="mt-1.5 text-[11px] font-semibold text-brand-600 transition-colors hover:text-brand-700"
        >
          {open ? "Tutup" : `Lihat ${texts.length - 5} lagi`}
        </button>
      )}
    </>
  );
}

/**
 * Rekap agregat sebuah form: satu blok per pertanyaan.
 *   rating         → rata-rata + sebaran 1–5
 *   single/multi/check → % tiap opsi (bar)
 *   short/long     → daftar semua jawaban, anonim
 * `form` harus bawa `.fields`. `responses` = [{ answers, ... }].
 * `paged` = true -> satu pertanyaan per layar (nav Sebelumnya/Berikutnya),
 * dipakai pas ini salah satu tab (nggak perlu semua keliatan sekaligus).
 */
export default function FormSummary({ form, responses, paged = false }) {
  const [idx, setIdx] = useState(0);
  const rows = useMemo(() => {
    const fields = (form?.fields ?? []).filter((f) => !SKIP.has(f.type));
    return fields.map((f) => {
      const vals = responses
        .map((r) => r.answers?.[f.id])
        .filter((v) => !isBlank(v));
      const n = vals.length;

      if (f.type === "rating") {
        const nums = vals.map(Number).filter((x) => x > 0);
        const dist = {};
        for (const x of nums) dist[x] = (dist[x] ?? 0) + 1;
        const sum = nums.reduce((s, x) => s + x, 0);
        return {
          f,
          kind: "rating",
          n: nums.length,
          avg: nums.length ? sum / nums.length : 0,
          dist,
        };
      }

      if (OPTION_TYPES.has(f.type)) {
        const count = new Map();
        for (const v of vals)
          for (const p of Array.isArray(v) ? v : [v])
            count.set(p, (count.get(p) ?? 0) + 1);
        const base = f.options ?? [];
        const opts = [...base];
        for (const k of count.keys()) if (!opts.includes(k)) opts.push(k);
        return {
          f,
          kind: "option",
          n,
          multi: f.type !== "single",
          opts: opts.map((o) => ({
            label: o,
            extra: !base.includes(o),
            c: count.get(o) ?? 0,
          })),
        };
      }

      const texts = vals
        .map((v) => String(v).trim())
        .filter((t) => t.length >= MIN_TEXT_LEN);
      return {
        f,
        kind: "text",
        n: texts.length,
        texts,
      };
    });
  }, [form, responses]);

  if (rows.length === 0) return null;

  const clampedIdx = Math.min(idx, rows.length - 1);
  const shown = paged ? [rows[clampedIdx]] : rows;

  return (
    <div className="rounded-lg border border-zinc-200 bg-white">
      <div className="border-b border-zinc-100 px-3 py-2">
        <p className="text-sm font-bold text-zinc-900">Ringkasan</p>
        <p className="mt-0.5 text-xs text-zinc-400">{responses.length} respons</p>
      </div>

      {paged && rows.length > 1 && (
        <div className="flex items-center justify-between gap-2 border-b border-zinc-100 px-3 py-2">
          <button
            type="button"
            onClick={() => setIdx((i) => Math.max(0, i - 1))}
            disabled={clampedIdx === 0}
            aria-label="Pertanyaan sebelumnya"
            className="grid h-6 w-6 place-items-center rounded-md border border-zinc-200 text-zinc-500 transition-colors hover:bg-zinc-50 disabled:opacity-30"
          >
            <ChevronLeft size={13} />
          </button>
          <span className="text-xs font-medium text-zinc-500">
            Pertanyaan {clampedIdx + 1} dari {rows.length}
          </span>
          <button
            type="button"
            onClick={() => setIdx((i) => Math.min(rows.length - 1, i + 1))}
            disabled={clampedIdx === rows.length - 1}
            aria-label="Pertanyaan berikutnya"
            className="grid h-6 w-6 place-items-center rounded-md border border-zinc-200 text-zinc-500 transition-colors hover:bg-zinc-50 disabled:opacity-30"
          >
            <ChevronRight size={13} />
          </button>
        </div>
      )}

      <ul className="divide-y divide-zinc-100">
        {shown.map(({ f, ...r }) => (
          <li key={f.id} className="px-3 py-3">
            <p className="text-xs font-semibold text-zinc-700">
              {f.label || "Pertanyaan"}
              <span className="ml-1.5 font-normal text-zinc-400">
                {r.n === responses.length
                  ? `${r.n} jawaban`
                  : `${r.n} dari ${responses.length}`}
                {r.kind === "option" && r.multi ? " · boleh pilih >1" : ""}
              </span>
            </p>

            {r.kind === "rating" &&
              (r.n === 0 ? (
                <p className="mt-1 text-xs text-zinc-300">Belum ada.</p>
              ) : (
                <div className="mt-1.5">
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-2xl font-bold text-zinc-900">
                      {r.avg.toFixed(1)}
                    </span>
                    <span className="text-xs text-zinc-400">/ 5</span>
                  </div>
                  <div className="mt-1.5 flex flex-col gap-1">
                    {[5, 4, 3, 2, 1].map((star) => {
                      const c = r.dist[star] ?? 0;
                      const p = pctOf(c, r.n);
                      return (
                        <div
                          key={star}
                          className="flex items-center gap-2 text-[11px]"
                        >
                          <span className="flex w-7 shrink-0 items-center gap-0.5 text-zinc-500">
                            {star}
                            <Star
                              size={10}
                              className="fill-amber-400 text-amber-400"
                            />
                          </span>
                          <span className="h-2 flex-1 overflow-hidden rounded-full bg-zinc-100">
                            <span
                              className="block h-full rounded-full bg-amber-400"
                              style={{ width: `${p}%` }}
                            />
                          </span>
                          <span className="w-12 shrink-0 text-right tabular-nums text-zinc-400">
                            {c} · {p}%
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}

            {r.kind === "option" &&
              (r.opts.length === 0 ? (
                <p className="mt-1 text-xs text-zinc-300">Nggak ada opsi.</p>
              ) : (
                <div className="mt-2 flex flex-col gap-2">
                  {r.opts.map((o, i) => {
                    const p = pctOf(o.c, r.n);
                    return (
                      <div key={i}>
                        <div className="flex items-baseline gap-1.5 text-[11px]">
                          <span className="min-w-0 flex-1 text-zinc-600">
                            {o.label || "—"}
                            {o.extra && (
                              <span className="ml-1 text-zinc-300">
                                (di luar opsi)
                              </span>
                            )}
                          </span>
                          <span className="shrink-0 tabular-nums text-zinc-400">
                            {o.c} · {p}%
                          </span>
                        </div>
                        <div className="mt-1 h-2 overflow-hidden rounded-full bg-zinc-100">
                          <div
                            className="h-full rounded-full bg-brand-400"
                            style={{ width: `${p}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}

            {r.kind === "text" &&
              (r.n === 0 ? (
                <p className="mt-1 text-xs text-zinc-300">Belum ada jawaban.</p>
              ) : (
                <TextAnswers texts={r.texts} />
              ))}
          </li>
        ))}
      </ul>
    </div>
  );
}
