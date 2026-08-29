import { Link, Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../../context/auth-context";
import BootSplash from "../layout/BootSplash";

export default function RequireAdmin() {
  const { session, isAdmin, loading } = useAuth();

  if (loading) return <BootSplash />;

  if (!session) return <Navigate to="/login" replace />;

  if (!isAdmin) {
    return (
      <div className="grid min-h-screen place-items-center bg-[#fafafa] px-6">
        <div className="max-w-sm text-center">
          <p className="text-sm font-semibold text-zinc-900">Akses ditolak</p>
          <p className="mt-1 text-xs text-zinc-500">
            Akun ini bukan admin. Minta pengelola menaikkan peranmu jadi admin.
          </p>
          <Link
            to="/"
            className="mt-3 inline-block text-xs font-semibold text-brand-600"
          >
            Kembali ke aplikasi
          </Link>
        </div>
      </div>
    );
  }

  return <Outlet />;
}
