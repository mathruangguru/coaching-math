-- Pengelompokan jawaban isian (refleksi / feedback / form) oleh admin.
-- Jalankan di SQL Editor Supabase SETELAH forms.sql + admin.sql. Aman diulang.
--
-- Tema didefinisikan per (lesson, field pertanyaan isian). Satu jawaban
-- murid boleh masuk BANYAK tema. Murni alat bantu admin -- murid nggak
-- pernah lihat / nyentuh ini (RLS admin-only).

-- ── Tables ─────────────────────────────────────────────────────────

create table if not exists public.coaching_form_answer_groups (
  id         uuid primary key default gen_random_uuid(),
  lesson_id  text not null references public.coaching_lessons (id) on delete cascade,
  field_id   text not null references public.coaching_form_fields (id) on delete cascade,
  name       text not null,
  position   int  not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists coaching_form_answer_groups_key_idx
  on public.coaching_form_answer_groups (lesson_id, field_id, position);

-- Tag: jawaban <response_id> untuk field tema-nya <group_id> masuk ke tema itu.
-- field_id nggak perlu disimpan -- udah ketentu dari group.
create table if not exists public.coaching_form_answer_group_tags (
  group_id    uuid not null references public.coaching_form_answer_groups (id) on delete cascade,
  response_id uuid not null references public.coaching_form_responses (id) on delete cascade,
  primary key (group_id, response_id)
);
create index if not exists coaching_form_answer_group_tags_resp_idx
  on public.coaching_form_answer_group_tags (response_id);

-- ── Grants ─────────────────────────────────────────────────────────

grant select, insert, update, delete on public.coaching_form_answer_groups     to authenticated;
grant select, insert, delete         on public.coaching_form_answer_group_tags to authenticated;
grant all on public.coaching_form_answer_groups     to service_role;
grant all on public.coaching_form_answer_group_tags to service_role;

-- ── RLS ────────────────────────────────────────────────────────────

alter table public.coaching_form_answer_groups     enable row level security;
alter table public.coaching_form_answer_group_tags enable row level security;

drop policy if exists "form_answer_groups admin" on public.coaching_form_answer_groups;
create policy "form_answer_groups admin"
  on public.coaching_form_answer_groups for all
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists "form_answer_group_tags admin" on public.coaching_form_answer_group_tags;
create policy "form_answer_group_tags admin"
  on public.coaching_form_answer_group_tags for all
  using (public.is_admin()) with check (public.is_admin());
