-- Auth, role, dan write-access admin. Jalankan di SQL Editor Supabase
-- SETELAH schema.sql. Aman dijalankan ulang.

-- ── Profiles: 1 baris per auth user ──────────────────────────────────

create table if not exists public.coaching_profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  email      text,
  role       text not null default 'student'
             check (role in ('student', 'admin')),
  created_at timestamptz not null default now()
);

alter table public.coaching_profiles enable row level security;

grant select on public.coaching_profiles to authenticated;

-- Tiap user cuma boleh baca profil sendiri.
-- Ganti role lewat SQL/dashboard (lihat baris paling bawah), bukan dari app.
drop policy if exists "coaching_profiles select own" on public.coaching_profiles;
create policy "coaching_profiles select own"
  on public.coaching_profiles for select
  using (auth.uid() = id);

-- ── Auto-buat profile saat user baru daftar ─────────────────────────

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.coaching_profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Backfill user yang terlanjur dibuat sebelum trigger ini ada.
insert into public.coaching_profiles (id, email)
select id, email from auth.users
on conflict (id) do nothing;

-- ── Helper: apakah caller seorang admin ─────────────────────────────

create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public, pg_temp
stable
as $$
  select exists (
    select 1 from public.coaching_profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

grant execute on function public.is_admin() to anon, authenticated;

-- ── Write access ke katalog: admin only ────────────────────────────
-- Policy select "read (true)" dari schema.sql tetap jalan buat publik.

grant insert, update, delete on public.coaching_courses         to authenticated;
grant insert, update, delete on public.coaching_course_sections to authenticated;
grant insert, update, delete on public.coaching_lessons         to authenticated;

drop policy if exists "coaching_courses write admin" on public.coaching_courses;
create policy "coaching_courses write admin"
  on public.coaching_courses for all
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists "coaching_course_sections write admin" on public.coaching_course_sections;
create policy "coaching_course_sections write admin"
  on public.coaching_course_sections for all
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists "coaching_lessons write admin" on public.coaching_lessons;
create policy "coaching_lessons write admin"
  on public.coaching_lessons for all
  using (public.is_admin()) with check (public.is_admin());

-- ── Jadikan diri sendiri admin ─────────────────────────────────────
-- 1) Bikin user di dashboard: Authentication -> Users -> Add user
--    (centang "Auto Confirm User" biar bisa langsung login).
-- 2) Uncomment baris ini, ganti email-nya, lalu Run:
--
-- update public.coaching_profiles set role = 'admin'
--   where email = 'kamu@contoh.com';
