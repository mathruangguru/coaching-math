import { useMemo, useState } from "react";
import {
  CalendarDays,
  MoreHorizontal,
  Video,
  Users,
  MessagesSquare,
} from "lucide-react";
import Avatar from "../ui/Avatar";
import { currentWeek } from "../../lib/date";
import { scheduleEvents } from "../../data/mock";

const eventIcons = {
  video: Video,
  users: Users,
  message: MessagesSquare,
};

export default function SchedulePanel() {
  const week = useMemo(() => currentWeek(), []);
  const [selected, setSelected] = useState(
    () => week.find((d) => d.isToday)?.key ?? week[0].key
  );

  return (
    <section className="rounded-3xl border border-zinc-200/80 bg-white p-6">
      <div className="flex items-center gap-2.5">
        <CalendarDays size={20} className="text-zinc-500" />
        <h2 className="text-lg font-bold tracking-tight text-zinc-900">
          Schedule
        </h2>
        <button className="ml-auto grid h-8 w-8 place-items-center rounded-lg text-zinc-400 transition-colors hover:bg-zinc-100">
          <MoreHorizontal size={18} />
        </button>
      </div>

      {/* Week strip */}
      <div className="mt-5 flex justify-between">
        {week.map((day) => {
          const active = day.key === selected;
          return (
            <button
              key={day.key}
              onClick={() => setSelected(day.key)}
              className={`flex w-11 flex-col items-center gap-1 rounded-xl py-2 transition-colors ${
                active
                  ? "bg-violet-200/70 text-violet-900"
                  : "text-zinc-400 hover:bg-zinc-100"
              }`}
            >
              <span className="text-xs font-medium">{day.label}</span>
              <span
                className={`text-sm font-bold ${
                  active ? "text-violet-900" : "text-zinc-700"
                }`}
              >
                {day.date}
              </span>
            </button>
          );
        })}
      </div>

      <div className="my-5 border-t border-zinc-100" />

      {/* Events */}
      <ul className="flex flex-col">
        {scheduleEvents.map((event, i) => {
          const Icon = eventIcons[event.icon];
          return (
            <li
              key={event.id}
              className={`flex items-center gap-4 py-4 ${
                i > 0 ? "border-t border-zinc-100" : ""
              }`}
            >
              <span
                className={`h-11 w-1 shrink-0 rounded-full ${event.accent}`}
              />
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2 font-semibold text-zinc-900">
                  <Icon size={15} className="shrink-0 text-zinc-400" />
                  <span className="truncate">{event.title}</span>
                </p>
                <p className="mt-0.5 text-sm text-zinc-500">{event.time}</p>
              </div>
              <div className="flex -space-x-2">
                {event.people.map((p, idx) => (
                  <Avatar
                    key={idx}
                    initials={p.initials}
                    color={p.color}
                    size="md"
                    ring
                  />
                ))}
              </div>
              <button className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-zinc-400 transition-colors hover:bg-zinc-100">
                <MoreHorizontal size={18} />
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
