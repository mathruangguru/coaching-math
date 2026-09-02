-- Presensi & Refleksi — item materi di dalam course.
-- Jalankan di SQL Editor Supabase SETELAH schema.sql + admin.sql. Aman diulang.

-- ── Tipe lesson baru ──────────────────────────────────────────────
-- 'slide' = preview Google Slides (link disimpan di kolom `url`, sama
-- kayak recording/meet).
alter table public.coaching_lessons drop constraint if exists coaching_lessons_type_check;
alter table public.coaching_lessons
  add constraint coaching_lessons_type_check
    check (type in ('materi', 'soal', 'meet', 'recording', 'slide', 'form',
                    'presensi', 'refleksi'));

-- Pertanyaan refleksi (dipakai lesson tipe 'refleksi').
alter table public.coaching_lessons add column if not exists prompt text;

-- ── Presensi ──────────────────────────────────────────────────────
-- Ronde presensi. Satu lesson presensi bisa punya beberapa ronde
-- (mis. Awal / Tengah / Akhir). Admin buka/tutup window-nya.
create table if not exists public.coaching_attendance_rounds (
  id         text primary key,
  lesson_id  text not null references public.coaching_lessons (id) on delete cascade,
  label      text not null default 'Presensi',
  is_open    boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists coaching_attendance_rounds_lesson_idx
  on public.coaching_attendance_rounds (lesson_id, created_at);

grant select on public.coaching_attendance_rounds to anon, authenticated;
grant insert, update, delete on public.coaching_attendance_rounds to authenticated;
grant all on public.coaching_attendance_rounds to service_role;

alter table public.coaching_attendance_rounds enable row level security;
drop policy if exists "coaching_attendance_rounds read" on public.coaching_attendance_rounds;
create policy "coaching_attendance_rounds read"
  on public.coaching_attendance_rounds for select using (true);
drop policy if exists "coaching_attendance_rounds write admin" on public.coaching_attendance_rounds;
create policy "coaching_attendance_rounds write admin"
  on public.coaching_attendance_rounds for all
  using (public.is_admin()) with check (public.is_admin());

-- Presensi murid, per ronde. (Fitur baru — struktur lama di-drop; belum
-- dipakai produksi.)
drop table if exists public.coaching_attendance cascade;
create table public.coaching_attendance (
  id            uuid primary key default gen_random_uuid(),
  round_id      text not null references public.coaching_attendance_rounds (id) on delete cascade,
  user_id       uuid not null references auth.users (id) on delete cascade,
  checked_in_at timestamptz not null default now(),
  unique (round_id, user_id)
);
create index if not exists coaching_attendance_round_idx
  on public.coaching_attendance (round_id, checked_in_at);

grant select, insert on public.coaching_attendance to authenticated;
grant all on public.coaching_attendance to service_role;

alter table public.coaching_attendance enable row level security;

drop policy if exists "coaching_attendance read" on public.coaching_attendance;
create policy "coaching_attendance read"
  on public.coaching_attendance for select
  using (auth.uid() = user_id or public.is_admin());

-- Murid cuma bisa check-in ke ronde yang lagi dibuka.
drop policy if exists "coaching_attendance insert own" on public.coaching_attendance;
create policy "coaching_attendance insert own"
  on public.coaching_attendance for insert
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.coaching_attendance_rounds r
      where r.id = round_id and r.is_open
    )
  );

-- Realtime: murid ngikutin buka/tutup ronde; admin ngikutin check-in masuk.
do $$
begin
  alter publication supabase_realtime add table public.coaching_attendance_rounds;
exception when duplicate_object then null;
end $$;
do $$
begin
  alter publication supabase_realtime add table public.coaching_attendance;
exception when duplicate_object then null;
end $$;

-- ── Refleksi ──────────────────────────────────────────────────────
-- Lesson tipe 'refleksi' nunjuk ke sebuah Form in-app lewat
-- coaching_lessons.form_id (kolom `form_id` udah ada dari forms.sql).
-- Ngerjain & rekapnya lewat sistem Form — nggak ada tabel khusus.
-- (Tabel coaching_reflections dari versi lama nggak dipakai lagi;
--  drop kalau mau bersih:  drop table if exists public.coaching_reflections;)
