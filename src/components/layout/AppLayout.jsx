import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";
// Di-hide sementara — uncomment untuk memunculkan lagi:
// import Topbar from "./Topbar";

export default function AppLayout() {
  return (
    <div className="h-screen bg-[#f4f4f5] p-6">
      <div className="mx-auto flex h-full max-w-[1400px] overflow-hidden rounded-3xl border border-zinc-200/70 bg-white shadow-sm">
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          {/* <Topbar /> */}
          <main className="scroll-slim flex-1 overflow-y-auto bg-[#fafafa] px-8 py-8">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
}
