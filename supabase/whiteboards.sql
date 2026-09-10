-- Whiteboard virtual (alat bantu admin di menu Utilitas). Board disimpan
-- sebagai daftar coretan (vektor) di kolom jsonb. `shared = true` -> murid
-- yang login boleh baca (read-only) buat tampilan murid nanti.
-- Jalankan di SQL Editor Supabase SETELAH admin.sql. Aman dijalankan ulang.

create table if not exists public.coaching_whiteboards (
  id         uuid primary key default gen_random_uuid(),
  title      text not null default 'Papan baru',
  -- { bg: 'blank' | 'grid', strokes: [{ mode, color, width, points: [[x,y],...] }] }
  data       jsonb not null default '{"bg":"blank","strokes":[]}'::jsonb,
  shared     boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists coaching_whiteboards_updated_idx
  on public.coaching_whiteboards (updated_at desc);

-- ── Grants ─────────────────────────────────────────────────────────
grant select on public.coaching_whiteboards to anon, authenticated;
grant insert, update, delete on public.coaching_whiteboards to authenticated;
grant all on public.coaching_whiteboards to service_role;

-- ── RLS ────────────────────────────────────────────────────────────
alter table public.coaching_whiteboards enable row level security;

-- Admin: baca & tulis semua.
drop policy if exists "coaching_whiteboards admin" on public.coaching_whiteboards;
create policy "coaching_whiteboards admin"
  on public.coaching_whiteboards for all
  using (public.is_admin()) with check (public.is_admin());

-- Murid login: cuma boleh baca board yang di-share.
drop policy if exists "coaching_whiteboards shared read" on public.coaching_whiteboards;
create policy "coaching_whiteboards shared read"
  on public.coaching_whiteboards for select
  using (shared = true and auth.uid() is not null);
