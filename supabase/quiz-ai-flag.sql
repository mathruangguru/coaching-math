-- Flag "AI Detected" buat jawaban murid (halaman admin Hasil Soal).
-- Jalankan di SQL Editor Supabase SETELAH quiz.sql + quiz-progress-guard.sql.
-- Aman dijalankan ulang.
--
-- Dua lapis:
--  1. Sinyal otomatis (di app): waktu kerja terlalu singkat + skor tinggi,
--     dan "burst autosave" (banyak soal terisi sekaligus di satu autosave —
--     dihitung fungsi quiz_autosave_bursts di bawah dari tabel audit).
--     Cuma petunjuk, bukan bukti.
--  2. Keputusan admin: confirmed ("AI Detected") / dismissed ("Bukan AI").
--     Disimpan di tabel TERPISAH yang admin-only — kalau ditaruh di kolom
--     coaching_quiz_attempts, murid bisa baca flag & catatannya lewat policy
--     "select own".

create table if not exists public.coaching_quiz_ai_reviews (
  attempt_id  uuid primary key
              references public.coaching_quiz_attempts (id) on delete cascade,
  verdict     text not null check (verdict in ('confirmed', 'dismissed')),
  note        text,
  reviewed_by uuid references auth.users (id) on delete set null,
  reviewed_at timestamptz not null default now()
);

grant select, insert, update, delete on public.coaching_quiz_ai_reviews to authenticated;
grant all on public.coaching_quiz_ai_reviews to service_role;

alter table public.coaching_quiz_ai_reviews enable row level security;

drop policy if exists "coaching_quiz_ai_reviews admin" on public.coaching_quiz_ai_reviews;
create policy "coaching_quiz_ai_reviews admin"
  on public.coaching_quiz_ai_reviews for all
  using (public.is_admin()) with check (public.is_admin());

-- Per murid di satu set: jumlah TERBANYAK soal yang terisi/berubah di satu
-- event autosave. Autosave ter-debounce 800 ms di QuizPage, jadi murid yang
-- ngerjain satu-satu biasanya 1 soal per autosave; nilai tinggi = banyak
-- jawaban masuk barengan (mis. paste / script).
-- Event pertama tanpa pendahulu (progress yang sudah jalan sebelum tabel
-- audit ada) dilewati — kalau nggak, seluruh jawaban lama kebaca "burst".
-- SECURITY INVOKER: tabel audit admin-only lewat RLS, non-admin dapat kosong.
create or replace function public.quiz_autosave_bursts(p_set_id text)
returns table (user_id uuid, max_burst int)
language sql
stable
as $$
  with s as (
    select a.user_id, a.op, a.answers,
           lag(a.answers) over (partition by a.user_id order by a.logged_at, a.id) as prev
    from public.coaching_quiz_progress_audit a
    where a.set_id = p_set_id
      and a.op in ('INSERT', 'UPDATE')
  )
  select s.user_id,
         max((
           select count(*)
           from jsonb_each(coalesce(s.answers, '{}'::jsonb)) e
           where e.value not in ('""'::jsonb, '[]'::jsonb, 'null'::jsonb)
             and e.value is distinct from (coalesce(s.prev, '{}'::jsonb) -> e.key)
         ))::int as max_burst
  from s
  where s.op = 'UPDATE'
    and s.prev is not null
  group by s.user_id;
$$;

revoke all on function public.quiz_autosave_bursts(text) from public, anon;
grant execute on function public.quiz_autosave_bursts(text) to authenticated;
