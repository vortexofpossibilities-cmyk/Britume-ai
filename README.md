# BRITUME AI — V1 starter

A shared Expo + React Native codebase for Android and web, with a separate Node.js API. The interface follows the dark graphite / red / blue direction and keeps the main assistant screen free of dashboard cards.

## Current build status

- Android/web app shell and account entry: scaffolded with Expo and Supabase Auth.
- Secure AI backend: implemented in `backend/` with Supabase access-token verification.
- Model integration: OpenAI model router selects an economy, balanced, or complex model from the latest user request; all model IDs are configurable on the server. Standard processing is the default to protect the launch budget.
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
- `AI_MODEL_ECONOMY`, `AI_MODEL_BALANCED`, `AI_MODEL_COMPLEX`: exact model IDs enabled for your API project. Defaults are GPT-6 Luna, GPT-6.1 Terra, and GPT-6.2 Sol respectively.
- `AI_SERVICE_TIER`: leave as `standard` for lower cost; set to `fast` only when you accept the higher Fast-mode price.
- `CORS_ORIGINS`: comma-separated web origins. Native app requests without an Origin header are accepted.

Run `npm test` and `npm run check` to verify the router and backend syntax. Start it with `npm run dev`. The health endpoint is `http://localhost:8787/health`. The chat endpoint is `POST http://localhost:8787/chat`.

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

Success response: `{ "reply": "Hello! I'm BRITUME." }`. Errors return `{ "error": "..." }`. The API validates the Supabase session, accepts only user/assistant messages, limits message size and history length, applies a per-user rate limit, routes requests across configured OpenAI models, and times out slow model requests. The router is a lightweight heuristic and should be tuned using real usage and cost data.

## Model routing

- Everyday requests use `AI_MODEL_ECONOMY` (GPT-6 Luna by default).
- Detailed explanations, planning, and document/code review use `AI_MODEL_BALANCED` (GPT-6.1 Terra by default).
- Complex coding, architecture, security audits, and long prompts use `AI_MODEL_COMPLEX` (GPT-6.2 Sol by default).
- If a tier variable is missing, the router falls back to `AI_MODEL` when configured, then to the documented default model ID.
- This is an initial rules-based router, not an intelligent benchmark. Check that each model ID is available to your API project before launch.

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


## V3 — Conversation memory and cloud history

V3 adds per-user conversation storage and history shared by the Android and web clients. Conversation data is stored in Supabase Postgres and protected with Row Level Security (RLS). The backend verifies the user's Supabase access token and uses a user-scoped Supabase client for database operations; it does not use a service-role key.

### Apply the V3 database migration

1. Open your Supabase project and go to **SQL Editor**.
2. Open `supabase/migrations/202611220001_britume_chat_history.sql` from this project.
3. Paste the complete SQL into the editor and run it.
4. Confirm that `conversations` and `messages` tables exist in the Table Editor and that RLS is enabled on both.

### V3 API endpoints

- `GET /conversations` — list the signed-in user's recent conversations.
- `POST /conversations` — create a conversation.
- `GET /conversations/:id/messages` — load a conversation's messages.
- `DELETE /conversations/:id` — delete a conversation and its messages.
- `POST /chat` — generate a reply and persist the user and assistant messages. Requires `conversationId`.

The mobile/web client continues to use the existing `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`, and `EXPO_PUBLIC_API_BASE_URL` settings. The backend continues to use the server-side `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and AI provider settings in `backend/.env`. Never put the AI secret key or a Supabase service-role key in the app's public environment variables.

### Verify V3

1. Apply the SQL migration before starting the app.
2. Start the backend with `cd backend && npm install && npm test && npm run check && npm start`.
3. Start the app with `npm install && npx expo start`.
4. Sign in, send a message, open **History**, and reopen the saved conversation.
5. Sign in with a different test account and confirm it cannot see the first account's history.
6. Delete a conversation and confirm it disappears from history.

V3 originally saved text messages only. V4 adds opt-in voice transcription and image generation as described below; long-term personal memory summaries remain future work.


## V4 — Voice typing and image generation

V4 adds authenticated backend endpoints for speech-to-text (`POST /audio/transcriptions`) and image generation (`POST /images/generate`). The OpenAI API key stays on the backend. Voice recordings are transcribed and returned as editable text in the composer; they are not automatically sent. Image generation uses one 1024×1024 image at low quality by default to limit spend. Generated previews are currently session-only and are not saved to Supabase Storage.

### V4 setup

1. In `backend/`, run `npm install` (this installs `multer` for bounded audio uploads).
2. Set `AI_TRANSCRIPTION_MODEL=gpt-4o-mini-transcribe`, `AI_IMAGE_MODEL=gpt-image-1`, and `AI_IMAGE_QUALITY=low` in the backend environment. These can be changed to models enabled for your API project.
3. Keep `AI_API_KEY` only in the backend environment. Never add it to Expo `EXPO_PUBLIC_` variables.
4. In the app root, run `npx expo install expo-av expo-file-system` to align native packages with your Expo SDK, then restart Expo with a clean cache.
5. Test on a real device with microphone permission, then test image generation with a short prompt. Both endpoints require a signed-in user and are rate-limited.

### Cost and limitations

Voice transcription and image generation are billed separately by the API provider. The app does not start recording until the user taps Voice, and the user must stop recording before transcription. Image generation is user-triggered and uses low quality by default. Provider access, regional availability, and current pricing must be checked in your API account. Generated images are not yet persisted; durable image history and download controls are future work.

## V5 — Web intelligence and productivity

V5 adds an authenticated `POST /research` endpoint and a **Web Search** switch in the chat composer. In Web mode, BRITUME uses the OpenAI Responses API with the hosted `web_search` tool, requires a search call, collects URL-citation annotations, and stores the answer plus source URLs in the user's existing conversation history. Paste a public webpage URL into the research prompt to request a page summary; BRITUME asks the model to inspect it and disclose if it cannot access it.

### V5 configuration

Add these backend variables (the API key remains server-side):

```env
AI_RESEARCH_MODEL=gpt-6.2-astra
AI_RESEARCH_MAX_OUTPUT_TOKENS=1800
```

The configured model must be available to your OpenAI API project and support Responses API web search. The research feature uses `/v1/responses`, not the legacy Chat Completions endpoint. It is separately rate-limited to four research requests per user per minute. Search calls and model output incur API charges; keep a usage budget and monitor the OpenAI usage dashboard.

### V5 security notes

- Research is authenticated and requires ownership of the target conversation.
- Research requests are rate-limited and bounded in length/output.
- Webpage and search-result text is explicitly treated as untrusted content; instructions embedded in pages must not be followed.
- URLs are validated as public HTTP(S) URLs and are passed to the model's hosted search tool; the BRITUME server does not fetch arbitrary URLs itself.
- Source URLs are retained in the assistant message so citations remain available in chat history.

### V5 validation

Run `npm test` and `npm run check` in `backend/`. Live research requires valid Supabase configuration, an OpenAI API key, and a project/model with Responses API web search access. Test a current-events question, a pasted public URL, an inaccessible URL, and a request without a valid session before launch.
