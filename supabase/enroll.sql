-- Enrollment murid ke course. Jalankan di SQL Editor Supabase
-- SETELAH schema.sql + admin.sql. Aman dijalankan ulang.

create table if not exists public.coaching_enrollments (
  user_id    uuid not null references auth.users (id) on delete cascade,
  course_id  text not null references public.coaching_courses (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, course_id)
);

grant select, insert, delete on public.coaching_enrollments to authenticated;

alter table public.coaching_enrollments enable row level security;

-- ── Passcode enroll (opsional, per course) ─────────────────────────
-- Passcode disimpan terpisah dari katalog `coaching_courses` (yang
-- select-nya publik) supaya nilainya nggak pernah kebaca murid.
create table if not exists public.coaching_course_secrets (
  course_id       text primary key
                  references public.coaching_courses (id) on delete cascade,
  enroll_passcode text
);

grant select, insert, update, delete on public.coaching_course_secrets to authenticated;
grant all on public.coaching_course_secrets to service_role;

alter table public.coaching_course_secrets enable row level security;

drop policy if exists "coaching_course_secrets admin" on public.coaching_course_secrets;
create policy "coaching_course_secrets admin"
  on public.coaching_course_secrets for all
  using (public.is_admin()) with check (public.is_admin());

-- true kalau course butuh passcode buat enroll. Nggak bocorin nilainya.
create or replace function public.course_enroll_locked(p_course_id text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.coaching_course_secrets s
    where s.course_id = p_course_id
      and btrim(coalesce(s.enroll_passcode, '')) <> ''
  );
$$;

revoke all on function public.course_enroll_locked(text) from public;
grant execute on function public.course_enroll_locked(text) to authenticated;

-- Enroll diri sendiri. Kalau course-nya pakai passcode, wajib cocok
-- (case-insensitive, di-trim). Idempoten — enroll ulang aman.
create or replace function public.enroll_course(p_course_id text, p_passcode text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid  uuid := auth.uid();
  v_pass text;
begin
  if v_uid is null then
    raise exception 'BELUM_LOGIN';
  end if;

  if not exists (select 1 from public.coaching_courses where id = p_course_id) then
    raise exception 'COURSE_TIDAK_ADA';
  end if;

  select nullif(btrim(enroll_passcode), '') into v_pass
  from public.coaching_course_secrets where course_id = p_course_id;

  if v_pass is not null
     and lower(btrim(coalesce(p_passcode, ''))) <> lower(v_pass) then
    raise exception 'PASSCODE_SALAH';
  end if;

  insert into public.coaching_enrollments (user_id, course_id)
  values (v_uid, p_course_id)
  on conflict do nothing;
end;
$$;

revoke all on function public.enroll_course(text, text) from public;
grant execute on function public.enroll_course(text, text) to authenticated;

-- ── RLS ───────────────────────────────────────────────────────────
-- Baca / batalin enroll: punya sendiri, atau admin.
drop policy if exists "coaching_enrollments own" on public.coaching_enrollments;
drop policy if exists "coaching_enrollments select own" on public.coaching_enrollments;
create policy "coaching_enrollments select own"
  on public.coaching_enrollments for select
  using (auth.uid() = user_id or public.is_admin());

drop policy if exists "coaching_enrollments delete own" on public.coaching_enrollments;
create policy "coaching_enrollments delete own"
  on public.coaching_enrollments for delete
  using (auth.uid() = user_id or public.is_admin());

-- Insert: admin bebas; murid cuma boleh self-enroll ke course TANPA
-- passcode (yang pakai passcode wajib lewat enroll_course()).
drop policy if exists "coaching_enrollments insert" on public.coaching_enrollments;
create policy "coaching_enrollments insert"
  on public.coaching_enrollments for insert
  with check (
    public.is_admin()
    or (auth.uid() = user_id and not public.course_enroll_locked(course_id))
  );

-- Admin baca semua (dipertahankan; select-own di atas sudah mencakup).
drop policy if exists "coaching_enrollments admin read" on public.coaching_enrollments;
