-- Auth, role, dan write-access admin. Jalankan di SQL Editor Supabase
-- SETELAH schema.sql. Aman dijalankan ulang.

-- ── Profiles: 1 baris per auth user ──────────────────────────────────

create table if not exists public.coaching_profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  email      text,
  first_name text,
  last_name  text,
  role       text not null default 'student'
             check (role in ('student', 'admin')),
  created_at timestamptz not null default now()
);

-- Kolom nama ditambahkan belakangan — aman di-run ulang.
alter table public.coaching_profiles
  add column if not exists first_name text,
  add column if not exists last_name  text;

alter table public.coaching_profiles enable row level security;

grant select, update on public.coaching_profiles to authenticated;

-- ── Helper: apakah caller seorang admin ─────────────────────────────
-- Didefinisikan sebelum policy yang memakainya. SECURITY DEFINER -> query
-- di dalamnya bypass RLS, jadi aman dipakai di policy coaching_profiles
-- sendiri (nggak rekursif).

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

-- ── RLS coaching_profiles ──────────────────────────────────────────
-- Tiap user boleh baca profil sendiri...
drop policy if exists "coaching_profiles select own" on public.coaching_profiles;
create policy "coaching_profiles select own"
  on public.coaching_profiles for select
  using (auth.uid() = id);

-- ...dan ubah nama sendiri (halaman /profile). Perubahan role dijaga trigger
-- di bawah, jadi user biasa nggak bisa naikin dirinya jadi admin.
drop policy if exists "coaching_profiles update own" on public.coaching_profiles;
create policy "coaching_profiles update own"
  on public.coaching_profiles for update
  using (auth.uid() = id) with check (auth.uid() = id);

-- Admin boleh baca & ubah semua profile (halaman /admin/users).
drop policy if exists "coaching_profiles select admin" on public.coaching_profiles;
create policy "coaching_profiles select admin"
  on public.coaching_profiles for select
  using (public.is_admin());

drop policy if exists "coaching_profiles update admin" on public.coaching_profiles;
create policy "coaching_profiles update admin"
  on public.coaching_profiles for update
  using (public.is_admin()) with check (public.is_admin());

-- Cegah non-admin mengubah kolom role miliknya sendiri.
create or replace function public.guard_profile_role()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.role is distinct from old.role and not public.is_admin() then
    new.role := old.role;
  end if;
  return new;
end;
$$;

drop trigger if exists coaching_profiles_guard_role on public.coaching_profiles;
create trigger coaching_profiles_guard_role
  before update on public.coaching_profiles
  for each row execute function public.guard_profile_role();

-- ── Auto-buat profile saat user baru daftar ─────────────────────────

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.coaching_profiles (id, email, first_name, last_name)
  values (
    new.id,
    new.email,
    nullif(new.raw_user_meta_data ->> 'first_name', ''),
    nullif(new.raw_user_meta_data ->> 'last_name', '')
  )
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

-- ── Bikin admin pertama ────────────────────────────────────────────
-- 1) Bikin user di dashboard: Authentication -> Users -> Add user
--    (centang "Auto Confirm User" biar bisa langsung login).
-- 2) Uncomment baris ini, ganti email-nya, lalu Run:
--
-- update public.coaching_profiles set role = 'admin'
--   where email = 'kamu@contoh.com';
--
-- Setelah punya 1 admin, user berikutnya dibuat dari halaman /admin/users
-- (lewat Edge Function admin-users). Syarat di Supabase:
--   Authentication -> Providers -> Email -> "Confirm email" OFF.
--   "Allow new users to sign up" boleh OFF.
