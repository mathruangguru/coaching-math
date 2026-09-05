-- Sistem latihan soal (pilihan ganda). Jalankan di SQL Editor Supabase
-- SETELAH schema.sql + admin.sql. Aman dijalankan ulang.

-- ── Tables ─────────────────────────────────────────────────────────

create table if not exists public.coaching_question_sets (
  id          text primary key,
  title       text not null,
  description text,
  created_at  timestamptz not null default now()
);

-- Batas waktu pengerjaan (menit). null = tanpa batas. Ditambahkan belakangan.
alter table public.coaching_question_sets
  add column if not exists time_limit_min int;

-- Instruksi / rules yang tampil di lobby sebelum murid klik "Mulai".
alter table public.coaching_question_sets
  add column if not exists intro text;

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

-- Durasi pengerjaan (detik). Diisi Edge Function quiz-submit — dihitung
-- dari coaching_quiz_progress.started_at (server-side). Nullable.
alter table public.coaching_quiz_attempts
  add column if not exists duration_sec int;

-- Progress kuis yang belum disubmit: waktu mulai + draft jawaban. Biar
-- timer & jawaban lanjut walau pindah device / refresh. Edge Function
-- quiz-submit ngehapus barisnya begitu attempt masuk.
create table if not exists public.coaching_quiz_progress (
  user_id    uuid not null references auth.users (id) on delete cascade,
  set_id     text not null references public.coaching_question_sets (id) on delete cascade,
  started_at timestamptz not null default now(),
  answers    jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (user_id, set_id)
);

grant select, insert, update, delete on public.coaching_quiz_progress to authenticated;
grant all on public.coaching_quiz_progress to service_role;

alter table public.coaching_quiz_progress enable row level security;

drop policy if exists "coaching_quiz_progress own" on public.coaching_quiz_progress;
create policy "coaching_quiz_progress own"
  on public.coaching_quiz_progress for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Admin lihat siapa aja yang lagi ngerjain (di /admin/quiz-results).
drop policy if exists "coaching_quiz_progress admin read" on public.coaching_quiz_progress;
create policy "coaching_quiz_progress admin read"
  on public.coaching_quiz_progress for select
  using (public.is_admin());

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

-- ── Statistik butir soal (buat murid, di halaman review) ─────────────
-- Per soal: berapa attempt total & berapa yang jawab benar (dari kolom
-- `results` yang udah dihitung Edge Function). security definer supaya
-- murid bisa lihat agregatnya tanpa bisa baca attempt orang lain.
create or replace function public.quiz_question_stats(p_set text)
returns table (question_id text, total bigint, correct bigint)
language sql security definer set search_path = public stable as $$
  select
    q.id,
    count(a.id),
    count(*) filter (where (a.results ->> q.id) = 'true')
  from public.coaching_questions q
  left join public.coaching_quiz_attempts a
    on a.set_id = p_set and a.results <> '{}'::jsonb
  where q.set_id = p_set
  group by q.id;
$$;

revoke execute on function public.quiz_question_stats(text) from anon;
grant execute on function public.quiz_question_stats(text) to authenticated;

-- ── Buka/tutup akses pengerjaan ───────────────────────────────────────
-- Beda dari publish_status: soal tetap published (kelihatan di materi),
-- tapi kalau akses ditutup, murid yang BELUM pernah mulai ketahan di
-- lobby (nggak bisa klik "Mulai"). Yang udah mulai/submit tetap bisa
-- lanjut ngerjain / lihat hasil seperti biasa -- akses cuma nge-gate
-- SESI BARU, bukan yang lagi/udah jalan.
alter table public.coaching_lessons
  add column if not exists access_open boolean not null default true;

-- Jadwal opsional (di atas toggle manual access_open). null di keduanya
-- = nggak dijadwal, murni ikut toggle manual seperti sebelumnya. Kalau
-- diisi, akses cuma kebuka di rentang [access_opens_at, access_closes_at)
-- DAN toggle manual masih harus true -- access_open jadi kill-switch di
-- atas jadwal (tutup manual tetap menang walau lagi di rentang jadwal).
alter table public.coaching_lessons
  add column if not exists access_opens_at timestamptz,
  add column if not exists access_closes_at timestamptz;

-- Mulai / lanjut sesi kuis. Ganti upsert client-side lama (rawan race +
-- nggak bisa nge-gate access_open karena coaching_quiz_progress cuma
-- punya set_id, bukan lesson_id). security definer: satu query atomik
-- yang cek access_open + jadwal lewat lesson_id lalu insert-if-absent.
create or replace function public.open_quiz_progress(p_lesson_id text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_uid        uuid := auth.uid();
  v_set_id     text;
  v_open       boolean;
  v_opens_at   timestamptz;
  v_closes_at  timestamptz;
  v_allowed    boolean;
  v_started    timestamptz;
  v_answers    jsonb;
begin
  if v_uid is null then
    raise exception 'BELUM_LOGIN';
  end if;

  select l.question_set_id, coalesce(l.access_open, true),
         l.access_opens_at, l.access_closes_at
    into v_set_id, v_open, v_opens_at, v_closes_at
  from public.coaching_lessons l
  where l.id = p_lesson_id;

  if v_set_id is null then
    raise exception 'SOAL_TIDAK_ADA';
  end if;

  v_allowed := v_open
    and (v_opens_at is null or now() >= v_opens_at)
    and (v_closes_at is null or now() < v_closes_at);

  select started_at, answers into v_started, v_answers
  from public.coaching_quiz_progress
  where user_id = v_uid and set_id = v_set_id;

  -- Belum pernah mulai & akses (manual atau jadwal) ditutup -> tolak.
  -- Udah pernah mulai -> selalu boleh lanjut, nggak relevan lagi.
  if v_started is null and not v_allowed then
    raise exception 'AKSES_DITUTUP';
  end if;

  if v_started is null then
    insert into public.coaching_quiz_progress (user_id, set_id)
    values (v_uid, v_set_id)
    on conflict (user_id, set_id) do nothing;

    select started_at, answers into v_started, v_answers
    from public.coaching_quiz_progress
    where user_id = v_uid and set_id = v_set_id;
  end if;

  return jsonb_build_object('started_at', v_started, 'answers', v_answers);
end;
$$;

revoke execute on function public.open_quiz_progress(text) from anon;
grant execute on function public.open_quiz_progress(text) to authenticated;
