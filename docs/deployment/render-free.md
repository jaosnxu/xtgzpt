# Render Free Deployment

## Purpose

This deployment path is for a free remote demo of the current xtgzpt prototype.
It is not the final production hosting plan.

## Deployment Model

- Platform: Render
- Config file: `render.yaml`
- Runtime: one Node web service
- Frontend: `apps/web/dist`, served by the Fastify API when `XTGZPT_SERVE_WEB=true`
- API: Fastify routes on the same host
- Database: Render Free Postgres through `DATABASE_URL`

## Deploy Link

Use this link while the deployment config is still on the feature branch:

https://render.com/deploy?repo=https://github.com/jaosnxu/xtgzpt/tree/loop/dev-024-frontend-module-productionization

After the PR is merged, use the main branch repository link:

https://render.com/deploy?repo=https://github.com/jaosnxu/xtgzpt

## Expected Render Resources

The Blueprint creates:

- `xtgzpt`: free Node web service in Frankfurt
- `xtgzpt-db`: free Render Postgres database in Frankfurt

## Commands

Build command:

```bash
npm ci --include=dev && VITE_API_BASE_URL= npm run build
```

Start command:

```bash
npm run start:dist -w @xtgzpt/api
```

## Required Environment

The Blueprint defines:

- `NODE_ENV=production`
- `NODE_VERSION=24.14.1`
- `HOST=0.0.0.0`
- `XTGZPT_SERVE_WEB=true`
- `XTGZPT_RUNTIME_STORE_MODE=postgres`
- `DATABASE_URL` from `xtgzpt-db`

## Verification

After Render finishes deploying:

1. Open the Render service URL.
2. Confirm `/health` returns `status: ok`.
3. Log in with `admin / 113113`.
4. Open dashboard, projects, tasks, chat, knowledge, contracts, approvals, and settings.

Run the remote API smoke against the deployed URL:

```bash
SMOKE_BASE_URL="https://<render-service-url>" npm run smoke:api
```

The remote smoke uses the same account set as local smoke and verifies login, projects, tasks, chat, files, AI drafts, knowledge, contracts, approvals, permission gates, audit records, and AI source reuse.

## Free Tier Limits

- Free web service can spin down after idle time and needs time to wake up.
- Free web service filesystem is ephemeral.
- Free Render Postgres expires after the free database lifetime, so it is not for long-term production data.
