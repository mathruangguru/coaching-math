-- Presensi & Refleksi — item materi di dalam course.
-- Jalankan di SQL Editor Supabase SETELAH schema.sql + admin.sql. Aman diulang.

-- ── Tipe lesson baru ──────────────────────────────────────────────
alter table public.coaching_lessons drop constraint if exists coaching_lessons_type_check;
alter table public.coaching_lessons
  add constraint coaching_lessons_type_check
    check (type in ('materi', 'soal', 'meet', 'recording', 'form',
                    'presensi', 'refleksi'));

-- Pertanyaan refleksi (dipakai lesson tipe 'refleksi').
alter table public.coaching_lessons add column if not exists prompt text;

-- ── Presensi ──────────────────────────────────────────────────────
create table if not exists public.coaching_attendance (
  lesson_id     text not null references public.coaching_lessons (id) on delete cascade,
  user_id       uuid not null references auth.users (id) on delete cascade,
  checked_in_at timestamptz not null default now(),
  primary key (lesson_id, user_id)
);
create index if not exists coaching_attendance_lesson_idx
  on public.coaching_attendance (lesson_id, checked_in_at);

grant select, insert on public.coaching_attendance to authenticated;
grant all on public.coaching_attendance to service_role;

alter table public.coaching_attendance enable row level security;

drop policy if exists "coaching_attendance read" on public.coaching_attendance;
create policy "coaching_attendance read"
  on public.coaching_attendance for select
  using (auth.uid() = user_id or public.is_admin());

drop policy if exists "coaching_attendance insert own" on public.coaching_attendance;
create policy "coaching_attendance insert own"
  on public.coaching_attendance for insert
  with check (auth.uid() = user_id);

-- ── Refleksi ──────────────────────────────────────────────────────
create table if not exists public.coaching_reflections (
  lesson_id  text not null references public.coaching_lessons (id) on delete cascade,
  user_id    uuid not null references auth.users (id) on delete cascade,
  body       text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (lesson_id, user_id)
);
create index if not exists coaching_reflections_lesson_idx
  on public.coaching_reflections (lesson_id, updated_at desc);

grant select, insert, update on public.coaching_reflections to authenticated;
grant all on public.coaching_reflections to service_role;

alter table public.coaching_reflections enable row level security;

drop policy if exists "coaching_reflections own" on public.coaching_reflections;
create policy "coaching_reflections own"
  on public.coaching_reflections for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "coaching_reflections admin read" on public.coaching_reflections;
create policy "coaching_reflections admin read"
  on public.coaching_reflections for select
  using (public.is_admin());
