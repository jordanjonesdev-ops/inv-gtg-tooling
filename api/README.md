Auth-enabled Worker API (demo)

This folder contains a Cloudflare Worker example that exposes a small API backed by D1.

Setup

1. Create a D1 database in the Cloudflare dashboard and run the migrations in `api/migrations/`.
2. Set an `AUTH_SECRET` in the Worker environment (Dashboard or `wrangler secret put AUTH_SECRET`).
3. Fill `account_id` in `api/wrangler.toml` and use `wrangler` to deploy.

Auth endpoints

- `POST /api/auth/register` — body: `{ "username": "u", "password": "p" }` creates a user.
- `POST /api/auth/login` — body: `{ "username": "u", "password": "p" }` returns `{ "token": "..." }` on success.
- `GET /api/auth/verify` — header: `Authorization: Bearer <token>` verifies token.

Profile endpoints (protected)

- `GET /api/me/profile` — header: `Authorization: Bearer <token>` returns `{ profile }`.
- `POST /api/me/profile` — header: `Authorization: Bearer <token>`, body: `{ "display_name": "...", "avatar_url": "..." }` creates or updates the caller's profile.

Run the migration `api/migrations/003_profiles.sql` to create the `profiles` table.

Notes

- Passwords are hashed using PBKDF2 (100k iterations) and a random salt.
- Tokens are HMAC-SHA256 signed (JWT-like). Provide a secure `AUTH_SECRET` for production.
