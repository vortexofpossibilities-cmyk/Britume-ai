# BRITUME AI — Version 1.0 starter

A shared Expo + React Native codebase intended for Android and web. It establishes the dark graphite / red / blue visual direction, account-required entry, welcome screen, chat shell, and image/document picker entry points.

## Current status

This is a **starter foundation**, not a finished production AI product.
- Account screens use Supabase Auth when configured.
- Both Android and web use the same app code.
- The chat calls a secure backend endpoint at `POST /chat`.
- Image/document selection UI is present, but secure upload and model analysis still need implementation.
- Voice typing is a planned next implementation step.
- There is no guest mode.

## Run locally

1. Install Node.js (LTS).
2. In this folder run `npm install`.
3. Copy `.env.example` to `.env`.
4. Create a Supabase project and set:
   - `EXPO_PUBLIC_SUPABASE_URL`
   - `EXPO_PUBLIC_SUPABASE_ANON_KEY`
5. Set `EXPO_PUBLIC_API_BASE_URL` to your backend URL.
6. Run `npx expo start` for Android, or `npm run web` for web.

## Backend contract

The app expects:

`POST /chat`

Headers:
- `Authorization: Bearer <Supabase access token>`
- `Content-Type: application/json`

Body:
```json
{
  "messages": [
    { "role": "user", "content": "Hello" }
  ]
}
```

Expected response:
```json
{ "reply": "Hello! I'm BRITUME." }
```

The backend must validate the Supabase JWT, enforce per-user rate limits, keep the model API key server-side, and call the selected model provider. Never put an AI provider secret in `EXPO_PUBLIC_*` or in the mobile/web client.

## Recommended next build steps

1. Add a small Node.js backend with Supabase JWT verification and model-provider adapter.
2. Add conversation persistence (database tables with row-level security).
3. Implement secure file upload and image/document extraction.
4. Implement speech-to-text on web and Android with a graceful fallback.
5. Add safety controls, age-appropriate experiences, reporting, deletion and privacy flows.
6. Test on real Android devices and common browsers before release.

## Brand and product decisions

- Product: BRITUME AI
- Meaning: Brilliance of Possibilities
- UI: dark textured graphite, restrained red/blue accents, neumorphic surfaces
- No cards on the main assistant screen
- Account required on both platforms; no guest access
- Image and document support planned for V1
