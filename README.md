# BRITUME AI — V1 starter

A shared Expo + React Native codebase for Android and web, with a separate Node.js API. The interface follows the dark graphite / red / blue direction and keeps the main assistant screen free of dashboard cards.

## Current build status

- Android/web app shell and account entry: scaffolded with Expo and Supabase Auth.
- Secure AI backend: implemented in `backend/` with Supabase access-token verification.
- Model integration: uses an OpenAI-compatible Chat Completions endpoint; provider and model are configurable on the server.
- Per-user request throttling: enabled in the API process.
- Image/document selection UI: present; secure upload and model analysis are not implemented yet.
- Live voice typing, conversation persistence, production deployment and device/browser testing: still to do.

This is a development milestone, not a production-ready release.

## 1. Run the mobile/web app

1. Install Node.js 20 LTS or newer.
2. From this folder run `npm install`.
3. Copy `.env.example` to `.env`.
4. Create a Supabase project and set `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY`.
5. Set `EXPO_PUBLIC_API_BASE_URL` to the URL where the backend is reachable.
6. Run `npx expo start` for Android, or `npm run web` for web.

## 2. Run the backend

In a second terminal:

```bash
cd backend
npm install
cp .env.example .env
```

Fill in `backend/.env`:

- `SUPABASE_URL`: your Supabase project URL.
- `SUPABASE_ANON_KEY`: your Supabase anon/public key.
- `AI_BASE_URL`: provider API base URL, such as `https://api.openai.com/v1` for an OpenAI-compatible endpoint.
- `AI_API_KEY`: secret key from the provider you choose.
- `AI_MODEL`: exact model identifier supplied by that provider.
- `CORS_ORIGINS`: comma-separated web origins. Native app requests without an Origin header are accepted.

Start it with `npm run dev`. The health endpoint is `http://localhost:8787/health`. The chat endpoint is `POST http://localhost:8787/chat`.

For a physical Android phone, `localhost` points to the phone, not your computer. Set the app's `EXPO_PUBLIC_API_BASE_URL` to your computer's LAN IP address while both devices are on the same network, or use a deployed HTTPS backend.

## API contract

`POST /chat` requires `Authorization: Bearer <Supabase access token>` and JSON:

```json
{
  "messages": [
    { "role": "user", "content": "Hello" }
  ]
}
```

Success response: `{ "reply": "Hello! I'm BRITUME." }`. Errors return `{ "error": "..." }`. The API validates the Supabase session, accepts only user/assistant messages, limits message size and history length, applies a per-user rate limit, and times out slow model requests.

## Security notes

- Never put `AI_API_KEY` in the Expo app, a `EXPO_PUBLIC_*` variable, source control, or a message to ChatGPT. It belongs only in the backend environment.
- The included rate limiter is in-memory and resets when the server restarts. Use a shared store such as Redis before running multiple backend instances.
- Configure exact production CORS origins. Do not use `*` in production.
- Add billing/usage limits with your model provider and monitor token usage.
- Before launch, add durable conversation storage with Supabase Row Level Security, secure file processing, safety/reporting flows, privacy controls, and automated tests.

## Brand decisions

- **BRITUME AI** — Brilliance of Possibilities
- Android and web
- Dark textured graphite, restrained red/blue accents, subtle motion
- No cards on the main assistant screen
- Account required; no guest mode
