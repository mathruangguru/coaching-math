-- Pengumuman course + jadwal per pertemuan (dipakai di lobby course).
-- Jalankan di SQL Editor Supabase. Aman diulang.

-- Pengumuman dari pengajar, tampil di lobby course.
alter table public.coaching_courses
  add column if not exists announcement text;

-- Waktu pertemuan per section — buat "pertemuan berikutnya" di lobby.
alter table public.coaching_course_sections
  add column if not exists meet_at timestamptz;
