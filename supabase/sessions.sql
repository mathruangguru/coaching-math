-- Presensi & Refleksi — item materi di dalam course.
-- Jalankan di SQL Editor Supabase SETELAH schema.sql + admin.sql. Aman diulang.

-- ── Tipe lesson baru ──────────────────────────────────────────────
-- 'slide' = preview Google Slides, 'pdf' = PDF yang di-upload
-- (dua-duanya simpan link di kolom `url`, sama kayak recording/meet).
alter table public.coaching_lessons drop constraint if exists coaching_lessons_type_check;
alter table public.coaching_lessons
  add constraint coaching_lessons_type_check
    check (type in ('materi', 'soal', 'meet', 'recording', 'slide', 'pdf',
                    'form', 'presensi', 'refleksi'));

-- Pertanyaan refleksi (dipakai lesson tipe 'refleksi').
alter table public.coaching_lessons add column if not exists prompt text;

-- ── Presensi ──────────────────────────────────────────────────────
-- Ronde presensi. Satu lesson presensi bisa punya beberapa ronde
-- (mis. Awal / Tengah / Akhir). Admin buka/tutup window-nya.
create table if not exists public.coaching_attendance_rounds (
  id         text primary key,
  lesson_id  text not null references public.coaching_lessons (id) on delete cascade,
  label      text not null default 'Presensi',
  is_open    boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists coaching_attendance_rounds_lesson_idx
  on public.coaching_attendance_rounds (lesson_id, created_at);

grant select on public.coaching_attendance_rounds to anon, authenticated;
grant insert, update, delete on public.coaching_attendance_rounds to authenticated;
grant all on public.coaching_attendance_rounds to service_role;

alter table public.coaching_attendance_rounds enable row level security;
drop policy if exists "coaching_attendance_rounds read" on public.coaching_attendance_rounds;
create policy "coaching_attendance_rounds read"
  on public.coaching_attendance_rounds for select using (true);
drop policy if exists "coaching_attendance_rounds write admin" on public.coaching_attendance_rounds;
create policy "coaching_attendance_rounds write admin"
  on public.coaching_attendance_rounds for all
  using (public.is_admin()) with check (public.is_admin());

-- Presensi murid, per ronde. JANGAN di-drop di sini — file ini di-run ulang
-- tiap ada perubahan tipe lesson, dan drop bakal ngehapus semua check-in.
create table if not exists public.coaching_attendance (
  id            uuid primary key default gen_random_uuid(),
  round_id      text not null references public.coaching_attendance_rounds (id) on delete cascade,
  user_id       uuid not null references auth.users (id) on delete cascade,
  checked_in_at timestamptz not null default now(),
  unique (round_id, user_id)
);
create index if not exists coaching_attendance_round_idx
  on public.coaching_attendance (round_id, checked_in_at);

grant select, insert on public.coaching_attendance to authenticated;
grant all on public.coaching_attendance to service_role;

alter table public.coaching_attendance enable row level security;

drop policy if exists "coaching_attendance read" on public.coaching_attendance;
create policy "coaching_attendance read"
  on public.coaching_attendance for select
  using (auth.uid() = user_id or public.is_admin());

-- Murid cuma bisa check-in ke ronde yang lagi dibuka.
drop policy if exists "coaching_attendance insert own" on public.coaching_attendance;
create policy "coaching_attendance insert own"
  on public.coaching_attendance for insert
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.coaching_attendance_rounds r
      where r.id = round_id and r.is_open
    )
  );

-- Admin bisa tandai hadir siapa aja (import dari latihan soal / form / ronde
-- lain), termasuk ke ronde yang udah ditutup.
drop policy if exists "coaching_attendance insert admin" on public.coaching_attendance;
create policy "coaching_attendance insert admin"
  on public.coaching_attendance for insert
  with check (public.is_admin());

-- Realtime: murid ngikutin buka/tutup ronde; admin ngikutin check-in masuk.
do $$
begin
  alter publication supabase_realtime add table public.coaching_attendance_rounds;
exception when duplicate_object then null;
end $$;
do $$
begin
  alter publication supabase_realtime add table public.coaching_attendance;
exception when duplicate_object then null;
end $$;

-- ── Ronde presensi ter-link ke aktivitas (auto-sync) ──────────────
-- Ronde bisa "nempel" ke sebuah lesson soal / form: siapa yang beres
-- ngerjain lesson itu otomatis kehitung hadir; kalau attempt/respons-nya
-- dihapus (mis. admin reset) & nggak ada sisa, dia otomatis ilang.
-- Baris `source = 'auto'` = dikelola trigger; `source` null = check-in
-- manual, nggak pernah kesentuh trigger.

alter table public.coaching_attendance_rounds
  add column if not exists source_kind text
    check (source_kind in ('soal', 'form')),
  add column if not exists source_lesson_id text
    references public.coaching_lessons (id) on delete set null;

