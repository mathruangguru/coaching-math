import ruangguruLogo from "../../assets/ruangguru.png";

// Layar tunggu selagi sesi auth dicek — biar nggak kedip antar route.
export default function BootSplash() {
  return (
    <div className="grid min-h-screen place-items-center bg-[#f4f4f5]">
      <div className="flex flex-col items-center gap-3">
        <img src={ruangguruLogo} alt="Ruangguru" className="h-8 w-auto opacity-90" />
        <span className="text-xs text-zinc-400">Memuat…</span>
      </div>
    </div>
  );
}
