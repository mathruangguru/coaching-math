-- Feedback antar-murid. Jalankan di SQL Editor Supabase SETELAH
-- schema.sql + admin.sql + forms.sql. Aman dijalankan ulang.
--
-- Model: satu lesson tipe 'feedback' = satu ronde = satu "orang X"
-- (target_user_id). Semua murid lain di course itu ngisi form yang
-- sama kayak refleksi (reuse coaching_forms/coaching_form_responses).
-- Ganti target -> admin bikin lesson baru, bukan edit yang lama.
--
-- Visibility-nya nggak simetris:
--   - admin  liat semua respons + siapa pengirimnya (lewat getFormResponses
--     yang udah ada, RLS "coaching_form_responses admin read").
--   - target liat semua respons TAPI ANONIM -- lewat RPC get_my_feedback
--     di bawah, yang sengaja nggak nyertain user_id sama sekali. Nggak ada
--     policy SELECT baru buat target di coaching_form_responses -- RPC ini
--     satu-satunya jalan, jadi nggak ada baris mentah (dgn user_id) yang
--     pernah nyampe ke browser target lewat jalur mana pun.

-- ── Tipe lesson baru ──────────────────────────────────────────────
alter table public.coaching_lessons drop constraint if exists coaching_lessons_type_check;
alter table public.coaching_lessons
  add constraint coaching_lessons_type_check
    check (type in ('materi', 'soal', 'meet', 'recording', 'slide', 'pdf',
                    'form', 'presensi', 'refleksi', 'feedback'));

-- target_user_id = "orang X" ronde ini. target_name didenormalisasi
-- (nama tersimpan pas admin milih) -- murid biasa nggak bisa baca
-- coaching_profiles orang lain (RLS-nya cuma diri sendiri / admin),
-- jadi nama disalin ke lesson biar giver bisa liat "buat siapa".
alter table public.coaching_lessons
  add column if not exists target_user_id uuid references auth.users (id) on delete set null,
  add column if not exists target_name text;

-- ── RLS: nggak boleh ngasih feedback ke diri sendiri ────────────────
-- Redefine "coaching_form_responses insert own" -- salin persis klausa
-- yang udah ada di forms.sql (form harus open, sekali per form+lesson),
-- tambah satu klausa baru: kalau lesson-nya tipe feedback, user_id yang
-- insert nggak boleh sama dengan target_user_id lesson itu.
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
    -- Feedback: nggak boleh ngasih feedback buat diri sendiri.
    and not exists (
      select 1 from public.coaching_lessons l
      where l.id = coaching_form_responses.lesson_id
        and l.type = 'feedback'
        and l.target_user_id = auth.uid()
    )
  );

-- ── RPC: target liat feedback buat dirinya, anonim ──────────────────
-- Sengaja SELECT tanpa user_id sama sekali -- nggak ada cara identitas
-- pengirim nyampe ke client lewat fungsi ini.
create or replace function public.get_my_feedback(p_course_id text)
returns table (
  lesson_id   text,
  lesson_title text,
  form_id     text,
  created_at  timestamptz,
  answers     jsonb
)
language sql security definer set search_path = public stable as $$
  select r.lesson_id, l.title, r.form_id, r.created_at, r.answers
  from public.coaching_form_responses r
  join public.coaching_lessons l on l.id = r.lesson_id
  join public.coaching_course_sections cs on cs.id = l.section_id
  where cs.course_id = p_course_id
    and l.type = 'feedback'
    and l.target_user_id = auth.uid()
  order by r.created_at desc;
$$;

revoke execute on function public.get_my_feedback(text) from anon;
grant execute on function public.get_my_feedback(text) to authenticated;
