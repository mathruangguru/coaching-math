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

## Isi

| File | |
| --- | --- |
| `schema.sql` | tabel `coaching_courses` / `coaching_course_sections` / `coaching_lessons` / `coaching_lesson_progress` + RLS |
| `seed.sql` | data awal PATOM (mirror `src/data/mock.js`) |

Kode klien: `src/lib/supabase.js` (client) dan `src/lib/courses.js` (`getCourses`, `getCourse`).
