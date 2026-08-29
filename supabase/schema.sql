-- Skema Supabase (Postgres). Jalankan di dashboard: SQL Editor -> New query -> paste -> Run.
-- Aman dijalankan ulang.

-- ── Tables ─────────────────────────────────────────────────────────────

create table if not exists public.courses (
  id          text primary key,
  title       text not null,
  description text,
  icon        text not null default 'sigma',
  created_at  timestamptz not null default now()
);

create table if not exists public.course_sections (
  id        text primary key,
  course_id text not null references public.courses (id) on delete cascade,
  title     text not null,
  position  int  not null default 0
);
create index if not exists course_sections_course_idx
  on public.course_sections (course_id, position);

create table if not exists public.lessons (
  id         text primary key,
  section_id text not null references public.course_sections (id) on delete cascade,
  type       text not null default 'video'
             check (type in ('video', 'reading', 'exercise', 'quiz')),
  title      text not null,
  duration   text,
  position   int  not null default 0
);
create index if not exists lessons_section_idx
  on public.lessons (section_id, position);

-- Progress per user. Dipakai nanti setelah ada Auth/login.
create table if not exists public.lesson_progress (
  user_id   uuid not null references auth.users (id) on delete cascade,
  lesson_id text not null references public.lessons (id) on delete cascade,
  done_at   timestamptz,
  primary key (user_id, lesson_id)
);

-- ── Row Level Security ─────────────────────────────────────────────────

alter table public.courses         enable row level security;
alter table public.course_sections enable row level security;
alter table public.lessons         enable row level security;
alter table public.lesson_progress enable row level security;

-- Katalog course: boleh dibaca siapa saja (anon maupun user login).
drop policy if exists "courses readable by all" on public.courses;
create policy "courses readable by all"
  on public.courses for select using (true);

drop policy if exists "sections readable by all" on public.course_sections;
create policy "sections readable by all"
  on public.course_sections for select using (true);

drop policy if exists "lessons readable by all" on public.lessons;
create policy "lessons readable by all"
  on public.lessons for select using (true);

-- Progress: tiap user hanya boleh baca & ubah miliknya sendiri.
drop policy if exists "own progress select" on public.lesson_progress;
create policy "own progress select"
  on public.lesson_progress for select using (auth.uid() = user_id);

drop policy if exists "own progress insert" on public.lesson_progress;
create policy "own progress insert"
  on public.lesson_progress for insert with check (auth.uid() = user_id);

drop policy if exists "own progress update" on public.lesson_progress;
create policy "own progress update"
  on public.lesson_progress for update using (auth.uid() = user_id);