alter table public.coaching_attendance
  add column if not exists source text;

create index if not exists coaching_attendance_rounds_source_idx
  on public.coaching_attendance_rounds (source_kind, source_lesson_id);

-- (Re)isi satu ronde ter-link dari sumbernya yang sekarang.
create or replace function public.fn_sync_linked_round(p_round text)
returns void language plpgsql security definer set search_path = public as $$
declare
  r public.coaching_attendance_rounds;
begin
  select * into r from public.coaching_attendance_rounds where id = p_round;
  if not found or r.source_kind is null or r.source_lesson_id is null then
    return;
  end if;
  delete from public.coaching_attendance
   where round_id = p_round and source = 'auto';
  if r.source_kind = 'soal' then
    insert into public.coaching_attendance (round_id, user_id, source)
    select p_round, s.user_id, 'auto'
      from (select distinct user_id from public.coaching_quiz_attempts
             where lesson_id = r.source_lesson_id) s
    on conflict (round_id, user_id) do nothing;
  else -- 'form'
    insert into public.coaching_attendance (round_id, user_id, source)
    select p_round, s.user_id, 'auto'
      from (select distinct user_id from public.coaching_form_responses
             where lesson_id = r.source_lesson_id) s
    on conflict (round_id, user_id) do nothing;
  end if;
end $$;

-- Ronde: pas link di-set / diganti → isi ulang. Pas link dilepas (null)
-- → biarin anggota sekarang (freeze).
create or replace function public.trg_round_link()
returns trigger language plpgsql as $$
begin
  if tg_op = 'INSERT'
     or new.source_kind is distinct from old.source_kind
     or new.source_lesson_id is distinct from old.source_lesson_id then
    if new.source_kind is not null and new.source_lesson_id is not null then
      perform public.fn_sync_linked_round(new.id);
    end if;
  end if;
  return null;
end $$;
drop trigger if exists round_link_sync on public.coaching_attendance_rounds;
create trigger round_link_sync
  after insert or update on public.coaching_attendance_rounds
  for each row execute function public.trg_round_link();

-- Attempt soal masuk/keluar → ronde soal yang ter-link ikut update.
create or replace function public.trg_attempt_attendance()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    insert into public.coaching_attendance (round_id, user_id, source)
    select ar.id, new.user_id, 'auto'
      from public.coaching_attendance_rounds ar
     where ar.source_kind = 'soal' and ar.source_lesson_id = new.lesson_id
    on conflict (round_id, user_id) do nothing;
    return new;
  else
    if not exists (select 1 from public.coaching_quiz_attempts
                    where lesson_id = old.lesson_id and user_id = old.user_id) then
      delete from public.coaching_attendance a
       using public.coaching_attendance_rounds ar
       where a.round_id = ar.id and a.source = 'auto' and a.user_id = old.user_id
         and ar.source_kind = 'soal' and ar.source_lesson_id = old.lesson_id;
    end if;
    return old;
  end if;
end $$;
drop trigger if exists attempt_attendance_sync on public.coaching_quiz_attempts;
create trigger attempt_attendance_sync
  after insert or delete on public.coaching_quiz_attempts
  for each row execute function public.trg_attempt_attendance();

-- Respons form masuk/keluar → ronde form yang ter-link ikut update.
create or replace function public.trg_response_attendance()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    insert into public.coaching_attendance (round_id, user_id, source)
    select ar.id, new.user_id, 'auto'
      from public.coaching_attendance_rounds ar
     where ar.source_kind = 'form' and ar.source_lesson_id = new.lesson_id
    on conflict (round_id, user_id) do nothing;
    return new;
  else
    if not exists (select 1 from public.coaching_form_responses
                    where lesson_id = old.lesson_id and user_id = old.user_id) then
      delete from public.coaching_attendance a
       using public.coaching_attendance_rounds ar
       where a.round_id = ar.id and a.source = 'auto' and a.user_id = old.user_id
         and ar.source_kind = 'form' and ar.source_lesson_id = old.lesson_id;
    end if;
    return old;
  end if;
end $$;
drop trigger if exists response_attendance_sync on public.coaching_form_responses;
create trigger response_attendance_sync
  after insert or delete on public.coaching_form_responses
  for each row execute function public.trg_response_attendance();

-- ── Refleksi ──────────────────────────────────────────────────────
-- Lesson tipe 'refleksi' nunjuk ke sebuah Form in-app lewat
-- coaching_lessons.form_id (kolom `form_id` udah ada dari forms.sql).
-- Ngerjain & rekapnya lewat sistem Form — nggak ada tabel khusus.
-- (Tabel coaching_reflections dari versi lama nggak dipakai lagi;
--  drop kalau mau bersih:  drop table if exists public.coaching_reflections;)
