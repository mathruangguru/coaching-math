// Data dummy untuk tampilan dashboard.
// Nanti tinggal diganti dengan data asli dari API.

export const user = {
  name: "John",
  initials: "JD",
};

export const learningStats = [
  { id: "hours", icon: "clock", value: "18 jam", label: "Waktu Belajar" },
  { id: "done", icon: "check", value: "12", label: "Course Selesai" },
  { id: "active", icon: "progress", value: "3", label: "Sedang Berjalan" },
];

export const myCourses = [
  {
    id: "patom-mtk-2627-1",
    title: "PATOM Matematika 26/27 - 1",
    icon: "sigma",
    description: "Pathway to Mastery Matematika 2026/2027 Term 1",
    // Field di bawah belum dipakai tabel (kolom Instruktur & Status lagi diparkir).
    modules: 0,
    quizzes: 0,
    instructor: { name: "—", initials: "—", color: "bg-zinc-400" },
    status: "not-started",
  },
];

export const statusMeta = {
  "in-progress": { label: "In Progress", className: "bg-emerald-100 text-emerald-700" },
  "not-started": { label: "Not Started", className: "bg-zinc-100 text-zinc-500" },
  completed: { label: "Completed", className: "bg-blue-100 text-blue-700" },
};

// Isi course, dikelompokkan per pertemuan.
// `title` bebas diisi (bukan auto "Sesi 1") biar bisa dinamai sendiri.
// type item: "materi" | "soal" | "meet" | "recording"
export const courseSections = {
  "patom-mtk-2627-1": [
    {
      id: "p1",
      title: "Pertemuan 1 — Bilangan & Operasi Dasar",
      items: [
        { id: "p1-1", type: "recording", title: "Sistem bilangan real & garis bilangan", duration: "12 mnt", url: "https://www.youtube.com/watch?v=aqz-KE-bpKQ" },
        { id: "p1-2", type: "materi", title: "Rangkuman: sifat operasi & urutan pengerjaan", duration: "5 mnt baca" },
        { id: "p1-3", type: "soal", title: "Latihan: operasi campuran, KPK & FPB", duration: "10 soal" },
        { id: "p1-4", type: "soal", title: "Kuis Pertemuan 1", duration: "8 soal" },
      ],
    },
    {
      id: "p2",
      title: "Pertemuan 2 — Aljabar: Bentuk & Persamaan Linear",
      items: [
        { id: "p2-1", type: "recording", title: "Bentuk aljabar: suku, variabel, dan koefisien", duration: "15 mnt", url: "https://www.youtube.com/watch?v=aqz-KE-bpKQ" },
        { id: "p2-2", type: "recording", title: "Menyelesaikan persamaan linear satu variabel", duration: "18 mnt", url: "https://www.youtube.com/watch?v=aqz-KE-bpKQ" },
        { id: "p2-3", type: "materi", title: "Contoh soal cerita persamaan linear", duration: "6 mnt baca" },
        { id: "p2-4", type: "soal", title: "Latihan: persamaan & pertidaksamaan linear", duration: "12 soal" },
        { id: "p2-5", type: "soal", title: "Kuis Pertemuan 2", duration: "10 soal" },
      ],
    },
    {
      id: "p3",
      title: "Pertemuan 3 — Perbandingan & Aritmetika Sosial",
      items: [
        { id: "p3-1", type: "recording", title: "Perbandingan senilai & berbalik nilai", duration: "14 mnt", url: "https://www.youtube.com/watch?v=aqz-KE-bpKQ" },
        { id: "p3-2", type: "materi", title: "Untung, rugi, diskon, bruto–neto–tara", duration: "7 mnt baca" },
        { id: "p3-3", type: "soal", title: "Latihan: skala, perbandingan & aritmetika sosial", duration: "10 soal" },
        { id: "p3-4", type: "soal", title: "Kuis Pertemuan 3", duration: "10 soal" },
      ],
    },
  ],
};

export const scheduleEvents = [
  {
    id: "e1",
    title: "Live Class: Persamaan Kuadrat",
    time: "13.00 - 14.30",
    accent: "bg-emerald-400",
    icon: "video",
    people: [
      { initials: "SW", color: "bg-rose-500" },
      { initials: "JD", color: "bg-brand-500" },
    ],
  },
  {
    id: "e2",
    title: "Bimbingan: Pembahasan Soal Ujian",
    time: "16.00 - 17.00",
    accent: "bg-blue-400",
    icon: "users",
    people: [
      { initials: "AP", color: "bg-amber-500" },
      { initials: "RK", color: "bg-violet-500" },
    ],
  },
  {
    id: "e3",
    title: "Grup Diskusi: Trigonometri",
    time: "19.00 - 20.00",
    accent: "bg-fuchsia-400",
    icon: "message",
    people: [
      { initials: "DP", color: "bg-teal-500" },
      { initials: "MF", color: "bg-indigo-500" },
    ],
  },
];

export const notes = [
  {
    id: "n1",
    title: "Review rumus turunan sebelum kuis",
    body: "Fokus ke aturan rantai dan turunan fungsi trigonometri. Catat contoh soal yang masih sering salah.",
    done: false,
  },
  {
    id: "n2",
    title: "Kerjakan latihan soal Bab 3",
    body: "Minimal 10 nomor. Tandai soal yang butuh dibahas bareng tutor di sesi bimbingan.",
    done: false,
  },
  {
    id: "n3",
    title: "Kumpulkan tugas Statistika",
    body: "Sudah diupload ke halaman course. Tinggal cek nilai dan feedback dari pengajar.",
    done: true,
  },
];
