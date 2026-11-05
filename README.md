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

## Important migration notes

1. This is a new Node backend and a new PostgreSQL schema. It does not automatically import the existing Django SQLite database.
2. Django password hashes cannot be verified by bcryptjs directly. Existing users need a password-reset flow or a separately planned one-time password migration.
3. Uploads are written to the local `uploads/` directory. For production hosting, mount persistent storage or change this to S3-compatible object storage. Do not rely on ephemeral server disk for user uploads.
4. Configure a persistent PostgreSQL service and automated backups for production.
5. The original Django admin interface is not recreated. Manage records through API/database tools or build an admin panel.
6. Real-time WebSockets are not included; messages are currently delivered through REST endpoints and polling.
7. Review and test every workflow against your frontend before replacing the Django service. This implementation preserves the principal route names and response shapes, but is not a byte-for-byte Django compatibility layer.
