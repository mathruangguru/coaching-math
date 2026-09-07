-- Gambar materi: di-upload lewat editor kurikulum, disimpen di storage.
-- Jalankan di SQL Editor Supabase SETELAH admin.sql (butuh public.is_admin())
-- dan feedback.sql (biar constraint tipe lesson di sini yang terakhir).
-- Aman dijalankan ulang.

-- ── Tipe lesson baru 'image' ──────────────────────────────────────────
alter table public.coaching_lessons drop constraint if exists coaching_lessons_type_check;
alter table public.coaching_lessons
  add constraint coaching_lessons_type_check
    check (type in ('materi', 'soal', 'meet', 'recording', 'slide', 'pdf',
                    'form', 'presensi', 'refleksi', 'feedback', 'image'));

-- Murid boleh download gambarnya atau nggak (admin yang set). Default
-- true = boleh. Cuma relevan buat lesson tipe 'image'.
alter table public.coaching_lessons
  add column if not exists allow_download boolean not null default true;

-- ── Storage bucket (publik-read, kayak lesson-files buat PDF) ──────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('lesson-images', 'lesson-images', true, 10485760,
        array['image/png', 'image/jpeg', 'image/webp', 'image/gif'])
on conflict (id) do update
  set public = true,
      file_size_limit = 10485760,
      allowed_mime_types = array['image/png', 'image/jpeg', 'image/webp', 'image/gif'];

-- Semua yang login boleh baca; cuma admin yang upload / ganti / hapus.
drop policy if exists "lesson-images read" on storage.objects;
create policy "lesson-images read"
  on storage.objects for select
  using (bucket_id = 'lesson-images');

drop policy if exists "lesson-images admin insert" on storage.objects;
create policy "lesson-images admin insert"
  on storage.objects for insert
  with check (bucket_id = 'lesson-images' and public.is_admin());

drop policy if exists "lesson-images admin update" on storage.objects;
create policy "lesson-images admin update"
  on storage.objects for update
  using (bucket_id = 'lesson-images' and public.is_admin())
  with check (bucket_id = 'lesson-images' and public.is_admin());

drop policy if exists "lesson-images admin delete" on storage.objects;
create policy "lesson-images admin delete"
  on storage.objects for delete
  using (bucket_id = 'lesson-images' and public.is_admin());
