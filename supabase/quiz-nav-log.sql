-- Log "buka nomor soal" pas murid ngerjain kuis (muncul di admin: Hasil Soal
-- -> ikon jam -> Riwayat pengerjaan). Jalankan di SQL Editor Supabase SETELAH
-- quiz.sql + admin.sql. Aman dijalankan ulang.
--
-- Tiap murid membuka sebuah soal — soal pertama pas mulai/lanjut sesi, lalu
-- tiap pindah nomor (tombol Sebelumnya/Berikutnya atau klik nomor) — QuizPage
-- nyimpen SATU baris. created_at = jam server, sejajar dengan timestamp audit
-- autosave & catatan pindah tab. Yang disimpan question_id (bukan nomor), jadi
-- nomor dibaca dari urutan soal saat riwayat dibuka.
--
-- Dilaporkan browser murid, jadi bukan bukti kuat (bisa dimanipulasi).
-- Nggak pakai FK ke users/set/soal biar riwayat tetap ada walau dihapus
-- (sama kayak coaching_quiz_progress_audit).

create table if not exists public.coaching_quiz_nav_log (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid(),
  set_id      text not null,
  question_id text not null,
  created_at  timestamptz not null default now()
);

create index if not exists coaching_quiz_nav_log_user_set_idx
  on public.coaching_quiz_nav_log (user_id, set_id, created_at desc);

grant select, insert on public.coaching_quiz_nav_log to authenticated;
grant all on public.coaching_quiz_nav_log to service_role;

alter table public.coaching_quiz_nav_log enable row level security;

-- Murid cuma boleh nulis catatan buat dirinya sendiri (append-only).
drop policy if exists "coaching_quiz_nav_log insert own" on public.coaching_quiz_nav_log;
create policy "coaching_quiz_nav_log insert own"
  on public.coaching_quiz_nav_log for insert
  with check (auth.uid() = user_id);

drop policy if exists "coaching_quiz_nav_log admin read" on public.coaching_quiz_nav_log;
create policy "coaching_quiz_nav_log admin read"
  on public.coaching_quiz_nav_log for select
  using (public.is_admin());
