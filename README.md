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
cp .env .env.local  # fill DATABASE_URL, JWT_SECRET, STRIPE keys if available
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

Stripe webhook (local testing)

- Option A: Use Stripe CLI (recommended) to forward webhooks to your local API:

```bash
stripe listen --forward-to localhost:4000/api/webhook
```

Then create a test Checkout session via the frontend and confirm webhook events are received.

- Option B: Use ngrok to expose your app and register the webhook URL in the Stripe dashboard.

SendGrid

- To send real confirmation emails, set `SENDGRID_API_KEY` and `SENDGRID_FROM` in `apps/api/.env`.

Image uploads

- Admin UI supports simple uploads which are saved to `apps/web/public/uploads` for demo.

Notes

- The demo uses JWTs in localStorage for auth; for production migrate to httpOnly cookies.
- For card-on-file and refunds, run a full Stripe E2E with the Stripe CLI so real PaymentIntents and payment methods are attached.
