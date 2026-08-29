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

Dari `/admin/users`: isi email + password + role. Dibuat lewat client
Supabase terisolasi (`src/lib/users.js`), jadi sesi admin nggak keganti.

> **Batas:** hard-delete user butuh `service_role` (Edge Function) — belum ada.
> Role bisa diubah dari `/admin/users`; admin nggak bisa menurunkan role
> dirinya sendiri (cegah kekunci).

## Isi

| File | |
| --- | --- |
| `schema.sql` | tabel `coaching_courses` / `coaching_course_sections` / `coaching_lessons` / `coaching_lesson_progress` + RLS + grant baca |
| `admin.sql` | `coaching_profiles` + role, `is_admin()`, policy profile & write admin-only |
| `seed.sql` | data awal PATOM (mirror `src/data/mock.js`) |

Kode klien: `src/lib/supabase.js` (client), `src/lib/courses.js`
(`getCourses`, `getCourse`, `createCourse`, `updateCourse`, `deleteCourse`),
`src/lib/users.js` (`getUsers`, `createUser`, `setUserRole`),
`src/lib/auth.js` + `src/context/AuthProvider.jsx` (session & role).
