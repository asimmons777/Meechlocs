Local run & Stripe webhook steps (quick)

This file collects the exact commands to run the project locally, register Stripe webhooks, and perform the live Checkout verification.

Prereqs
- Node.js (v18+), npm
- Git (if cloning locally)
- Stripe CLI (or use `npx stripe ...`)

1) Clone (optional)

If you want a local copy on your Windows machine:

    # example path — adjust as needed
    mkdir C:\Projects
    cd C:\Projects
    git clone https://github.com/asimmons777/Meechlocs.git
    cd Meechlocs

2) Start backend (apps/api)

Open a PowerShell in the repo and run (keep this terminal open):

    cd .\apps\api
    npm install
    npm run dev
    # wait for: API listening on port 4000

3) Start frontend (apps/web)

Open another terminal:

    cd .\apps\web
    npm install
    npm run dev
    # open the Vite URL (usually http://localhost:5173)

4) Stripe CLI: authenticate & listen for webhooks

If you installed the Stripe CLI globally, run `stripe login`.
If you prefer not to install globally, you can use npx:

    # authenticate (opens browser)
    npx stripe login

    # in a separate terminal, start listening and forward to your local API
    npx stripe listen --forward-to http://localhost:4000/api/webhook

The command prints a webhook signing secret: copy the `whsec_...` string

Paste the `whsec_...` value into `apps/api/.env` as `STRIPE_WEBHOOK_SECRET`.

5) Add your Stripe test secret key (local only)

Edit `apps/api/.env` and set:

    STRIPE_SECRET_KEY=sk_test_xxx
    STRIPE_WEBHOOK_SECRET=whsec_xxx
    APP_URL=http://localhost:5173
    API_URL=http://localhost:4000

Restart the backend (if it was running) after updating `.env`.

6) Perform a real Checkout

- In the frontend, login as `user@meechlocs.test` / `Passw0rd!`.
- Book an available slot and continue to pay. On the Stripe Checkout page use the test card:
  - Card: `4242 4242 4242 4242`
  - CVC: `123`, Expiry: any future date

7) Verify webhook & saved card

- Watch the Stripe CLI window — it will show `checkout.session.completed` being delivered.
- In the backend logs you should see `Appointment confirmed: <id>`.
- Verify via API:

    # use the user token you got from login
    curl -s -H "Authorization: Bearer $TOKEN" http://localhost:4000/api/appointments | jq .
    curl -s -H "Authorization: Bearer $TOKEN" http://localhost:4000/api/payments/methods | jq .

8) Test refund (admin)

Use admin credentials `admin@meechlocs.test` / `Passw0rd!` and call:

    curl -s -X POST http://localhost:4000/api/admin/refund \
      -H "Authorization: Bearer <ADMIN_TOKEN>" \
      -H "Content-Type: application/json" \
      -d '{"appointmentId": <APPOINTMENT_ID>}' | jq .

Notes
- Do not paste secret keys publicly. Add them to `apps/api/.env` locally.
- If your backend runs in Docker and Stripe CLI is on Windows, use `http://host.docker.internal:4000/api/webhook` when running `stripe listen`.

If you want, paste the `whsec_...` string printed by `stripe listen` and I will (a) show the exact `sed`/`powershell` command to add it to `apps/api/.env` and (b) finish the verification steps here.
