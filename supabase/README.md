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
2. **Deploy Edge Function `admin-users`** (lihat bagian bawah) — dipakai
   buat create / set-password / delete user.
3. **Authentication → Providers → Email**:
   - **"Confirm email" → OFF** (user bikinan admin bisa langsung login)
   - "Allow new users to sign up" boleh **OFF** — bikin user lewat Admin
     API di Edge Function, bukan `signUp` publik.
4. **Authentication → Users → Add user** → email + password, centang
   **Auto Confirm User**. Ini calon admin pertama.
4. **SQL Editor**, jalankan (ganti email):
   ```sql
   update public.coaching_profiles set role = 'admin'
     where email = 'kamu@contoh.com';
   ```
5. Buka `/login`, masuk. Admin lihat menu **Admin** di sidebar.

### Kelola user — `/admin/users`

- **Buat user**: nama depan/belakang, email, password, role. Lewat Admin
  API di Edge Function `admin-users` → **nggak kirim email** (nggak kena
  rate limit), sesi admin nggak keganti.
- **Ganti role** dari daftar. Admin nggak bisa nurunin role sendiri.
- **Set password** user (kasus lupa) → tombol di tiap baris.
- **Hapus user** → tombol di tiap baris. Profile & progress ikut kehapus
  (cascade). Nggak bisa hapus akun sendiri.

Tiga yang terakhir butuh Edge Function `admin-users` ke-deploy.

### Profil (semua user) — `/profile`

User bisa ganti nama depan/belakang & password sendiri. Nama diproteksi
RLS "update own"; kolom `role` dijaga trigger `guard_profile_role` biar
user biasa nggak bisa naikin dirinya jadi admin. Ganti password sendiri
pakai `supabase.auth.updateUser` (nggak butuh Edge Function).

### Edge Function: `admin-users`

Create / set-password / delete user butuh `service_role` → nggak boleh di
frontend. Satu function, `action`-based (`create` | `set_password` |
`delete`); di dalamnya dicek caller = admin.

Project ref: `fvepworawhlsghsjhsca` (bukan rahasia — subdomain URL Supabase).

```bash
supabase login
supabase link --project-ref fvepworawhlsghsjhsca   # sekali aja
supabase functions deploy admin-users
```

`verify_jwt = false` udah diset di `supabase/config.toml` — tanpa itu,
preflight CORS (OPTIONS) dari browser ditolak 401 dan app dapat
`FunctionsFetchError`. Auth tetap aman: function-nya sendiri cek
`caller.auth.getUser()` + `role = 'admin'`.
(Deploy via dashboard paste: matikan toggle **Verify JWT** di tab Settings.)

Atau paste `supabase/functions/admin-users/index.ts` di
**Dashboard → Edge Functions → Deploy a new function** (nama: `admin-users`).
`SUPABASE_URL` / `SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY`
di-inject otomatis — nggak perlu set secret. Sebelum di-deploy, tombol
buat/set-password/hapus di `/admin/users` akan error.

## Isi

| File | |
| --- | --- |
| `schema.sql` | tabel `coaching_courses` / `coaching_course_sections` / `coaching_lessons` / `coaching_lesson_progress` + RLS + grant baca |
| `admin.sql` | `coaching_profiles` (+ nama, role), `is_admin()`, policy profile & write admin-only, trigger guard role |
| `seed.sql` | data awal PATOM (mirror `src/data/mock.js`) |
| `functions/admin-users/` | Edge Function: admin create / set-password / delete user |

Kode klien: `src/lib/supabase.js` (client), `src/lib/courses.js`
(`getCourses`, `getCourse`, `createCourse`, `updateCourse`, `deleteCourse`),
`src/lib/users.js` (`getUsers`, `createUser`, `setUserRole`, `setUserPassword`, `deleteUser`),
`src/lib/profile.js` (`updateMyProfile`, `changeMyPassword`),
`src/lib/auth.js` + `src/context/AuthProvider.jsx` (session, role, `refreshProfile`).
