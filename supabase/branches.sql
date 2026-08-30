-- Cabang (branch / kampus). Jalankan di SQL Editor Supabase SETELAH
-- schema.sql + admin.sql. Aman dijalankan ulang.

create table if not exists public.coaching_branches (
  id         text primary key,
  name       text not null,
  created_at timestamptz not null default now()
);
-- Nama cabang unik (case-insensitive) — bulk import ngelewatin yang dobel.
create unique index if not exists coaching_branches_name_uniq
  on public.coaching_branches (lower(name));

-- Tiap profil boleh nunjuk ke satu cabang.
alter table public.coaching_profiles
  add column if not exists branch_id text
    references public.coaching_branches (id) on delete set null;

-- ── Grants ─────────────────────────────────────────────────────────
grant select on public.coaching_branches to anon, authenticated;
grant insert, update, delete on public.coaching_branches to authenticated;
grant all on public.coaching_branches to service_role;

-- ── RLS ────────────────────────────────────────────────────────────
alter table public.coaching_branches enable row level security;

-- Semua yang login boleh baca (buat dropdown di /profile).
drop policy if exists "coaching_branches read" on public.coaching_branches;
create policy "coaching_branches read"
  on public.coaching_branches for select using (true);

-- Cuma admin yang boleh atur daftarnya.
drop policy if exists "coaching_branches write admin" on public.coaching_branches;
create policy "coaching_branches write admin"
  on public.coaching_branches for all
  using (public.is_admin()) with check (public.is_admin());

-- User milih cabang sendiri di /profile lewat policy
-- "coaching_profiles update own" yang udah ada (kolom role dijaga trigger,
-- branch_id bebas diubah user).
