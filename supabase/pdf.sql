-- Storage buat PDF materi (di-upload lewat editor kurikulum).
-- Jalankan di SQL Editor Supabase SETELAH admin.sql (butuh public.is_admin()).
-- Aman diulang.

-- Bucket publik-read: URL PDF bisa langsung dipasang di <iframe> tanpa signed URL.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('lesson-files', 'lesson-files', true, 52428800, array['application/pdf'])
on conflict (id) do update
  set public = true,
      file_size_limit = 52428800,
      allowed_mime_types = array['application/pdf'];

-- Semua yang login boleh baca; cuma admin yang upload / ganti / hapus.
drop policy if exists "lesson-files read" on storage.objects;
create policy "lesson-files read"
  on storage.objects for select
  using (bucket_id = 'lesson-files');

drop policy if exists "lesson-files admin insert" on storage.objects;
create policy "lesson-files admin insert"
  on storage.objects for insert
  with check (bucket_id = 'lesson-files' and public.is_admin());

drop policy if exists "lesson-files admin update" on storage.objects;
create policy "lesson-files admin update"
  on storage.objects for update
  using (bucket_id = 'lesson-files' and public.is_admin())
  with check (bucket_id = 'lesson-files' and public.is_admin());

drop policy if exists "lesson-files admin delete" on storage.objects;
create policy "lesson-files admin delete"
  on storage.objects for delete
  using (bucket_id = 'lesson-files' and public.is_admin());
