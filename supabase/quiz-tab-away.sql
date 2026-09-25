-- Log "pindah tab" pas murid lagi ngerjain soal (muncul di admin: Hasil Soal
-- -> ikon jam -> Riwayat pengerjaan). Jalankan di SQL Editor Supabase
-- SETELAH quiz.sql + admin.sql. Aman dijalankan ulang.
--
-- Tiap kali murid ninggalin tab soal lalu balik lagi (>= 1 dtk), QuizPage
-- nyimpen SATU baris: berapa lama dia pergi. created_at (jam server) = saat
-- dia BALIK, jadi jam keluar = created_at - away_ms — semuanya di jam server,
-- sejajar dengan timestamp audit autosave, bukan jam HP/laptop murid.
--
-- Data dilaporkan browser murid, jadi bukan bukti kuat (bisa dimatikan /
-- dimanipulasi). Cuma menangkap pindah TAB/aplikasi yang bikin tab
-- tersembunyi; pindah jendela yang tab-nya tetap kelihatan nggak kehitung.
-- Nggak pakai FK ke users/set biar riwayatnya tetap ada walau salah satunya
-- dihapus (sama kayak coaching_quiz_progress_audit).

create table if not exists public.coaching_quiz_tab_aways (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid(),
  set_id     text not null,
  away_ms    int  not null check (away_ms >= 0 and away_ms <= 86400000),
  created_at timestamptz not null default now()
);

create index if not exists coaching_quiz_tab_aways_user_set_idx
  on public.coaching_quiz_tab_aways (user_id, set_id, created_at desc);

grant select, insert on public.coaching_quiz_tab_aways to authenticated;
grant all on public.coaching_quiz_tab_aways to service_role;

alter table public.coaching_quiz_tab_aways enable row level security;

-- Murid cuma boleh nulis catatan buat dirinya sendiri; nggak ada policy
-- select/update/delete buat murid (append-only).
drop policy if exists "coaching_quiz_tab_aways insert own" on public.coaching_quiz_tab_aways;
create policy "coaching_quiz_tab_aways insert own"
  on public.coaching_quiz_tab_aways for insert
  with check (auth.uid() = user_id);

drop policy if exists "coaching_quiz_tab_aways admin read" on public.coaching_quiz_tab_aways;
create policy "coaching_quiz_tab_aways admin read"
  on public.coaching_quiz_tab_aways for select
  using (public.is_admin());
