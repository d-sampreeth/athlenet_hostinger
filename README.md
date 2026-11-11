# AthleNet Node.js Backend

Express + PostgreSQL replacement for the Django REST backend in the supplied AthleNet project.

## Included API routes

- `POST /api/auth/register/` and `POST /api/auth/login/`
- `POST /api/token/refresh/`
- `GET/PATCH /api/me/`
- `GET /api/dashboard/`, `/api/feed/`, `/api/local-hub/`
- `GET/POST /api/opportunities/`, `GET/POST /api/opportunities/:id/`
- `GET/POST /api/posts/`, `DELETE /api/posts/:id/`
- `POST /api/posts/:id/like/`, `GET/POST /api/posts/:id/comments/`
- `GET /api/users/`, `GET /api/users/:username/`, `POST /api/users/:username/follow/`
- `GET /api/connections/`, `/api/followers/`
- `GET /api/news/`, `/api/notifications/`, `POST /api/notifications/`
- `GET /api/search/`
- `GET/POST /api/conversations/`, `GET/POST /api/conversations/:id/messages/`

Trailing slashes are optional in Express.

The community feed accepts `source=all|interest|nearby|connections`, plus `page` and `limit`. `all` returns posts from all active users; `interest` matches profile interests and the user's player/coach sport; `nearby` prioritizes exact PIN code, locality, district, then state matches using available profile fields. `connections` shows posts from people the viewer follows, ordered by their distinct connected-user count, then coach, player, and community-member role, then post recency.

Run the backend integration tests against the PostgreSQL database configured in `.env`:

```powershell
npm test
```

The test starts a temporary API process, exercises the feed, profile, connection, like, and comment endpoints using isolated test accounts, then deletes those accounts. Use a test database rather than a production database.

## Requirements

- Node.js 20+
- PostgreSQL 14+

## Local setup (Windows PowerShell)

1. Install PostgreSQL and create a database named `athlenet`.
2. Copy `.env.example` to `.env` and edit `DATABASE_URL`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, and `FRONTEND_ORIGINS`.
3. Run:

```powershell
npm install
npm run dev
```

The server initializes the tables in `schema.sql` automatically on startup.

API base URL: `http://localhost:5000/api`
Health check: `http://localhost:5000/health`

## Connect the existing React frontend

In `frontend/.env` (or `.env.local`):

```env
VITE_API_URL=http://localhost:5000
```

The existing frontend `src/api.js` appends `/api` automatically when the configured URL does not already end with `/api`. Restart Vite after changing this value.

## Persistent user uploads

User-uploaded files are stored in the existing Supabase Storage project; keep its PostgreSQL `DATABASE_URL` unchanged. Configure these variables on the backend (for local development, in the ignored root `.env`; in production, in Hostinger's backend environment settings):

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-server-only-service-role-key
SUPABASE_MEDIA_BUCKET=athlenet-media
SUPABASE_DOCUMENTS_BUCKET=athlenet-documents
```

Never put the service-role key in frontend environment variables or commit it. The media bucket must allow public reads for profile photos, profile covers, post images, and opportunity images. The documents bucket can remain private; the API issues short-lived signed URLs for stored certificates and achievement proofs only to the document owner's profile response. Profile, cover, post, and opportunity images accept JPEG, PNG, GIF, or WebP; documents accept JPEG, PNG, WebP, or PDF. Profile photos are limited to 1 MB, and all files to 5 MB.

New database references are permanent Supabase public URLs for media and `supabase-storage://` object references for private documents. API responses also normalize `supabase-storage://athlenet-media/...` references into public URLs for post images, author/profile photos, profile covers, and opportunity images. Public image URLs do not expire; signed URLs are reserved for owner-authorized private documents. Profile-cover and opportunity image references use additive nullable/defaulted columns; startup applies the schema additions without altering existing rows. Existing `/media/...` references remain supported while their original files are available. The migration utility is dry-run by default; before applying it, make a database backup and ensure the original `uploads` directory is present on the same host as the target database:

The authenticated `GET /api/me/media/` endpoint lists the signed-in user's public post images from their own `<user-id>/image` storage folder. The profile's “Your uploaded images” gallery uses this endpoint; the service-role key remains on the backend, and users cannot list another account's folder.

```powershell
npm run migrate:uploads
npm run migrate:uploads -- --apply
```

The migration uploads verified files and updates only matching database references; it never deletes the original files. A dry run reports missing and unsupported files. Run it against the production database only from the host that still has the corresponding original uploads, after taking backups.

## Important migration notes

1. This is a new Node backend and a new PostgreSQL schema. It does not automatically import the existing Django SQLite database.
2. Django password hashes cannot be verified by bcryptjs directly. Existing users need a password-reset flow or a separately planned one-time password migration.
3. New user uploads are stored in Supabase Storage. Legacy `/media/...` files are still served from `uploads/` until migrated; run the documented dry-run migration and preserve a backup before applying it on the host that has the original files.
4. Configure a persistent PostgreSQL service and automated backups for production.
5. The original Django admin interface is not recreated. Manage records through API/database tools or build an admin panel.
6. Real-time WebSockets are not included; messages are currently delivered through REST endpoints and polling.
7. Review and test every workflow against your frontend before replacing the Django service. This implementation preserves the principal route names and response shapes, but is not a byte-for-byte Django compatibility layer.
