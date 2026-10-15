-- Keaktifan murid per sesi (jenis materi 'keaktifan').
-- Jalankan di SQL Editor Supabase SETELAH admin.sql + sessions.sql. Aman diulang.
--
-- Admin yang mencatat (di tab "Keaktifan" halaman admin course); murid cuma
-- bisa MELIHAT catatannya sendiri di halaman materi "Keaktifan".

-- ── Tipe lesson baru 'keaktifan' ───────────────────────────────────────
-- List LENGKAP semua tipe -- sama persis di sessions.sql, feedback.sql &
-- image.sql biar urutan run / re-run file nggak ngefek.
alter table public.coaching_lessons drop constraint if exists coaching_lessons_type_check;
alter table public.coaching_lessons
  add constraint coaching_lessons_type_check
    check (type in ('materi', 'soal', 'meet', 'recording', 'slide', 'pdf',
                    'form', 'presensi', 'refleksi', 'feedback', 'image',
                    'keaktifan'));

-- ── Catatan keaktifan ──────────────────────────────────────────────────
-- Tiga toggle yang boleh dikombinasikan per murid per materi:
--   presentasi   melakukan presentasi pada sesi ini
--   tanya_jawab  aktif berdiskusi lewat sesi tanya jawab
--   on_chat      aktif berdiskusi lewat chat
-- (tanya_jawab + on_chat = "Tanya Jawab dan On Chat".) Satu baris per
-- (lesson, murid); nggak ada baris = belum tercatat aktif.
create table if not exists public.coaching_activity_marks (
  lesson_id  text not null references public.coaching_lessons (id) on delete cascade,
  user_id    uuid not null references auth.users (id) on delete cascade,
  kinds      text[] not null default '{}',
  marked_by  uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key (lesson_id, user_id)
);

-- Versi pertama pakai satu kolom `kind` (4 pilihan). Pindahkan datanya ke
-- `kinds` lalu buang kolom lama. Aman diulang (no-op kalau `kind` sudah nggak ada).
alter table public.coaching_activity_marks
  add column if not exists kinds text[] not null default '{}';
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'coaching_activity_marks'
      and column_name = 'kind'
  ) then
    update public.coaching_activity_marks
      set kinds = case kind
        when 'tanya_jawab_on_chat' then array['tanya_jawab', 'on_chat']
        else array[kind]
      end
      where cardinality(kinds) = 0;
    alter table public.coaching_activity_marks drop column kind;
  end if;
end $$;

alter table public.coaching_activity_marks
  drop constraint if exists coaching_activity_marks_kinds_check;
alter table public.coaching_activity_marks
  add constraint coaching_activity_marks_kinds_check
    check (
      cardinality(kinds) between 1 and 3
      and kinds <@ array['presentasi', 'tanya_jawab', 'on_chat']
    );

create index if not exists coaching_activity_marks_user_idx
  on public.coaching_activity_marks (user_id);

grant select, insert, update, delete on public.coaching_activity_marks to authenticated;
grant all on public.coaching_activity_marks to service_role;

alter table public.coaching_activity_marks enable row level security;

-- Murid: baca catatan miliknya sendiri. Nggak ada policy tulis buat murid.
drop policy if exists "coaching_activity_marks select own" on public.coaching_activity_marks;
create policy "coaching_activity_marks select own"
  on public.coaching_activity_marks for select
  using (auth.uid() = user_id);

-- Admin: baca & tulis semua.
drop policy if exists "coaching_activity_marks admin all" on public.coaching_activity_marks;
create policy "coaching_activity_marks admin all"
  on public.coaching_activity_marks for all
  using (public.is_admin()) with check (public.is_admin());
