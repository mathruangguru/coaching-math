-- Sistem latihan soal (pilihan ganda). Jalankan di SQL Editor Supabase
-- SETELAH schema.sql + admin.sql. Aman dijalankan ulang.

-- ── Tables ─────────────────────────────────────────────────────────

create table if not exists public.coaching_question_sets (
  id          text primary key,
  title       text not null,
  description text,
  created_at  timestamptz not null default now()
);

create table if not exists public.coaching_questions (
  id       text primary key,
  set_id   text not null references public.coaching_question_sets (id) on delete cascade,
  code     text,                                 -- 8 char [A-Z0-9], referensi manusia
  prompt   text not null,                        -- boleh mengandung LaTeX ($...$ / $$...$$)
  options  jsonb not null default '[]'::jsonb,   -- ["opsi A", "opsi B", ...]
  position int  not null default 0
);
create index if not exists coaching_questions_set_idx
  on public.coaching_questions (set_id, position);

-- kolom code ditambahkan belakangan; backfill baris lama.
alter table public.coaching_questions add column if not exists code text;
update public.coaching_questions
  set code = upper(substr(md5(random()::text || id), 1, 8))
  where code is null;

-- Tipe soal: 'single' (pilihan ganda) / 'multi' (checklist, >1 jawaban benar).
alter table public.coaching_questions
  add column if not exists type text not null default 'single';
alter table public.coaching_questions drop constraint if exists coaching_questions_type_check;
alter table public.coaching_questions
  add constraint coaching_questions_type_check check (type in ('single', 'multi'));

-- Kunci jawaban dipisah: murid nggak boleh bisa baca ini lewat API.
create table if not exists public.coaching_question_keys (
  question_id text primary key references public.coaching_questions (id) on delete cascade,
  answer      int not null default 0,                -- legacy: index tunggal
  answers     int[] not null default '{}'::int[]     -- himpunan index opsi yang benar
);

-- Kolom answers[] ditambahkan belakangan — backfill dari `answer`.
alter table public.coaching_question_keys
  add column if not exists answers int[] not null default '{}'::int[];
update public.coaching_question_keys
  set answers = array[answer]
  where cardinality(answers) = 0;

-- Attempt murid: skor + snapshot jawaban. 1x per (user, set).
create table if not exists public.coaching_quiz_attempts (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  lesson_id  text not null references public.coaching_lessons (id) on delete cascade,
  set_id     text references public.coaching_question_sets (id) on delete set null,
  answers    jsonb not null default '{}'::jsonb,     -- { questionId: chosenIndex }
  results    jsonb not null default '{}'::jsonb,     -- { questionId: boolean } (benar?)
  score      int not null default 0,
  total      int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists coaching_quiz_attempts_user_lesson_idx
  on public.coaching_quiz_attempts (user_id, lesson_id, created_at desc);

-- Kolom results ditambahkan belakangan (dulu koreksi dihitung ulang).
alter table public.coaching_quiz_attempts
  add column if not exists results jsonb not null default '{}'::jsonb;

-- Durasi pengerjaan (detik). Diisi Edge Function quiz-submit dari kiriman
-- client (di-clamp di server). Nullable — attempt lama nggak punya.
alter table public.coaching_quiz_attempts
  add column if not exists duration_sec int;

-- 1 attempt per (user, set). Hapus dulu duplikat lama (simpan yang paling
-- awal), lalu pasang unique index.
delete from public.coaching_quiz_attempts a
using public.coaching_quiz_attempts b
where a.user_id = b.user_id
  and a.set_id is not null
  and a.set_id = b.set_id
  and (b.created_at < a.created_at
       or (b.created_at = a.created_at and b.id < a.id));
create unique index if not exists coaching_quiz_attempts_user_set_uniq
  on public.coaching_quiz_attempts (user_id, set_id)
  where set_id is not null;

-- Lesson tipe 'soal' nunjuk ke satu set.
alter table public.coaching_lessons
  add column if not exists question_set_id text
    references public.coaching_question_sets (id) on delete set null;

-- ── Grants ─────────────────────────────────────────────────────────

grant select on public.coaching_question_sets to anon, authenticated;
grant select on public.coaching_questions     to anon, authenticated;
grant insert, update, delete on public.coaching_question_sets  to authenticated;
grant insert, update, delete on public.coaching_questions      to authenticated;
grant select, insert, update, delete on public.coaching_question_keys to authenticated;
grant select, delete on public.coaching_quiz_attempts to authenticated;

-- Edge Function quiz-submit pakai service_role.
grant all on public.coaching_question_sets    to service_role;
grant all on public.coaching_questions        to service_role;
grant all on public.coaching_question_keys    to service_role;
grant all on public.coaching_quiz_attempts    to service_role;

-- ── RLS ────────────────────────────────────────────────────────────

alter table public.coaching_question_sets   enable row level security;
alter table public.coaching_questions       enable row level security;
alter table public.coaching_question_keys   enable row level security;
alter table public.coaching_quiz_attempts   enable row level security;

-- Set & soal: semua boleh baca; cuma admin yang tulis.
drop policy if exists "coaching_question_sets read" on public.coaching_question_sets;
create policy "coaching_question_sets read"
  on public.coaching_question_sets for select using (true);
drop policy if exists "coaching_question_sets write admin" on public.coaching_question_sets;
create policy "coaching_question_sets write admin"
  on public.coaching_question_sets for all
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists "coaching_questions read" on public.coaching_questions;
create policy "coaching_questions read"
  on public.coaching_questions for select using (true);
drop policy if exists "coaching_questions write admin" on public.coaching_questions;
create policy "coaching_questions write admin"
  on public.coaching_questions for all
  using (public.is_admin()) with check (public.is_admin());

-- Kunci jawaban: admin only, baca & tulis.
drop policy if exists "coaching_question_keys admin" on public.coaching_question_keys;
create policy "coaching_question_keys admin"
  on public.coaching_question_keys for all
  using (public.is_admin()) with check (public.is_admin());

-- Attempt: tiap murid cuma baca miliknya. Insert lewat Edge Function
-- (service_role) biar skor nggak bisa dipalsukan.
drop policy if exists "coaching_quiz_attempts select own" on public.coaching_quiz_attempts;
create policy "coaching_quiz_attempts select own"
  on public.coaching_quiz_attempts for select
  using (auth.uid() = user_id);

-- Admin baca semua attempt (rekap nilai di /admin/quiz-results).
drop policy if exists "coaching_quiz_attempts admin read" on public.coaching_quiz_attempts;
create policy "coaching_quiz_attempts admin read"
  on public.coaching_quiz_attempts for select
  using (public.is_admin());

-- Admin hapus attempt = reset murid buat set itu (bisa ngerjain lagi).
drop policy if exists "coaching_quiz_attempts admin delete" on public.coaching_quiz_attempts;
create policy "coaching_quiz_attempts admin delete"
  on public.coaching_quiz_attempts for delete
  using (public.is_admin());
