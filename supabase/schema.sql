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
  type       text not null default 'video'
             check (type in ('video', 'reading', 'exercise', 'quiz')),
  title      text not null,
  duration   text,
  position   int  not null default 0
);
create index if not exists coaching_lessons_section_idx
  on public.coaching_lessons (section_id, position);

-- Progress per user. Dipakai nanti setelah ada Auth/login.
create table if not exists public.coaching_lesson_progress (
  user_id   uuid not null references auth.users (id) on delete cascade,
  lesson_id text not null references public.coaching_lessons (id) on delete cascade,
  done_at   timestamptz,
  primary key (user_id, lesson_id)
);

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
