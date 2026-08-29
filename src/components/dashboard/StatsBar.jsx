import { Clock, CircleCheckBig, Hourglass } from "lucide-react";
import { learningStats } from "../../data/mock";

const icons = {
  clock: Clock,
  check: CircleCheckBig,
  progress: Hourglass,
};

export default function StatsBar() {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-zinc-200/80 bg-white px-6 py-4 sm:flex-row sm:flex-wrap sm:items-center sm:gap-y-4">
      {learningStats.map((stat, i) => {
        const Icon = icons[stat.icon];
        return (
          <div
            key={stat.id}
            className={`flex items-center gap-3 sm:pr-6 ${
              i > 0
                ? "border-t border-zinc-200 pt-3 sm:border-l sm:border-t-0 sm:pt-0 sm:pl-6"
                : ""
            }`}
          >
            <Icon size={20} className="text-zinc-500" strokeWidth={2} />
            <p className="text-[15px] text-zinc-500">
              <span className="font-bold text-zinc-900">{stat.value}</span>{" "}
              {stat.label}
            </p>
          </div>
        );
      })}
    </div>
  );
}
