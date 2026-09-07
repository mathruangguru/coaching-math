-- Pengumuman course + jadwal per pertemuan (dipakai di lobby course).
-- Jalankan di SQL Editor Supabase. Aman diulang.

-- Pengumuman dari pengajar, tampil di lobby course.
alter table public.coaching_courses
  add column if not exists announcement text;

-- Waktu pertemuan per section — buat "pertemuan berikutnya" di lobby.
alter table public.coaching_course_sections
  add column if not exists meet_at timestamptz;

-- Kondisi awal akordion pertemuan pas murid buka daftar materi. true =
-- kebuka, false = ketutup (murid tetap bisa toggle sendiri). Admin set
-- ini biar murid fokus ke pertemuan yang lagi relevan.
alter table public.coaching_course_sections
  add column if not exists default_open boolean not null default true;
