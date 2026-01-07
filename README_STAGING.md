# Staging deploy (no Stripe)

Goal: get a working staging URL for the app (booking/admin/auth/email verification flow) **without** enabling real payments yet.

Recommended: **Railway (API + MySQL)** + **Vercel (Web)**.

## 0) Prep

- Push this repo to GitHub (Railway/Vercel both deploy from Git).
- Make sure new files are committed (examples: `scripts/predeploy-check.sh`, `apps/web/.env.example`, `apps/api/.env.example`).

## 1) Railway: create DB + API

### A) Create a Railway project

- Railway → New Project → Deploy from GitHub repo.

### B) Add MySQL

- Add → Database → MySQL.
- In the MySQL service, find the connection string/vars.

### C) Add API service

- Add → Service → GitHub repo.
- Set **Root Directory**: `apps/api`
- Build/Start: leave defaults (recommended) — `apps/api/nixpacks.toml` makes install/build/start explicit.

Note: `apps/api/nixpacks.toml` is included to make these steps explicit.

### D) Set API environment variables (staging)

Set these on the **API service**:

- Do NOT set `PORT` manually (Railway sets it)
- `NODE_ENV=staging` (recommended for staging until SendGrid is confirmed)
- `JWT_SECRET=<strong random>`
- `DATABASE_URL=<mysql connection string in Prisma format>`
- `APP_URL=<your Vercel staging URL>` (you’ll fill this after deploying the web)
- `CORS_ORIGIN=<your Vercel staging URL>`
- `REQUIRE_EMAIL_VERIFICATION=true`

Email (optional right now):
- If you already have SendGrid ready, also set:
  - `SENDGRID_API_KEY=...`
  - `SENDGRID_FROM_EMAIL=you@yourdomain.com` (or `SENDGRID_FROM`)

Notes:
- With `NODE_ENV=staging`, verification endpoints return a `devCode` when SendGrid isn’t set, so you can still complete verification.
- When you’re ready to enforce real email delivery, switch to `NODE_ENV=production` (then SendGrid must be configured).

### E) Deploy + verify

- Deploy the API service.
- Hit: `https://<your-railway-api-host>/api/health` and confirm it returns `{ ok: true }`.

## 2) Vercel: deploy the web

- Vercel → New Project → Import your GitHub repo.
- Set **Root Directory**: `apps/web`
- Framework: Vite (Vercel usually detects it)

Set environment variable (Production + Preview):
- `VITE_API_URL=https://<your-railway-api-host>`

Deploy.

## 3) Wire API back to the web URL

Now that Vercel gives you a URL like `https://something.vercel.app`:

- In Railway (API service), set:
  - `APP_URL=https://something.vercel.app`
  - `CORS_ORIGIN=https://something.vercel.app`
- Redeploy the API.

## 4) Staging smoke test

In the deployed web:

- Register a new account
  - If SendGrid isn’t configured, copy the `devCode` returned by the API and use it to verify.
- Login
- Create availability (admin)
- Book an appointment
- Cancel > 24h before start and confirm it becomes `REFUNDED` (refund simulation is OK until Stripe is enabled)

## If services are empty

If the site loads but no services appear, the database likely hasn’t been seeded yet.

Run these locally (do NOT paste your DB URL in chat):

```bash
cd /workspaces/Meechlocs/apps/api

export DATABASE_URL='PASTE_RAILWAY_MYSQL_URL_HERE'

npm run prisma:generate
npx prisma db push --schema=./prisma/schema.prisma
npm run seed

unset DATABASE_URL
```

## Stripe later

When you’re ready to enable payments for real, you’ll add:
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`

…and update Stripe webhook forwarding to the deployed API.
