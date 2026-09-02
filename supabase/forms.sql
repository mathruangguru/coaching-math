-- Form (survei / pendaftaran dalam app). Jalankan di SQL Editor Supabase
-- SETELAH schema.sql + admin.sql. Aman dijalankan ulang.

-- ── Tables ─────────────────────────────────────────────────────────

create table if not exists public.coaching_forms (
  id          text primary key,
  title       text not null,
  description text,
  open        boolean not null default true,   -- false = tutup, murid nggak bisa submit
  created_at  timestamptz not null default now()
);

-- Kolom `open` ditambahkan belakangan. Aman diulang.
alter table public.coaching_forms
  add column if not exists open boolean not null default true;

-- type:
--   short  isian pendek        long   isian panjang
--   single pilihan tunggal     multi  pilihan ganda
--   check  checklist pernyataan (tiap opsi = pernyataan; wajib -> centang semua)
--   name   isian nama  (auto dari akun)   email  isian email (auto dari akun)
--   date   isian tanggal (auto hari ini, murid nggak bisa ubah)
--   rating rating bintang 1-5
create table if not exists public.coaching_form_fields (
  id       text primary key,
  form_id  text not null references public.coaching_forms (id) on delete cascade,
  type     text not null default 'short'
           check (type in ('short', 'long', 'single', 'multi', 'check', 'name', 'email', 'date', 'rating')),
  label    text not null,
  options  jsonb not null default '[]'::jsonb,   -- buat single / multi / check
  required boolean not null default false,
  position int not null default 0
);
create index if not exists coaching_form_fields_form_idx
  on public.coaching_form_fields (form_id, position);

-- Tipe field baru (check / name / email / date / rating) — longgarkan CHECK. Aman diulang.
alter table public.coaching_form_fields drop constraint if exists coaching_form_fields_type_check;
alter table public.coaching_form_fields
  add constraint coaching_form_fields_type_check
    check (type in ('short', 'long', 'single', 'multi', 'check', 'name', 'email', 'date', 'rating'));

-- Respons murid. Boleh lebih dari 1x per form.
create table if not exists public.coaching_form_responses (
  id         uuid primary key default gen_random_uuid(),
  form_id    text not null references public.coaching_forms (id) on delete cascade,
  lesson_id  text references public.coaching_lessons (id) on delete set null,
  user_id    uuid not null references auth.users (id) on delete cascade,
  answers    jsonb not null default '{}'::jsonb,   -- { fieldId: string | string[] | number }
  created_at timestamptz not null default now()
);
create index if not exists coaching_form_responses_form_idx
  on public.coaching_form_responses (form_id, created_at desc);
-- "Udah ngisi belum" di-cek per (form, lesson, user).
create index if not exists coaching_form_responses_form_lesson_user_idx
  on public.coaching_form_responses (form_id, lesson_id, user_id, created_at desc);

-- Lesson tipe 'form' bisa nunjuk ke satu form in-app (selain kolom `url`).
alter table public.coaching_lessons
  add column if not exists form_id text
    references public.coaching_forms (id) on delete set null;

-- ── Grants ─────────────────────────────────────────────────────────
grant select on public.coaching_forms        to anon, authenticated;
grant select on public.coaching_form_fields  to anon, authenticated;
grant insert, update, delete on public.coaching_forms       to authenticated;
grant insert, update, delete on public.coaching_form_fields to authenticated;
grant select, insert, delete on public.coaching_form_responses to authenticated;

grant all on public.coaching_forms          to service_role;
grant all on public.coaching_form_fields    to service_role;
grant all on public.coaching_form_responses to service_role;

-- ── RLS ────────────────────────────────────────────────────────────
alter table public.coaching_forms          enable row level security;
alter table public.coaching_form_fields    enable row level security;
alter table public.coaching_form_responses enable row level security;

-- Form & field: semua yang login boleh baca; cuma admin yang tulis.
drop policy if exists "coaching_forms read" on public.coaching_forms;
create policy "coaching_forms read"
  on public.coaching_forms for select using (true);
drop policy if exists "coaching_forms write admin" on public.coaching_forms;
create policy "coaching_forms write admin"
  on public.coaching_forms for all
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists "coaching_form_fields read" on public.coaching_form_fields;
create policy "coaching_form_fields read"
  on public.coaching_form_fields for select using (true);
drop policy if exists "coaching_form_fields write admin" on public.coaching_form_fields;
create policy "coaching_form_fields write admin"
  on public.coaching_form_fields for all
  using (public.is_admin()) with check (public.is_admin());

-- Respons: murid insert & baca miliknya; admin baca & hapus semua.
-- Murid cuma boleh submit ke form yang masih `open`, dan CUMA SEKALI per
-- (form, lesson) — nggak ada cooldown waktu (selaras dgn src/pages/FormPage.jsx).
-- Satu form yang dipasang di beberapa lesson diisi sendiri-sendiri per lesson:
-- udah ngisi di lesson X nggak nutup lesson Y. Admin hapus respons -> murid
-- bisa ngisi lagi di lesson itu.
drop policy if exists "coaching_form_responses insert own" on public.coaching_form_responses;
create policy "coaching_form_responses insert own"
  on public.coaching_form_responses for insert
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.coaching_forms f
      where f.id = coaching_form_responses.form_id and f.open
    )
    -- Sekali per (form, lesson) per user. Kolom tak-berqualifier di dalam
    -- subquery ke-shadow sama alias `r`, jadi WAJIB qualified ke tabel target
    -- biar nggak jadi `r.x = r.x` (yang bikin lock lintas semua form/lesson).
    -- `is not distinct from` = NULL lesson_id (form tanpa lesson) ikut ke-cover.
    and not exists (
      select 1 from public.coaching_form_responses r
      where r.form_id = coaching_form_responses.form_id
        and r.lesson_id is not distinct from coaching_form_responses.lesson_id
        and r.user_id = auth.uid()
    )
  );

drop policy if exists "coaching_form_responses select own" on public.coaching_form_responses;
create policy "coaching_form_responses select own"
  on public.coaching_form_responses for select
  using (auth.uid() = user_id);

drop policy if exists "coaching_form_responses admin read" on public.coaching_form_responses;
create policy "coaching_form_responses admin read"
  on public.coaching_form_responses for select
  using (public.is_admin());

drop policy if exists "coaching_form_responses admin delete" on public.coaching_form_responses;
create policy "coaching_form_responses admin delete"
  on public.coaching_form_responses for delete
  using (public.is_admin());

-- ── Realtime ───────────────────────────────────────────────────────
-- Halaman isi form murid subscribe ke row coaching_forms, jadi kalau
-- admin nutup form, halaman langsung pindah ke "Form ini sedang ditutup.".
-- RLS "coaching_forms read" (using true) tetap berlaku buat stream ini.
do $$
begin
  alter publication supabase_realtime add table public.coaching_forms;
exception
  when duplicate_object then null;
end $$;
