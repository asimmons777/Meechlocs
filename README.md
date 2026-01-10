# Meechlocs (Booking App)

Local dev quickstart

1. Start the database and Adminer:

```bash
docker compose up -d
```

2. Backend (API):

```bash
cd apps/api
npm install
cp .env.example .env  # fill DATABASE_URL, JWT_SECRET, (optional) Stripe/SendGrid
npm run dev
```

3. Frontend (web):

```bash
cd apps/web
npm install
npm run dev
```

Admin seed credentials (from the seeded data):
- admin: `admin@meechlocs.test` / `Passw0rd!`
- user: `user@meechlocs.test` / `Passw0rd!`

If the user account isn't present, you can create it with:

```bash
cd apps/api
npm run seed-demo-user
```

Stripe webhook (local testing)

- Option A: Use Stripe CLI (recommended) to forward webhooks to your local API:

```bash
stripe listen --forward-to localhost:4000/api/webhook
```

Then create a test Checkout session via the frontend and confirm webhook events are received.

- Option B: Use ngrok to expose your app and register the webhook URL in the Stripe dashboard.

SendGrid

- To send real verification/confirmation emails, set `SENDGRID_API_KEY` and a sender (`SENDGRID_FROM` or `SENDGRID_FROM_EMAIL`) in `apps/api/.env`.

Image uploads

- Admin UI supports uploads which are stored by the API and served from `/uploads`.

Notes

- The demo uses JWTs in localStorage for auth; for production migrate to httpOnly cookies.
- For card-on-file and refunds, run a full Stripe E2E with the Stripe CLI so real PaymentIntents and payment methods are attached.

Production deploy checklist (Vercel + Railway)

1) Web URL + CORS
- Pick a stable web URL (custom domain recommended).
- Set API env: `APP_URL` to the web URL and `CORS_ORIGIN` to the exact origin (or comma-separated origins).
- Avoid `CORS_ORIGIN='*'` in production.

2) Database schema
- Run Prisma schema apply against the production DB (e.g. `npx prisma db push`).

3) Email (required for production)
- Configure SendGrid (`SENDGRID_API_KEY` + sender `SENDGRID_FROM_EMAIL`/`SENDGRID_FROM`).
- Keep `REQUIRE_EMAIL_VERIFICATION=true`.

4) Stripe
- Set API env: `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET`.
- Stripe webhook endpoint URL must point to `/api/webhook` on the API deployment.

5) Demo/test flags
- Remove or set `ALLOW_DEMO_CONTENT=false` before launch.

See also: README_STAGING.md and README_RUN_LOCAL.md.
