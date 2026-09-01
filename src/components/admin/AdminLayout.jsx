import { useState } from "react";
import {
  Link,
  NavLink,
  Outlet,
  useLocation,
  useNavigate,
} from "react-router-dom";
import {
  ArrowLeft,
  LogOut,
  Menu,
  X,
  BookOpen,
  ListChecks,
  ClipboardList,
  BarChart3,
  Users,
  Building2,
  GraduationCap,
  Wrench,
} from "lucide-react";
import { useAuth } from "../../context/auth-context";
import { signOut } from "../../lib/auth";

const nav = [
  { to: "/admin", label: "Course", icon: BookOpen, end: true },
  { to: "/admin/set-soal", label: "Set Soal", icon: ListChecks },
  { to: "/admin/forms", label: "Form", icon: ClipboardList },
  { to: "/admin/quiz-results", label: "Hasil Soal", icon: BarChart3 },
  { to: "/admin/users", label: "Pengguna", icon: Users },
  { to: "/admin/branches", label: "Cabang", icon: Building2 },
  { to: "/admin/enrollments", label: "Enrollment", icon: GraduationCap },
  { to: "/admin/utilitas", label: "Utilitas", icon: Wrench },
];

function navItemClass({ isActive }) {
  return [
    "flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors",
    isActive
      ? "bg-brand-500 text-white shadow-sm shadow-brand-500/30"
      : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900",
  ].join(" ");
}

export default function AdminLayout() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [navOpen, setNavOpen] = useState(false);

  // Tutup drawer tiap pindah halaman.
  const [prevPath, setPrevPath] = useState(location.pathname);
  if (prevPath !== location.pathname) {
    setPrevPath(location.pathname);
    if (navOpen) setNavOpen(false);
  }

  const handleSignOut = async () => {
    try {
      await signOut();
    } finally {
      navigate("/login", { replace: true });
    }
  };

  return (
    <div className="flex h-screen flex-col bg-[#f4f4f5] lg:flex-row lg:p-6">
      {/* Top bar — mobile only */}
      <div className="flex shrink-0 items-center gap-3 border-b border-zinc-200 bg-white px-4 py-3 lg:hidden">
        <button
          onClick={() => setNavOpen(true)}
          aria-label="Buka menu"
          className="grid h-9 w-9 place-items-center rounded-lg text-zinc-600 transition-colors hover:bg-zinc-100"
        >
          <Menu size={20} />
        </button>
        <span className="text-sm font-bold tracking-tight text-zinc-900">
          Admin
        </span>
      </div>

      <div className="relative mx-auto flex min-h-0 w-full max-w-[1400px] flex-1 overflow-hidden bg-white lg:h-full lg:rounded-3xl lg:border lg:border-zinc-200/70 lg:shadow-sm">
        {navOpen && (
          <button
            aria-label="Tutup menu"
            onClick={() => setNavOpen(false)}
            className="fixed inset-0 z-40 bg-black/30 lg:hidden"
          />
        )}

        <aside
          className={`fixed inset-y-0 left-0 z-50 flex w-[264px] shrink-0 flex-col border-r border-zinc-200/70 bg-white px-5 py-6 transition-transform duration-200 lg:static lg:z-auto lg:translate-x-0 ${
            navOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <button
            onClick={() => setNavOpen(false)}
            aria-label="Tutup menu"
            className="absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-lg text-zinc-400 transition-colors hover:bg-zinc-100 lg:hidden"
          >
            <X size={18} />
          </button>

          <div className="px-1">
            <p className="text-base font-extrabold uppercase tracking-wide text-zinc-900">
              Admin
            </p>
            <p className="mt-0.5 text-xs text-zinc-400">Coaching Matematika</p>
          </div>

          <Link
            to="/"
            className="mt-5 inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-medium text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-800"
          >
            <ArrowLeft size={14} /> Ke aplikasi
          </Link>

          <nav className="mt-4 flex flex-col gap-1">
            {nav.map(({ to, label, icon: Icon, end }) => (
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

          <div className="mt-auto flex flex-col gap-2 border-t border-zinc-200/70 pt-4">
            {profile?.email && (
              <p
                className="truncate px-3 text-xs text-zinc-400"
                title={profile.email}
              >
                {profile.email}
              </p>
            )}
            <button
              onClick={handleSignOut}
              className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-900"
            >
              <LogOut size={18} strokeWidth={2} className="text-zinc-400" />
              Keluar
            </button>
          </div>
        </aside>

        <main className="scroll-slim min-w-0 flex-1 overflow-y-auto bg-[#fafafa] px-4 py-5 sm:px-6 lg:px-8 lg:py-8">
          <div className="mx-auto max-w-[900px]">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
