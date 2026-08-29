import { useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { Menu } from "lucide-react";
import Sidebar from "./Sidebar";
// Di-hide sementara — uncomment untuk memunculkan lagi:
// import Topbar from "./Topbar";

export default function AppLayout() {
  const [navOpen, setNavOpen] = useState(false);
  const location = useLocation();

  // Tutup drawer tiap pindah halaman (termasuk tombol back).
  // Pola "adjust state saat prop berubah" — set state saat render.
  const [prevPath, setPrevPath] = useState(location.pathname);
  if (prevPath !== location.pathname) {
    setPrevPath(location.pathname);
    if (navOpen) setNavOpen(false);
  }

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
        <span className="text-sm font-extrabold uppercase tracking-wide text-zinc-900">
          Coaching Matematika
        </span>
      </div>

      <div className="relative mx-auto flex min-h-0 w-full max-w-[1400px] flex-1 overflow-hidden bg-white lg:h-full lg:rounded-3xl lg:border lg:border-zinc-200/70 lg:shadow-sm">
        {/* Backdrop drawer — mobile only */}
        {navOpen && (
          <button
            aria-label="Tutup menu"
            onClick={() => setNavOpen(false)}
            className="fixed inset-0 z-40 bg-black/30 lg:hidden"
          />
        )}

        <Sidebar open={navOpen} onClose={() => setNavOpen(false)} />

        <div className="flex min-w-0 flex-1 flex-col">
          {/* <Topbar /> */}
          <main className="scroll-slim flex-1 overflow-y-auto bg-[#fafafa] px-4 py-5 sm:px-6 lg:px-8 lg:py-8">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
}
