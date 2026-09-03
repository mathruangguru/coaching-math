import { useState } from "react";
import { Link } from "react-router-dom";
import { ChevronDown, Check } from "lucide-react";
import LessonIcon from "../ui/LessonIcon";

const typeTint = {
  materi: "bg-zinc-100 text-zinc-500",
  soal: "bg-amber-50 text-amber-600",
  meet: "bg-sky-50 text-sky-600",
  recording: "bg-teal-50 text-teal-600",
  slide: "bg-orange-50 text-orange-600",
  form: "bg-violet-50 text-violet-600",
  presensi: "bg-emerald-50 text-emerald-600",
  refleksi: "bg-rose-50 text-rose-600",
};

const pill = "rounded px-1.5 py-0.5 text-[10px] font-semibold";
const pillTeal = `${pill} bg-teal-50 text-teal-600`;
const pillAmber = `${pill} bg-amber-50 text-amber-600`;
const pillRose = `${pill} bg-rose-50 text-rose-600`;
const pillMuted = `${pill} bg-zinc-100 text-zinc-500`;

// Badge hasil kuis: warna ikut rasio benar (biar skor jelek nggak keliatan
// "lulus" gara-gara hijau).
const scorePillCls = (score) => {
  if (!score || score.total == null || !score.total) return pillTeal;
  const r = (score.score ?? 0) / score.total;
  return r >= 0.7 ? pillTeal : r >= 0.4 ? pillAmber : pillRose;
};

// Persen skor sampai 2 desimal, nol di belakang dibuang.
const scorePct = (score) =>
  score.total ? +(((score.score ?? 0) / score.total) * 100).toFixed(2) : 0;

const scoreLabel = (score) =>
  score.total != null
    ? `Sudah dikerjakan · Skor ${score.score ?? 0}/${score.total} (${scorePct(
        score
      )}%)`
    : "Sudah dikerjakan";

function DoneBadge({ children }) {
  return (
    <span className={`inline-flex items-center gap-0.5 ${pillTeal}`}>
      <Check size={10} strokeWidth={3} />
      <span>{children}</span>
    </span>
  );
}

function CardInner({ item, done, att, score, quizStarted }) {
  const soon =
    (item.type === "soal" && !item.question_set_id) ||
    (item.type === "form" && !item.form_id && !item.url) ||
    (item.type === "refleksi" && !item.form_id) ||
    (item.type === "slide" && !item.url);
  const meta = [item.duration || null, soon ? "segera" : null]
    .filter(Boolean)
    .join(" · ");
  const notPublish = item.publish_status && item.publish_status !== "all";

  const isForm =
    (item.type === "form" || item.type === "refleksi") && !!item.form_id;
  const isQuiz = item.type === "soal" && !!item.question_set_id;
  const isPresensi = !!att && att.rounds > 0;
  const hadirPenuh = isPresensi && att.mine >= att.rounds;

  const hasMetaRow = meta || isForm || isQuiz || isPresensi || notPublish;

  return (
    <>
      <span
        className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${
          typeTint[item.type] ?? "bg-zinc-100 text-zinc-500"
        }`}
      >
        <LessonIcon type={item.type} size={16} />
      </span>

      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold leading-snug text-zinc-900 group-hover:text-brand-700">
          {item.title}
        </p>
        {hasMetaRow && (
          <span className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-zinc-400">
            {meta && <span>{meta}</span>}

            {isForm &&
              (done ? (
                <DoneBadge>Sudah diisi</DoneBadge>
              ) : (
                <span className={pillMuted}>Belum diisi</span>
              ))}

            {isQuiz &&
              (score ? (
                <span className={scorePillCls(score)}>{scoreLabel(score)}</span>
              ) : quizStarted ? (
                <span className={pillAmber}>Sedang dikerjakan</span>
              ) : (
                <span className={pillMuted}>Belum dikerjakan</span>
              ))}

            {isPresensi &&
              (hadirPenuh ? (
                <DoneBadge>
                  Hadir {att.mine}/{att.rounds}
                </DoneBadge>
              ) : (
                <span className={pillMuted}>
                  Hadir {att.mine}/{att.rounds}
                </span>
              ))}

            {notPublish && <span className={pillMuted}>Not publish</span>}
          </span>
        )}
      </div>
    </>
  );
}

const cardCls =
  "group flex items-start gap-3 rounded-xl border border-zinc-200/80 bg-white p-3.5 transition";
const clickableCls = " hover:border-zinc-300 hover:shadow-sm";

const EMPTY_PROGRESS = {
  done: new Set(),
  att: {},
  score: {},
  quizStarted: new Set(),
};

export default function CourseSection({
  section,
  courseId,
  progress = EMPTY_PROGRESS,
}) {
  const [open, setOpen] = useState(true);

  return (
    <section>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 py-2 text-left"
      >
        <ChevronDown
          size={16}
          className={`shrink-0 text-zinc-400 transition-transform ${
            open ? "" : "-rotate-90"
          }`}
        />
        <span className="flex-1 text-sm font-bold tracking-tight text-zinc-900">
          {section.title}
        </span>
        <span className="shrink-0 text-xs font-medium text-zinc-400">
          {section.items.length} materi
        </span>
      </button>

      {open && (
        <div className="mt-2 grid items-start gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {section.items.map((item) => {
            const inAppForm =
              (item.type === "form" || item.type === "refleksi") &&
              item.form_id;
            const external =
              (item.type === "meet" || item.type === "form") &&
              item.url &&
              !inAppForm;
            const recording = item.type === "recording" && item.url;
            const slide = item.type === "slide" && item.url;
            const article = item.type === "materi" && item.content;
            const quiz = item.type === "soal" && item.question_set_id;
            const presensi = item.type === "presensi";
            const done = inAppForm && !!progress.done?.has(item.id);
            const att = presensi ? progress.att?.[item.id] : null;
            const score = quiz ? progress.score?.[item.id] : null;
            const quizStarted =
              quiz &&
              !score &&
              !!progress.quizStarted?.has(item.question_set_id);

            if (external) {
              return (
                <a
                  key={item.id}
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={cardCls + clickableCls}
                >
                  <CardInner item={item} />
                </a>
              );
            }
            if (
              recording ||
              slide ||
              article ||
              quiz ||
              inAppForm ||
              presensi
            ) {
              const to = recording
                ? `/course/${courseId}/recording/${item.id}`
                : slide
                  ? `/course/${courseId}/slide/${item.id}`
                  : article
                    ? `/course/${courseId}/materi/${item.id}`
                    : presensi
                      ? `/course/${courseId}/presensi/${item.id}`
                      : inAppForm
                        ? `/course/${courseId}/${item.type}/${item.id}`
                        : `/course/${courseId}/soal/${item.id}`;
              return (
                <Link key={item.id} to={to} className={cardCls + clickableCls}>
                  <CardInner
                    item={item}
                    done={done}
                    att={att}
                    score={score}
                    quizStarted={quizStarted}
                  />
                </Link>
              );
            }
            return (
              <div key={item.id} className={cardCls}>
                <CardInner item={item} />
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
