# Supabase

Backend untuk coaching-math: Postgres + REST API otomatis + Auth, gratis tier.
Frontend (GitHub Pages) manggil lewat `@supabase/supabase-js`.

## Setup (sekali)

1. **Buat project** di <https://supabase.com> → region **Southeast Asia (Singapore)**.
2. **SQL Editor** → jalankan `schema.sql`, lalu `seed.sql`.
3. **Project Settings → API** → salin:
   - `Project URL` → `VITE_SUPABASE_URL`
   - `anon` `public` key → `VITE_SUPABASE_ANON_KEY`
4. Di root project:
   ```bash
   cp .env.example .env
   # isi kedua nilai di atas
   npm run dev
   ```
   Kalau `.env` belum diisi, app otomatis fallback ke data mock (`src/data/mock.js`).

## Deploy (GitHub Pages)

Build jalan di GitHub Actions, jadi `.env` lokal nggak kepakai. Set di repo:
**Settings → Secrets and variables → Actions → Variables**

| Name | Value |
| --- | --- |
| `VITE_SUPABASE_URL` | Project URL |
| `VITE_SUPABASE_ANON_KEY` | anon public key |

Lalu di `.github/workflows/deploy.yml`, step **Build** dikasih env:

```yaml
      - name: Build
        run: npm run build
        env:
          VITE_SUPABASE_URL: ${{ vars.VITE_SUPABASE_URL }}
          VITE_SUPABASE_ANON_KEY: ${{ vars.VITE_SUPABASE_ANON_KEY }}
```

> `anon` key memang dirancang untuk dipakai di frontend — datanya diproteksi
> Row Level Security (lihat `schema.sql`). Jangan pernah pakai `service_role` key di frontend.

## Auth & Admin

Seluruh app butuh login (buka `/` tanpa sesi → lempar ke `/login`).
Katalog tetap bisa dibaca `anon` di level DB, tapi UI-nya di balik login.

### Setup sekali

1. **SQL Editor** → jalankan `admin.sql` (setelah `schema.sql`). Bikin:
   - `coaching_profiles` (`role`: `student` | `admin`) + trigger auto-buat
     profile tiap ada user baru
   - `is_admin()` + policy: admin bisa baca/ubah semua profile, dan
     write admin-only untuk `coaching_courses` / `_sections` / `_lessons`
2. **Authentication → Providers → Email**:
   - **"Confirm email" → OFF** (user bikinan admin bisa langsung login)
   - "Allow new users to sign up" → **ON** (halaman `/admin/users` bikin
     user lewat `signUp` dari client)
3. **Authentication → Users → Add user** → email + password, centang
   **Auto Confirm User**. Ini calon admin pertama.
4. **SQL Editor**, jalankan (ganti email):
   ```sql
   update public.coaching_profiles set role = 'admin'
     where email = 'kamu@contoh.com';
   ```
5. Buka `/login`, masuk. Admin lihat menu **Admin** di sidebar.

### Bikin user berikutnya

Dari `/admin/users`: isi nama depan, nama belakang, email, password, role.
Dibuat lewat client Supabase terisolasi (`src/lib/users.js`), jadi sesi
admin nggak keganti. Nama masuk ke `coaching_profiles` (via user metadata +
di-`update` ulang biar pasti).

- **Ganti role** dari daftar user. Admin nggak bisa nurunin role sendiri.
- **Set password** user (kasus lupa) → tombol di tiap baris. Butuh Edge
  Function `admin-set-password` (lihat bawah).

### Profil (semua user) — `/profile`

User bisa ganti nama depan/belakang & password sendiri. Nama diproteksi
RLS "update own"; kolom `role` dijaga trigger `guard_profile_role` biar
user biasa nggak bisa naikin dirinya jadi admin. Ganti password sendiri
pakai `supabase.auth.updateUser` (nggak butuh Edge Function).

### Edge Function: `admin-set-password`

Set password user **lain** butuh `service_role` → nggak boleh di frontend.
Deploy function-nya:

```bash
supabase login
supabase link --project-ref <PROJECT_REF>
supabase functions deploy admin-set-password
```

Atau paste `supabase/functions/admin-set-password/index.ts` di
**Dashboard → Edge Functions → Deploy a new function**.
`SUPABASE_URL` / `SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY`
di-inject otomatis — nggak perlu set secret. Sebelum di-deploy, tombol
"Set password" akan error (fungsinya belum ada).

> **Masih manual:** hard-delete user (butuh `service_role` juga).

## Isi

| File | |
| --- | --- |
| `schema.sql` | tabel `coaching_courses` / `coaching_course_sections` / `coaching_lessons` / `coaching_lesson_progress` + RLS + grant baca |
| `admin.sql` | `coaching_profiles` (+ nama, role), `is_admin()`, policy profile & write admin-only, trigger guard role |
| `seed.sql` | data awal PATOM (mirror `src/data/mock.js`) |
| `functions/admin-set-password/` | Edge Function: admin set password user lain |

Kode klien: `src/lib/supabase.js` (client), `src/lib/courses.js`
(`getCourses`, `getCourse`, `createCourse`, `updateCourse`, `deleteCourse`),
`src/lib/users.js` (`getUsers`, `createUser`, `setUserRole`, `setUserPassword`),
`src/lib/profile.js` (`updateMyProfile`, `changeMyPassword`),
`src/lib/auth.js` + `src/context/AuthProvider.jsx` (session, role, `refreshProfile`).
