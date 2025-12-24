# Frontend (apps/web)

To run the frontend locally:

1. cd `apps/web`
2. Install dependencies: `npm install`
3. Start dev server: `npm run dev`

The frontend reads the API URL from `VITE_API_URL` in `.env.development` (default `http://localhost:4000`).

Pages included:
- `/services` — list services
- `/services/:id` — service detail
- `/booking/:id` — booking flow
- `/login`, `/register` — auth
- `/dashboard` — user appointments (requires login)
- `/admin` — admin placeholder
