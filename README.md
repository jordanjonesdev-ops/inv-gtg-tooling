# inv-gtg-tooling
A personal repository for building tooling related to invincible: Guarding the Globe mobile game.

## Monorepo layout

- `frontend/` — Cloudflare Pages static site (demo UI)
- `api/` — Cloudflare Worker API and D1 migrations
- `infra/` — CI and deployment helpers

Quick start

1. API (Workers + D1)

```bash
cd api
npm install
# run locally with wrangler
npx wrangler dev
```

2. Frontend (Cloudflare Pages)

- Connect this repository to Cloudflare Pages and set the build output directory to `frontend/`.

Notes

- Fill `account_id` in `api/wrangler.toml` and create a D1 database in the Cloudflare dashboard, then bind it to the `DB` binding.
- Store any secrets in Cloudflare dashboard or GitHub Actions secrets for CI deployments.

