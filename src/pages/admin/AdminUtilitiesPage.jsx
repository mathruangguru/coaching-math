import { Link } from "react-router-dom";
import { FerrisWheel, Timer } from "lucide-react";

const utils = [
  {
    to: "/admin/utilitas/spinwheel",
    label: "Spinwheel",
    desc: "Roda putar buat milih nama/opsi secara acak.",
    icon: FerrisWheel,
    tint: "bg-violet-50 text-violet-600",
  },
  {
    to: "/admin/utilitas/timer",
    label: "Timer",
    desc: "Hitung mundur buat latihan atau kuis.",
    icon: Timer,
    tint: "bg-sky-50 text-sky-600",
  },
];

export default function AdminUtilitiesPage() {
  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-zinc-900">
          Utilitas
        </h1>
        <p className="mt-1 text-xs text-zinc-400">
          Alat bantu kecil-kecilan. Bakal nambah seiring waktu.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {utils.map(({ to, label, desc, icon: Icon, tint }) => (
          <Link
            key={to}
            to={to}
            className="flex items-start gap-3 rounded-2xl border border-zinc-200 bg-white p-5 transition-colors hover:border-brand-300 hover:bg-brand-50/30"
          >
            <span
              className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${tint}`}
            >
              <Icon size={19} />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-zinc-900">{label}</p>
              <p className="mt-0.5 text-xs text-zinc-400">{desc}</p>
            </div>
          </Link>
        ))}
        <div className="flex items-center justify-center rounded-2xl border border-dashed border-zinc-200 bg-white/50 p-5 text-center text-xs text-zinc-300">
          Menu lain menyusul…
        </div>
      </div>
    </div>
  );
}
