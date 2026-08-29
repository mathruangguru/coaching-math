import MyCourses from "../components/dashboard/MyCourses";
import { greeting, longDate } from "../lib/date";
import { useAuth } from "../context/auth-context";

// Parkir sementara — komponennya masih ada di repo, tinggal import + pasang lagi:
//   <Topbar />        -> src/components/layout/AppLayout.jsx
//   <StatsBar />      -> src/components/dashboard/StatsBar.jsx
//   <SchedulePanel /> -> src/components/dashboard/SchedulePanel.jsx
//   <NotesPanel />    -> src/components/dashboard/NotesPanel.jsx
// import { Share2, Plus } from "lucide-react";

export default function DashboardPage() {
  const { profile } = useAuth();
  const firstName = profile?.first_name?.trim();

  return (
    <div className="mx-auto flex max-w-[1180px] flex-col gap-6">
      {/* Greeting */}
      <div>
        <p className="text-xs text-zinc-500">{longDate()}</p>
        <h1 className="mt-1 text-xl font-bold tracking-tight text-zinc-900">
          {greeting()}
          {firstName ? `, ${firstName}` : ""}! 👋
        </h1>
      </div>

      {/* Parkir: tombol aksi header
      <div className="flex items-center gap-2.5">
        <button className="flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50">
          <Share2 size={16} /> Bagikan
        </button>
        <button className="flex items-center gap-2 rounded-xl bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-zinc-800">
          <Plus size={16} strokeWidth={2.6} /> Tambah Catatan
        </button>
      </div>
      */}

      <MyCourses />
    </div>
  );
}
