const sizes = {
  sm: "h-6 w-6 text-[10px]",
  md: "h-8 w-8 text-xs",
  lg: "h-9 w-9 text-sm",
};

// Avatar sederhana berbasis inisial (tanpa aset gambar).
export default function Avatar({
  initials,
  color = "bg-brand-500",
  size = "md",
  ring = false,
}) {
  return (
    <span
      className={`inline-grid shrink-0 place-items-center rounded-full font-semibold text-white ${color} ${
        sizes[size]
      } ${ring ? "ring-2 ring-white" : ""}`}
    >
      {initials}
    </span>
  );
}
