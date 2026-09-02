-- Materi tipe 'materi': isi konten Markdown (ditampilin di halaman baca).
-- Jalankan di SQL Editor Supabase. Aman diulang.

alter table public.coaching_lessons add column if not exists content text;
