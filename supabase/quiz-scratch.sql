-- Kumpulkan coret-coretan (foto) setelah submit kuis.
-- Jalankan di SQL Editor Supabase SETELAH quiz.sql + admin.sql. Aman diulang.
--
-- Diaktifkan per lesson 'soal' dari editor kurikulum (scratch_enabled), dengan
-- batas waktu upload (scratch_window_min, default 5 menit) yang dihitung dari
-- WAKTU SUBMIT (coaching_quiz_attempts.created_at). Pengecekan waktu dilakukan
-- di database (policy), bukan cuma di UI, jadi upload lewat API langsung pun
-- ditolak begitu waktunya habis. Window dihitung dinamis: kalau admin ngubah
-- durasinya, attempt yang sudah ada ikut kena.

alter table public.coaching_lessons
  add column if not exists scratch_enabled boolean not null default false,
  add column if not exists scratch_window_min int not null default 5;
alter table public.coaching_lessons drop constraint if exists coaching_lessons_scratch_window_check;
alter table public.coaching_lessons
  add constraint coaching_lessons_scratch_window_check
    check (scratch_window_min between 1 and 120);

-- ── Pengecekan "masih boleh upload?" ───────────────────────────────────
-- text (bukan uuid) supaya policy storage bisa kirim potongan path apa
-- adanya tanpa cast yang bisa error.
create or replace function public.quiz_scratch_open(p_attempt_id text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.coaching_quiz_attempts a
    join public.coaching_lessons l on l.id = a.lesson_id
    where a.id::text = p_attempt_id
      and a.user_id = auth.uid()
      and l.scratch_enabled
      and now() <= a.created_at + make_interval(mins => l.scratch_window_min)
  );
$$;

-- Status buat halaman hasil murid: attempt miliknya di lesson ini + kapan
-- window ditutup. server_now = jam server, biar hitung mundur di browser
-- nggak tergantung jam HP/laptop murid. null = nggak aktif / belum submit.
create or replace function public.quiz_scratch_status(p_lesson_id text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'attempt_id', a.id,
    'window_min', l.scratch_window_min,
    'closes_at', a.created_at + make_interval(mins => l.scratch_window_min),
    'server_now', now()
  )
  from public.coaching_quiz_attempts a
  join public.coaching_lessons l on l.id = a.lesson_id
  where a.user_id = auth.uid()
    and a.lesson_id = p_lesson_id
    and l.scratch_enabled
  order by a.created_at desc
  limit 1;
$$;

revoke all on function public.quiz_scratch_open(text) from public, anon;
revoke all on function public.quiz_scratch_status(text) from public, anon;
grant execute on function public.quiz_scratch_open(text) to authenticated;
grant execute on function public.quiz_scratch_status(text) to authenticated;

-- ── Tabel file ─────────────────────────────────────────────────────────
create table if not exists public.coaching_quiz_scratch (
  id         uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.coaching_quiz_attempts (id) on delete cascade,
  user_id    uuid not null default auth.uid(),
  path       text not null unique,          -- <user_id>/<attempt_id>/<uuid>.<ext> di bucket quiz-scratch
  created_at timestamptz not null default now()
);
create index if not exists coaching_quiz_scratch_attempt_idx
  on public.coaching_quiz_scratch (attempt_id);

grant select, insert, delete on public.coaching_quiz_scratch to authenticated;
grant all on public.coaching_quiz_scratch to service_role;

alter table public.coaching_quiz_scratch enable row level security;

drop policy if exists "coaching_quiz_scratch select own" on public.coaching_quiz_scratch;
create policy "coaching_quiz_scratch select own"
  on public.coaching_quiz_scratch for select
  using (auth.uid() = user_id);

drop policy if exists "coaching_quiz_scratch admin read" on public.coaching_quiz_scratch;
create policy "coaching_quiz_scratch admin read"
  on public.coaching_quiz_scratch for select
  using (public.is_admin());

-- Murid: cuma ke attempt miliknya, selama window buka, maks 10 file, dan path
-- harus di folder <user_id>/<attempt_id>/.
drop policy if exists "coaching_quiz_scratch insert own" on public.coaching_quiz_scratch;
create policy "coaching_quiz_scratch insert own"
  on public.coaching_quiz_scratch for insert
  with check (
    auth.uid() = user_id
    and public.quiz_scratch_open(attempt_id::text)
    and path like user_id::text || '/' || attempt_id::text || '/%'
    and (
      select count(*) from public.coaching_quiz_scratch s
      where s.attempt_id = coaching_quiz_scratch.attempt_id
    ) < 10
  );

-- Murid boleh hapus punyanya sendiri (salah foto) selama window masih buka.
drop policy if exists "coaching_quiz_scratch delete own" on public.coaching_quiz_scratch;
create policy "coaching_quiz_scratch delete own"
  on public.coaching_quiz_scratch for delete
  using (auth.uid() = user_id and public.quiz_scratch_open(attempt_id::text));

drop policy if exists "coaching_quiz_scratch admin delete" on public.coaching_quiz_scratch;
create policy "coaching_quiz_scratch admin delete"
  on public.coaching_quiz_scratch for delete
  using (public.is_admin());

-- ── Storage bucket (PRIVAT — ini kerjaan murid, nggak dibuka publik) ───
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('quiz-scratch', 'quiz-scratch', false, 10485760,
        array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do update
  set public = false,
      file_size_limit = 10485760,
      allowed_mime_types = array['image/png', 'image/jpeg', 'image/webp'];

-- Baca: pemilik (folder pertama = user id-nya) + admin. Akses lewat signed URL.
drop policy if exists "quiz-scratch read" on storage.objects;
create policy "quiz-scratch read"
  on storage.objects for select
  using (
    bucket_id = 'quiz-scratch'
    and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin())
  );

-- Upload: folder sendiri + attempt-nya masih dalam window.
drop policy if exists "quiz-scratch insert own" on storage.objects;
create policy "quiz-scratch insert own"
  on storage.objects for insert
  with check (
    bucket_id = 'quiz-scratch'
    and (storage.foldername(name))[1] = auth.uid()::text
    and public.quiz_scratch_open((storage.foldername(name))[2])
  );

drop policy if exists "quiz-scratch delete own" on storage.objects;
create policy "quiz-scratch delete own"
  on storage.objects for delete
  using (
    bucket_id = 'quiz-scratch'
    and (storage.foldername(name))[1] = auth.uid()::text
    and public.quiz_scratch_open((storage.foldername(name))[2])
  );

drop policy if exists "quiz-scratch admin delete" on storage.objects;
create policy "quiz-scratch admin delete"
  on storage.objects for delete
  using (bucket_id = 'quiz-scratch' and public.is_admin());
