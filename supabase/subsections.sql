-- Subbagian dalam section course — cuma buat ngelompokin materi jadi
-- sub-judul di halaman materi. Jalankan di SQL Editor Supabase SETELAH
-- schema.sql + admin.sql. Aman dijalankan ulang.

create table if not exists public.coaching_course_subsections (
  id         text primary key,
  section_id text not null references public.coaching_course_sections (id) on delete cascade,
  title      text not null default '',
  position   int  not null default 0
);
create index if not exists coaching_course_subsections_section_idx
  on public.coaching_course_subsections (section_id, position);

-- Materi bisa nunjuk ke satu subbagian (null = langsung di section).
alter table public.coaching_lessons
  add column if not exists subsection_id text
    references public.coaching_course_subsections (id) on delete set null;

-- ── Grants ─────────────────────────────────────────────────────────
grant select on public.coaching_course_subsections to anon, authenticated;
grant insert, update, delete on public.coaching_course_subsections to authenticated;
grant all on public.coaching_course_subsections to service_role;

-- ── RLS ────────────────────────────────────────────────────────────
alter table public.coaching_course_subsections enable row level security;

drop policy if exists "coaching_course_subsections read" on public.coaching_course_subsections;
create policy "coaching_course_subsections read"
  on public.coaching_course_subsections for select using (true);

drop policy if exists "coaching_course_subsections write admin" on public.coaching_course_subsections;
create policy "coaching_course_subsections write admin"
  on public.coaching_course_subsections for all
  using (public.is_admin()) with check (public.is_admin());
