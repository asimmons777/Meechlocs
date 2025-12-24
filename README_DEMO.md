Demo run & quick UI notes

This project is wired for local demo/testing. The following quick commands will start the API and frontend and let you simulate a checkout (no Stripe account required).

Bring up the DB + seed demo data (includes default availability blocks):

```bash
npm run db:up
npm run seed
```

Start API dev server (keep this terminal open):

```bash
cd apps/api
npm install
npm run dev
```

Start the web dev server (new terminal):

```bash
cd apps/web
npm install
npm run dev
```

Or run both with the convenience script from the repo root (requires bash):

```bash
npm run dev:all
```

This runs in detached mode and writes logs to:
- `tmp/api.dev.log`
- `tmp/web.dev.log`

To stop the dev servers:

```bash
kill "$(cat tmp/api-pid)" "$(cat tmp/web-pid)"
```

Simulate a checkout (creates appointment + fires a simulated webhook):

```bash
npm run simulate
```

Notes:
- Demo uses seeded accounts: `user@meechlocs.test` / `Passw0rd!` and `admin@meechlocs.test` / `Passw0rd!`.
- `npm run simulate` auto-picks the next available slot (no `jq` needed).
