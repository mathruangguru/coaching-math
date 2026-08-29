import { NavLink } from "react-router-dom";
import { LayoutDashboard, BookOpen, GraduationCap } from "lucide-react";
// Diparkir sementara (bareng blok Settings / Help & Support di bawah):
//   Settings, LifeBuoy from "lucide-react"

const mainNav = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/course", label: "Course", icon: BookOpen },
];

function navItemClass({ isActive }) {
  return [
    "flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors",
    isActive
      ? "bg-brand-500 text-white shadow-sm shadow-brand-500/30"
      : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900",
  ].join(" ");
}

export default function Sidebar() {
  return (
    <aside className="flex w-[264px] shrink-0 flex-col border-r border-zinc-200/70 bg-white px-5 py-6">
      {/* Brand */}
      <div className="flex items-center gap-2.5 px-2">
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-500 text-white">
          <GraduationCap size={17} strokeWidth={2.2} />
        </span>
        <span className="text-[15px] font-bold tracking-tight text-zinc-900">
          Coaching Math
        </span>
      </div>

      {/* Main nav */}
      <nav className="mt-8 flex flex-col gap-1">
        {mainNav.map(({ to, label, icon: Icon, end }) => (
          <NavLink key={to} to={to} end={end} className={navItemClass}>
            {({ isActive }) => (
              <>
                <Icon
                  size={18}
                  strokeWidth={isActive ? 2.4 : 2}
                  className={isActive ? "text-white" : "text-zinc-400"}
                />
                {label}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Parkir sementara: Settings & Help & Support
      <div className="mt-auto flex flex-col gap-1.5 border-t border-zinc-200/70 pt-5">
        <button className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-[15px] font-medium text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-900">
          <Settings size={20} strokeWidth={2} className="text-zinc-400" />
          Settings
        </button>
        <button className="flex items-center justify-between rounded-xl px-3 py-2.5 text-[15px] font-medium text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-900">
          <span className="flex items-center gap-3">
            <LifeBuoy size={20} strokeWidth={2} className="text-zinc-400" />
            Help and Support
          </span>
          <span className="grid h-5 min-w-5 place-items-center rounded-full bg-emerald-100 px-1 text-xs font-bold text-emerald-700">
            8
          </span>
        </button>
      </div>
      */}
    </aside>
  );
}
