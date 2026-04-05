# AGENTS.md

## Cursor Cloud specific instructions

### Overview

WorshipSlides Pro is a React 19 + Express + TypeScript web app for creating bilingual worship song slides, sermon slides, and chord charts. It runs as a single process: the Express server (`server.ts`) serves both the API endpoints and Vite dev middleware on port 3000.

### Quick Reference

| Action | Command |
|--------|---------|
| Install dependencies | `npm install` |
| Dev server | `npm run dev` |
| Lint (type-check) | `npm run lint` |
| Build | `npm run build` |

### Development Server

- `npm run dev` starts the Express + Vite dev server on **port 3000**.
- The server uses `tsx` to run `server.ts` directly (no separate compile step).
- Environment variables are loaded from `.env.local` (copy `.env.example` to get started).
- A dummy `GEMINI_API_KEY` value is fine for local dev; the key is only checked for presence via `/api/config`, not actively called.

### External Services

- **Firebase Auth + Firestore**: The app uses the cloud Firebase project `worshipslides-pro` (config in `firebase-applet-config.json`). Authentication and library features require Firebase to be reachable. There is no local emulator setup.
- **Stripe**: Lazily initialized; the app starts and core features (slide creation, chord editing, exports) work without Stripe keys. Subscription/billing flows require `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET`, and price IDs.
- **Gemini API**: Referenced only as a feature flag; no actual API calls exist in the current codebase.

### API Endpoints Available Without Auth

The chord-related API endpoints work without Firebase auth and are useful for testing:
- `POST /api/chords/validate` — validate chord notation
- `POST /api/chords/transpose` — transpose chords between keys
- `POST /api/chords/extract-from-notes` — extract chords from notes text
- `GET /health` — health check
- `GET /api/config` — app configuration

### Gotchas

- The `lint` script (`tsc --noEmit`) performs type-checking only; there is no ESLint configuration.
- Node.js 20+ is required (the Dockerfile uses `node:20-slim`). Node 22 also works.
- The `.env.local` file is gitignored; it must be created from `.env.example` on each fresh setup.
