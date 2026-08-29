import { Link, Outlet, useNavigate } from "react-router-dom";
import { ArrowLeft, LogOut } from "lucide-react";
import { useAuth } from "../../context/auth-context";
import { signOut } from "../../lib/auth";

export default function AdminLayout() {
  const { profile } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    try {
      await signOut();
    } finally {
      navigate("/admin/login", { replace: true });
    }
  };

  return (
    <div className="min-h-screen bg-[#fafafa]">
      <header className="flex items-center justify-between border-b border-zinc-200 bg-white px-6 py-3">
        <div className="flex items-center gap-3">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-500 transition-colors hover:text-zinc-800"
          >
            <ArrowLeft size={14} /> Ke aplikasi
          </Link>
          <span className="h-4 w-px bg-zinc-200" />
          <span className="text-sm font-bold tracking-tight text-zinc-900">
            Admin
          </span>
        </div>

        <div className="flex items-center gap-3">
          {profile?.email && (
            <span className="hidden text-xs text-zinc-400 sm:inline">
              {profile.email}
            </span>
          )}
          <button
            onClick={handleSignOut}
            className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 px-2.5 py-1.5 text-xs font-medium text-zinc-600 transition-colors hover:bg-zinc-50"
          >
            <LogOut size={13} /> Keluar
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-[900px] px-6 py-8">
        <Outlet />
      </main>
    </div>
  );
}
