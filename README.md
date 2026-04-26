# Chessify

Chessify is a Next.js chess web app with:
- Animated landing experience
- Learn-openings flow backed by a compiled openings catalog
- Play-vs-bot board with Stockfish integration
- Theme and preference persistence
- Supabase authentication and user state

This README documents the full repository setup and runtime behavior.

## Core Features
- Landing page with motion-driven hero transitions and theme toggle
- Learn page with opening discovery, fuzzy search, local progress tracking, and variation-aware drill flow
- Opening detail experience powered by `/api/openings/[slug]`
- Play vs Computer page with configurable engine strength/time modes and multiple board/piece themes
- Stockfish 18 integration (Lite in-repo, Full via external WASM hosting)
- Supabase auth: signup, login, logout, email confirmation callback
- Signed-in preference persistence for board theme, piece theme, and sound settings
- Torch runtime status probe endpoint for Python/Torch diagnostics

## Tech Stack
- Framework: Next.js 16 (App Router)
- UI: React 19
- Language: TypeScript
- Styling: Tailwind CSS 4
- Motion/UI effects: framer-motion, lucide-react
- Chess engine + rules: stockfish, chess.js
- Auth/storage: Supabase (`@supabase/ssr`, `@supabase/supabase-js`)

## Project Structure
```text
src/
	app/
		page.tsx                    # Landing page
		learn/                      # Learn-openings experience
		play/computer/              # Play-vs-bot board + controls
		login/ signup/ auth/confirm # Auth screens + email callback
		settings/                   # Preferences UI
		actions/auth.ts             # Server actions for auth
		api/
			openings/route.ts         # Openings cards endpoint
			openings/[slug]/route.ts  # Opening detail endpoint
			preferences/route.ts      # Signed-in preferences get/put
			torch/status/route.ts     # Python/Torch diagnostic endpoint
	lib/
		openings-catalog.ts         # Catalog loading/grouping/lookup
		client-preferences.ts       # Local client preference persistence
		theme-context.tsx           # App theme provider + toggle
		supabase/                   # Browser/server/proxy clients + env
	data/
		openingDescriptions.json
		themeManifest.json
		openings_combined/          # Built opening indexes/catalog
		openings_ecojson/           # Source/reference opening datasets

public/
	boards/                       # Board textures
	pieces/                       # Piece themes
	engines/stockfish/            # Engine JS/WASM assets

scripts/
	supabase-auth.sql
	download-openings-db.mjs
	download-ecojson-source.mjs
	build-combined-openings.mjs
	build-opening-descriptions.mjs
	torch_status.py
```

## Pages and Routes
- `/` landing page
- `/learn` openings catalog and training entry
- `/learn/[opening]` opening detail/training page
- `/play/computer` bot play board
- `/settings` user preferences screen
- `/login`, `/signup`, `/auth/confirm` authentication flow

## API Endpoints
- `GET /api/openings?limit=80`
	Returns grouped opening cards from compiled catalog. `limit` is clamped to `1..200`.
- `GET /api/openings/[slug]`
	Returns opening detail, main line, and top variations for one opening slug.
- `GET /api/preferences`
	Returns signed-in user preferences from Supabase (`401` when unauthenticated).
- `PUT /api/preferences`
	Persists allowed preference fields (`boardTheme`, `pieceTheme`, `soundEnabled`).
- `GET /api/torch/status`
	Runs Python script (`scripts/torch_status.py`) and returns JSON diagnostics.

## Local Development

### Prerequisites
- Node.js 20+
- npm 10+
- Optional: Python 3.10+ (for `/api/torch/status`)

### Install
```bash
npm install
```

### Run
```bash
npm run dev
```

Open `http://localhost:3000`.

### Lint and Build
```bash
npm run lint
npm run build
npm run start
```

## Environment Variables
Create `.env.local` in the project root.

Required for Supabase-backed auth/preferences:
```bash
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

Optional for external Full Stockfish WASM rewrite:
```bash
STOCKFISH18_FULL_WASM_URL=https://<host>/stockfish-18-single.wasm
```

## Supabase Setup
1. Create a Supabase project.
2. Run `scripts/supabase-auth.sql` in Supabase SQL Editor.
3. Configure Auth settings:
	 - Site URL: `http://localhost:3000`
	 - Redirect URL: `http://localhost:3000/auth/confirm`
4. Add env vars to `.env.local`.

## Openings Data Pipeline
This repo uses an offline-first openings pipeline and compiles runtime indexes under `src/data/openings_combined`.

Available scripts:
```bash
npm run download:openings
npm run download:openings:ecojson
npm run build:openings:combined
npm run build:openings:descriptions
npm run refresh:openings
```

`refresh:openings` executes:
1. Download base openings data
2. Download ecojson source
3. Rebuild combined catalog/indexes

## Stockfish Notes
- Lite engine assets are in-repo under `public/engines/stockfish/`.
- Full Stockfish WASM is large and should be hosted externally for production (for example in Supabase Storage).
- Current UI Elo constraints align to engine limits: `1320..3190`.

Recommended production setup for Full WASM:
1. Host `stockfish-18-single.wasm` on a public bucket/CDN.
2. Set `STOCKFISH18_FULL_WASM_URL` in deployment env.
3. Redeploy and verify `/engines/stockfish/stockfish-18-single.wasm` serves WASM (not HTML).

## Auth and Session Behavior
- Auth actions live in `src/app/actions/auth.ts`.
- Session sync and auth-route redirect logic run through `src/proxy.ts` and `src/lib/supabase/proxy.ts`.
- Auth routes (`/login`, `/signup`) redirect to `/learn` when already signed in.

## Known Notes
- `/api/torch/status` requires a valid Python runtime and dependencies available locally.
- If Supabase env vars are missing, public pages still render, but auth-backed endpoints/features will not function.

## License
No license file is currently defined in this repository. Add one if you plan to distribute the project.
