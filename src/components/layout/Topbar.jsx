import { Search, Plus, ChevronDown, Bell } from "lucide-react";
import Avatar from "../ui/Avatar";
import { user } from "../../data/mock";

export default function Topbar() {
  return (
    <header className="flex flex-wrap items-center gap-3 border-b border-zinc-200/60 bg-white px-8 py-4">
      {/* Search */}
      <div className="relative min-w-[180px] flex-1 md:max-w-xl">
        <Search
          size={18}
          className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400"
        />
        <input
          type="text"
          placeholder="Cari course atau materi..."
          className="h-11 w-full rounded-xl border border-zinc-200 bg-zinc-50 pl-11 pr-16 text-sm text-zinc-700 outline-none transition-colors placeholder:text-zinc-400 focus:border-brand-500 focus:bg-white focus:ring-4 focus:ring-brand-500/10"
        />
        <kbd className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md border border-zinc-200 bg-white px-1.5 py-0.5 text-[11px] font-medium text-zinc-400">
          ⌘F
        </kbd>
      </div>

      <div className="ml-auto flex shrink-0 items-center gap-3">
        {/* Split primary action */}
        <div className="flex overflow-hidden rounded-xl bg-brand-500 text-white shadow-sm shadow-brand-500/30">
          <button className="flex items-center gap-2 whitespace-nowrap px-4 py-2.5 text-sm font-semibold transition-colors hover:bg-brand-600">
            <Plus size={16} strokeWidth={2.6} />
            Jelajahi Course
          </button>
          <button className="grid place-items-center border-l border-white/20 px-2 transition-colors hover:bg-brand-600">
            <ChevronDown size={16} />
          </button>
        </div>

        {/* Notifications */}
        <button className="relative grid h-11 w-11 place-items-center rounded-xl border border-zinc-200 text-zinc-600 transition-colors hover:bg-zinc-50">
          <Bell size={18} />
          <span className="absolute right-2.5 top-2.5 h-2 w-2 rounded-full bg-fuchsia-500 ring-2 ring-white" />
        </button>

        {/* Account */}
        <button className="rounded-xl ring-offset-2 transition hover:ring-2 hover:ring-zinc-200">
          <Avatar initials={user.initials} size="lg" color="bg-zinc-900" />
        </button>
      </div>
    </header>
  );
}
