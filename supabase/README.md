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

## Admin (edit course)

1. **SQL Editor** → jalankan `admin.sql` (setelah `schema.sql`). Ini bikin:
   - tabel `coaching_profiles` (`role`: `student` | `admin`) + trigger auto-buat
     profile tiap ada user baru
   - fungsi `is_admin()` + write policy admin-only untuk
     `coaching_courses` / `_sections` / `_lessons`
2. **Authentication → Users → Add user** → isi email + password,
   centang **Auto Confirm User**.
3. Balik ke **SQL Editor**, jalankan (ganti email):
   ```sql
   update public.coaching_profiles set role = 'admin'
     where email = 'kamu@contoh.com';
   ```
4. Buka `/admin/login` di app, masuk pakai user tadi. Halaman `/admin`
   cuma kebuka buat `role = 'admin'`; user lain kena "Akses ditolak".

> Anon (pengunjung) tetap cuma bisa **baca** katalog. Write dijaga RLS —
> tanpa session admin, `insert`/`update`/`delete` ditolak Postgres.

## Isi

| File | |
| --- | --- |
| `schema.sql` | tabel `coaching_courses` / `coaching_course_sections` / `coaching_lessons` / `coaching_lesson_progress` + RLS + grant baca |
| `admin.sql` | `coaching_profiles` + role, `is_admin()`, write policy admin-only |
| `seed.sql` | data awal PATOM (mirror `src/data/mock.js`) |

Kode klien: `src/lib/supabase.js` (client), `src/lib/courses.js`
(`getCourses`, `getCourse`, `createCourse`, `updateCourse`, `deleteCourse`),
`src/lib/auth.js` + `src/context/AuthProvider.jsx` (session & role).
