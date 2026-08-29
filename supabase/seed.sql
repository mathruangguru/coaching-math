-- Data awal: course PATOM (sama persis dengan src/data/mock.js).
-- Jalankan SETELAH schema.sql, di SQL Editor Supabase.

insert into public.coaching_courses (id, title, description, icon) values
  ('patom-mtk-2627-1', 'PATOM Matematika 26/27 - 1',
   'Pathway to Mastery Matematika 2026/2027 Term 1', 'sigma')
on conflict (id) do nothing;

insert into public.coaching_course_sections (id, course_id, title, position) values
  ('p1', 'patom-mtk-2627-1', 'Pertemuan 1 — Bilangan & Operasi Dasar', 1),
  ('p2', 'patom-mtk-2627-1', 'Pertemuan 2 — Aljabar: Bentuk & Persamaan Linear', 2),
  ('p3', 'patom-mtk-2627-1', 'Pertemuan 3 — Perbandingan & Aritmetika Sosial', 3)
on conflict (id) do nothing;

insert into public.coaching_lessons (id, section_id, type, title, duration, position) values
  ('p1-1', 'p1', 'recording', 'Sistem bilangan real & garis bilangan',            '12 mnt',     1),
  ('p1-2', 'p1', 'materi',   'Rangkuman: sifat operasi & urutan pengerjaan',     '5 mnt baca', 2),
  ('p1-3', 'p1', 'soal',     'Latihan: operasi campuran, KPK & FPB',             '10 soal',    3),
  ('p1-4', 'p1', 'soal',     'Kuis Pertemuan 1',                                 '8 soal',     4),
  ('p2-1', 'p2', 'recording', 'Bentuk aljabar: suku, variabel, dan koefisien',    '15 mnt',     1),
  ('p2-2', 'p2', 'recording', 'Menyelesaikan persamaan linear satu variabel',     '18 mnt',     2),
  ('p2-3', 'p2', 'materi',   'Contoh soal cerita persamaan linear',              '6 mnt baca', 3),
  ('p2-4', 'p2', 'soal',     'Latihan: persamaan & pertidaksamaan linear',       '12 soal',    4),
  ('p2-5', 'p2', 'soal',     'Kuis Pertemuan 2',                                 '10 soal',    5),
  ('p3-1', 'p3', 'recording', 'Perbandingan senilai & berbalik nilai',            '14 mnt',     1),
  ('p3-2', 'p3', 'materi',   'Untung, rugi, diskon, bruto–neto–tara',            '7 mnt baca', 2),
  ('p3-3', 'p3', 'soal',     'Latihan: skala, perbandingan & aritmetika sosial', '10 soal',    3),
  ('p3-4', 'p3', 'soal',     'Kuis Pertemuan 3',                                 '10 soal',    4)
on conflict (id) do nothing;
