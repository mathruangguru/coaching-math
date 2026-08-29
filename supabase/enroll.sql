-- Enrollment murid ke course. Jalankan di SQL Editor Supabase
-- SETELAH schema.sql + admin.sql. Aman dijalankan ulang.

create table if not exists public.coaching_enrollments (
  user_id    uuid not null references auth.users (id) on delete cascade,
  course_id  text not null references public.coaching_courses (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, course_id)
);

grant select, insert, delete on public.coaching_enrollments to authenticated;

alter table public.coaching_enrollments enable row level security;

-- Tiap murid enroll / lihat / batalin miliknya sendiri.
drop policy if exists "coaching_enrollments own" on public.coaching_enrollments;
create policy "coaching_enrollments own"
  on public.coaching_enrollments for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Admin boleh lihat semua (buat rekap nanti).
drop policy if exists "coaching_enrollments admin read" on public.coaching_enrollments;
create policy "coaching_enrollments admin read"
  on public.coaching_enrollments for select
  using (public.is_admin());
