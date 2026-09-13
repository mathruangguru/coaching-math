-- Ngunci coaching_quiz_progress.started_at + audit trail perubahannya.
-- Latar belakang: kolom itu dasar perhitungan durasi pengerjaan kuis
-- (quiz-submit), tapi RLS "coaching_quiz_progress own" ngasih user login
-- akses insert/update/delete penuh ke barisnya sendiri (perlu buat
-- autosave draft) -- itu juga berarti secara teknis started_at bisa
-- di-reset lewat panggilan API langsung (di luar UI), bikin durasi
-- kebaca ~0 detik walau jawabannya beneran dikerjain lama.
--
-- Jalankan di SQL Editor Supabase SETELAH quiz.sql. Aman dijalankan ulang.

-- ── Kunci started_at ──────────────────────────────────────────────────
-- INSERT: started_at selalu jam server SEKARANG, nggak peduli apa yang
--         dikirim client (nutup jalur "insert baris baru dgn started_at
--         yang dimundurin/dimajuin manual").
-- UPDATE: started_at TETEP nilai lama, nggak peduli apa yang dikirim
--         client (autosave / saveQuizDraft cuma pernah nulis
--         answers + updated_at, jadi ini nggak ganggu alur normal).
create or replace function public.guard_quiz_progress_started_at()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    new.started_at := now();
  elsif tg_op = 'UPDATE' then
    new.started_at := old.started_at;
  end if;
  return new;
end;
$$;

drop trigger if exists guard_quiz_progress_started_at on public.coaching_quiz_progress;
create trigger guard_quiz_progress_started_at
  before insert or update on public.coaching_quiz_progress
  for each row
  execute function public.guard_quiz_progress_started_at();

-- ── Audit trail ────────────────────────────────────────────────────────
-- Nyatet tiap insert/update/delete ke coaching_quiz_progress: isi baris +
-- siapa yang ngelakuin (auth.uid(), null kalau lewat service_role / Edge
-- Function) + kapan. Nggak nge-reference user_id/set_id (sengaja) biar
-- baris audit tetep ada walau user/set-nya udah kehapus.
create table if not exists public.coaching_quiz_progress_audit (
  id         uuid primary key default gen_random_uuid(),
  op         text not null check (op in ('INSERT', 'UPDATE', 'DELETE')),
  user_id    uuid,
  set_id     text,
  started_at timestamptz,
  answers    jsonb,
  updated_at timestamptz,
  actor      uuid,       -- auth.uid() pas perubahan terjadi; null = service_role (mis. quiz-submit)
  logged_at  timestamptz not null default now()
);
create index if not exists coaching_quiz_progress_audit_key_idx
  on public.coaching_quiz_progress_audit (user_id, set_id, logged_at desc);

-- security definer: trigger ini WAJIB bisa nulis ke tabel audit walau
-- yang ngetrigger cuma murid biasa (RLS tabel audit cuma buka baca buat
-- admin) -- kalau nggak definer, insert audit-nya ke-block RLS dan
-- operasi aslinya (mis. autosave) ikut gagal.
create or replace function public.log_quiz_progress_change()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    insert into public.coaching_quiz_progress_audit
      (op, user_id, set_id, started_at, answers, updated_at, actor)
    values ('DELETE', old.user_id, old.set_id, old.started_at, old.answers, old.updated_at, auth.uid());
    return old;
  else
    insert into public.coaching_quiz_progress_audit
      (op, user_id, set_id, started_at, answers, updated_at, actor)
    values (tg_op, new.user_id, new.set_id, new.started_at, new.answers, new.updated_at, auth.uid());
    return new;
  end if;
end;
$$;

drop trigger if exists log_quiz_progress_change on public.coaching_quiz_progress;
create trigger log_quiz_progress_change
  after insert or update or delete on public.coaching_quiz_progress
  for each row
  execute function public.log_quiz_progress_change();

-- ── Grants & RLS tabel audit ─────────────────────────────────────────
grant select on public.coaching_quiz_progress_audit to authenticated;
grant all on public.coaching_quiz_progress_audit to service_role;

alter table public.coaching_quiz_progress_audit enable row level security;

drop policy if exists "coaching_quiz_progress_audit admin read" on public.coaching_quiz_progress_audit;
create policy "coaching_quiz_progress_audit admin read"
  on public.coaching_quiz_progress_audit for select
  using (public.is_admin());
