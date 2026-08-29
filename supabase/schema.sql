-- Skema Supabase (Postgres). Jalankan di dashboard: SQL Editor -> New query -> paste -> Run.
-- Aman dijalankan ulang.

-- ── Tables ─────────────────────────────────────────────────────────────

create table if not exists public.coaching_courses (
  id          text primary key,
  title       text not null,
  description text,
  icon        text not null default 'sigma',
  created_at  timestamptz not null default now()
);

create table if not exists public.coaching_course_sections (
  id        text primary key,
  course_id text not null references public.coaching_courses (id) on delete cascade,
  title     text not null,
  position  int  not null default 0
);
create index if not exists coaching_course_sections_course_idx
  on public.coaching_course_sections (course_id, position);

create table if not exists public.coaching_lessons (
  id         text primary key,
  section_id text not null references public.coaching_course_sections (id) on delete cascade,
  type       text not null default 'materi'
             check (type in ('materi', 'soal', 'meet', 'recording', 'form')),
  title      text not null,
  duration   text,
  url        text,
  publish_status text not null default 'all'
             check (publish_status in ('none', 'admin', 'all')),
  position   int  not null default 0
);
create index if not exists coaching_lessons_section_idx
  on public.coaching_lessons (section_id, position);

-- Kolom url ditambahkan belakangan (link meet / recording) — aman diulang.
alter table public.coaching_lessons add column if not exists url text;

-- Status publikasi per materi (ditambahkan belakangan). Aman diulang.
--   none  = draft, cuma kelihatan di editor kurikulum (admin)
--   admin = tampil di halaman course hanya buat admin (preview sebelum rilis)
--   all   = tampil buat semua murid yang enroll
-- Gate baca-nya ada di admin.sql (policy "coaching_lessons read").
alter table public.coaching_lessons
  add column if not exists publish_status text not null default 'all';
alter table public.coaching_lessons drop constraint if exists coaching_lessons_publish_status_check;
alter table public.coaching_lessons
  add constraint coaching_lessons_publish_status_check
    check (publish_status in ('none', 'admin', 'all'));

-- Migrasi tipe lesson lama -> baru. Aman dijalankan ulang (idempotent):
-- kalau tabel sudah terisi tipe lama, jalankan blok ini di project yang ada.
alter table public.coaching_lessons drop constraint if exists coaching_lessons_type_check;
update public.coaching_lessons set type = case type
  when 'video'    then 'recording'
  when 'reading'  then 'materi'
  when 'exercise' then 'soal'
  when 'quiz'     then 'soal'
  else type
end;
alter table public.coaching_lessons
  alter column type set default 'materi',
  add constraint coaching_lessons_type_check
    check (type in ('materi', 'soal', 'meet', 'recording', 'form'));

-- Progress per user. Dipakai nanti setelah ada Auth/login.
create table if not exists public.coaching_lesson_progress (
  user_id   uuid not null references auth.users (id) on delete cascade,
  lesson_id text not null references public.coaching_lessons (id) on delete cascade,
  done_at   timestamptz,
  primary key (user_id, lesson_id)
);

-- ── Grants ─────────────────────────────────────────────────────────────
-- RLS policy != privilege. Postgres butuh dua-duanya: role harus punya
-- GRANT ke tabel DAN lolos policy. Tanpa blok ini, request anon balik
-- 401 "permission denied for table ...".

grant usage on schema public to anon, authenticated;

grant select on public.coaching_courses         to anon, authenticated;
grant select on public.coaching_course_sections to anon, authenticated;
grant select on public.coaching_lessons         to anon, authenticated;

-- Progress: cuma user login yang nulis/baca (dibatasi policy ke miliknya).
grant select, insert, update on public.coaching_lesson_progress to authenticated;

-- ── Row Level Security ─────────────────────────────────────────────────

alter table public.coaching_courses          enable row level security;
alter table public.coaching_course_sections  enable row level security;
alter table public.coaching_lessons          enable row level security;
alter table public.coaching_lesson_progress  enable row level security;

-- Katalog course: boleh dibaca siapa saja (anon maupun user login).
drop policy if exists "coaching_courses read" on public.coaching_courses;
create policy "coaching_courses read"
  on public.coaching_courses for select using (true);

drop policy if exists "coaching_course_sections read" on public.coaching_course_sections;
create policy "coaching_course_sections read"
  on public.coaching_course_sections for select using (true);

-- Baca lesson: permissif di sini; admin.sql menimpanya jadi
-- "publish_status = 'all' OR is_admin()" setelah is_admin() ada.
drop policy if exists "coaching_lessons read" on public.coaching_lessons;
create policy "coaching_lessons read"
  on public.coaching_lessons for select using (true);

-- Progress: tiap user hanya boleh baca & ubah miliknya sendiri.
drop policy if exists "coaching_lesson_progress select own" on public.coaching_lesson_progress;
create policy "coaching_lesson_progress select own"
  on public.coaching_lesson_progress for select using (auth.uid() = user_id);

drop policy if exists "coaching_lesson_progress insert own" on public.coaching_lesson_progress;
create policy "coaching_lesson_progress insert own"
  on public.coaching_lesson_progress for insert with check (auth.uid() = user_id);

drop policy if exists "coaching_lesson_progress update own" on public.coaching_lesson_progress;
create policy "coaching_lesson_progress update own"
  on public.coaching_lesson_progress for update using (auth.uid() = user_id);
