# ChessLearn

ChessLearn is a Next.js 16 chess platform that combines opening study, puzzle training, bot play, progress tracking, theme customization, and Supabase-backed accounts in a single App Router codebase.

The repository includes:

- A motion-heavy landing page with live site counters and login streak animation
- An opening learning system backed by compiled catalog data
- A puzzle hub, puzzle solver, review queue, daily puzzle flow, Puzzle Storm, and Puzzle Streak
- A Play Bot experience powered by Stockfish 18
- Shared board, piece, sound, and gameplay preferences
- Supabase authentication plus server-backed persistence for signed-in users
- Cloudflare D1-backed puzzle delivery with a bundled JSON fallback
- A changelog page and public leaderboard
- Supporting scripts for opening data ingestion and preprocessing

## Table of Contents

- [Product Overview](#product-overview)
- [Tech Stack](#tech-stack)
- [Core Features](#core-features)
- [Application Routes](#application-routes)
- [API Routes](#api-routes)
- [Project Structure](#project-structure)
- [Local Development](#local-development)
- [Environment Variables](#environment-variables)
- [Supabase Setup](#supabase-setup)
- [Cloudflare D1 Puzzle Backend](#cloudflare-d1-puzzle-backend)
- [Openings Data Pipeline](#openings-data-pipeline)
- [Theme and Asset System](#theme-and-asset-system)
- [Stockfish Integration](#stockfish-integration)
- [Persistence Model](#persistence-model)
- [Database Schema Summary](#database-schema-summary)
- [Scripts Reference](#scripts-reference)
- [Deployment Notes](#deployment-notes)
- [Troubleshooting](#troubleshooting)
- [Known Gaps](#known-gaps)
- [License](#license)

## Product Overview

ChessLearn is structured around three primary product surfaces:

1. Learn
   - Browse opening cards from a generated catalog
   - Open a dedicated opening page
   - Practice variations and track progress per opening slug and variation ID
   - Optionally run local engine analysis and Torch diagnostics

2. Puzzles
   - Enter from a puzzle hub with categorized themes
   - Solve standard, daily, review, storm, and streak puzzles
   - Track rating, streaks, theme performance, recent activity, and best scores
   - Sync local progress into the signed-in account

3. Play Bot
   - Play against Stockfish with configurable strength and time settings
   - Use multiple starting position presets
   - Save replay archives for signed-in users
   - Switch between lighter and full engine assets

The app is intentionally hybrid:

- Public read features render without authentication
- Guest users still get local progress and preferences through `localStorage`
- Signed-in users gain Supabase-backed sync for settings, puzzle progress, learn progress, streaks, replays, and leaderboard participation

## Tech Stack

- Framework: Next.js `16.2.3`
- Rendering model: App Router
- UI library: React `19.2.4`
- Language: TypeScript
- Styling: Tailwind CSS `4`
- Animation/UI effects: `framer-motion`, custom visual components, `lucide-react`
- Chess rules and move validation: `chess.js`
- Chess engine: `stockfish`
- Auth and persistence: Supabase via `@supabase/ssr` and `@supabase/supabase-js`
- Puzzle backend: Cloudflare D1 over HTTP API
- Local SQLite tooling dependency: `better-sqlite3`
- Visual/math libraries present in the app: `three`, `ogl`, `postprocessing`, `recharts`, `canvas-confetti`

## Core Features

### Landing page

- Hero transition experience with scroll-driven board animation
- Theme-aware hero imagery for dark and light mode
- Public stats loaded from `/api/site-stats`
- Signed-in login streak update trigger via `/api/login-streak`
- Direct entry points into puzzles and bot play

### Learn

- Opening catalog page at `/learn`
- Opening detail pages at `/learn/[opening]`
- Opening data served from generated JSON indexes and catalog files
- Practice state tracked per opening and per variation
- Client preferences for move method, board orientation, engine depth, legal move hints, audio, and sort mode
- Learn progress sync endpoint for authenticated users

### Puzzles

- Puzzle hub page with categories and mode selection
- Server-rendered daily puzzle bootstrap
- Puzzle solver page supporting:
  - Standard mode
  - Daily puzzle mode
  - Review mode
  - Puzzle Storm
  - Puzzle Streak
- Review queue backed by Supabase tables
- Local-first progress for guests
- Signed-in progress snapshots, import flow, and attempt recording
- Theme-based filtering
- Right-click highlights and arrows
- Hinting, auto replay, free-move review after solve, and sound controls

### Play Bot

- Bot play page at `/play/computer`
- Stockfish 18 lite and full engine assets
- Configurable strength and ELO-constrained setup
- Engine download/progress helpers
- Multiple starting position presets, including randomized variants
- Replay archive sync for authenticated users
- Shared board and piece theme system with learn and puzzles

### Settings and account

- Dedicated settings page for Learn and Bot scopes
- Username update support through Supabase profile writes
- Theme toggle through a shared `ThemeProvider`
- Session-aware save behavior with optional sign-in prompt

### Community/public features

- Public leaderboard with puzzle, opening, and activity categories
- Changelog page at `/whats-new`
- Homepage public counters for puzzles solved today and active players

### Diagnostics

- Python/Torch runtime status endpoint
- Verifies whether a Torch-enabled Python runtime is available and whether a local `models/chess_model.pt` file exists

## Application Routes

### Primary pages

- `/`
  - Landing page with hero animation, live counters, and quick actions
- `/learn`
  - Opening discovery and training entry point
- `/learn/[opening]`
  - Opening detail page and practice board
- `/puzzles`
  - Puzzle hub with daily puzzle and mode selection
- `/puzzles/solve`
  - Interactive puzzle solving surface
- `/puzzles/dashboard`
  - Puzzle progress dashboard
- `/puzzles/dashboard/strengths`
  - Strongest puzzle theme breakdown
- `/puzzles/dashboard/improvement-areas`
  - Weakest puzzle theme breakdown
- `/play/computer`
  - Bot play interface
- `/leaderboard`
  - Public leaderboard
- `/settings`
  - Learn and bot settings plus username update
- `/login`
  - Email/password login
- `/signup`
  - Email/password signup with username
- `/auth/confirm`
  - Supabase email confirmation callback
- `/whats-new`
  - Changelog page

### Loading states

The app includes route-specific loading components for major surfaces such as:

- `/learn`
- `/learn/[opening]`
- `/play/computer`
- `/puzzles`

## API Routes

### Opening data

- `GET /api/openings`
  - Returns opening cards from the compiled catalog
  - Supports `limit`
  - Limit is clamped to `1..1000`

- `GET /api/openings/[slug]`
  - Returns the resolved opening payload for one slug
  - Responds with `404` when the opening does not exist

### Preferences and learn progress

- `GET /api/preferences`
  - Returns authenticated user board theme, piece theme, and sound preference

- `PUT /api/preferences`
  - Updates authenticated user preferences
  - Accepts only allowed board themes, piece themes, and `soundEnabled`

- `GET /api/learn-progress`
  - Returns normalized authenticated opening progress

- `PUT /api/learn-progress`
  - Saves normalized authenticated opening progress

### Puzzles

- `GET /api/puzzles`
  - Main puzzle query endpoint
  - Supports:
    - `count`
    - `mode`
    - `theme`
    - `puzzleId`
    - `id`
    - `minRating`
    - `maxRating`
    - `random`
    - `excludeId`
    - `excludeIds`
    - `excludeRecent`
  - Uses Cloudflare D1 when credentials are configured
  - Falls back to bundled `src/data/puzzles.json` if D1 fails or times out

- `GET /api/puzzle-progress`
  - Returns the authenticated user puzzle progress snapshot

- `POST /api/puzzle-progress/attempt`
  - Records a solved or failed puzzle attempt

- `POST /api/puzzle-progress/import`
  - Imports local puzzle progress into the authenticated account

- `GET /api/puzzle-progress/review`
  - Returns the next review puzzle for the current user
  - Supports optional `theme`

- `POST /api/puzzle-progress/review/[id]`
  - Updates one review queue item with `solved` or `failed`

### Public stats and social features

- `GET /api/leaderboard`
  - Returns public leaderboard entries
  - Supported `category` values:
    - `puzzle`
    - `opening`
    - `activity`
  - Supports `limit` and clamps it to `3..50`

- `GET /api/site-stats`
  - Returns homepage stats
  - Backed by Supabase RPC

- `GET /api/login-streak`
  - Returns the current signed-in user login streak snapshot

- `POST /api/login-streak`
  - Records a login streak visit for the current signed-in user

### Bot replay archive

- `GET /api/bot-replays`
  - Returns the authenticated replay archive

- `PUT /api/bot-replays`
  - Replaces the authenticated replay archive with normalized entries

### Diagnostics

- `GET /api/torch/status`
  - Tries `.venv/Scripts/python.exe`, then `python`
  - Executes `scripts/torch_status.py`
  - Reports Torch availability, device, and model file presence

## Project Structure

```text
.
|-- public/
|   |-- boards/                    # Board texture assets
|   |-- bot-avatars/               # Bot avatar images
|   |-- engines/stockfish/         # Stockfish JS and WASM assets
|   |-- fonts/                     # Chess/font assets
|   |-- images/hero/               # Hero images
|   |-- pieces/                    # Piece set assets
|   |-- hikaru_style_prior.json    # Evaluation style prior data
|   `-- ...                        # General static assets
|-- scripts/
|   |-- build-combined-openings.mjs
|   |-- build-opening-descriptions.mjs
|   |-- download-ecojson-source.mjs
|   |-- download-openings-db.mjs
|   |-- download-openings-stats-source.mjs
|   |-- supabase-auth.sql
|   `-- torch_status.py
|-- src/
|   |-- app/
|   |   |-- actions/auth.ts
|   |   |-- api/
|   |   |-- auth/confirm/
|   |   |-- learn/
|   |   |-- leaderboard/
|   |   |-- login/
|   |   |-- play/computer/
|   |   |-- puzzles/
|   |   |-- settings/
|   |   |-- signup/
|   |   |-- whats-new/
|   |   |-- globals.css
|   |   |-- layout.tsx
|   |   `-- page.tsx
|   |-- components/
|   |   |-- ui/
|   |   |-- auth-menu.tsx
|   |   |-- board-settings-modal.tsx
|   |   `-- settings-layout.tsx
|   |-- data/
|   |   |-- openingDescriptions.json
|   |   |-- puzzles.json
|   |   |-- themeManifest.json
|   |   |-- openings/
|   |   |-- openings_combined/
|   |   |-- openings_ecojson/
|   |   |-- openings_hf/
|   |   `-- openings_stats/
|   |-- lib/
|   |   |-- client-preferences.ts
|   |   |-- learn-progress-sync.ts
|   |   |-- login-streak-server.ts
|   |   |-- openings-catalog.ts
|   |   |-- puzzle-progress-server.ts
|   |   |-- puzzle-progress.ts
|   |   |-- puzzle-service.ts
|   |   |-- theme-context.tsx
|   |   |-- use-learn-progress-sync.ts
|   |   |-- use-puzzle-progress.ts
|   |   `-- supabase/
|   |-- proxy.ts
|   `-- registry/
`-- next.config.ts
```

### Important source files

- `src/app/actions/auth.ts`
  - Login, signup, and logout server actions
- `src/proxy.ts`
  - Session update proxy matcher
- `src/lib/openings-catalog.ts`
  - Opening catalog loading and lookup logic
- `src/lib/puzzle-service.ts`
  - Cloudflare D1 puzzle querying
- `src/lib/client-preferences.ts`
  - Local storage preference schema and migration logic
- `src/data/themeManifest.json`
  - Theme registry for board and piece assets
- `scripts/supabase-auth.sql`
  - Required Supabase schema and RPC setup

## Local Development

### Prerequisites

- Node.js 20 or newer
- npm 10 or newer
- Optional: Python 3.x for `/api/torch/status`
- Optional: Supabase project for auth and server sync
- Optional: Cloudflare account and D1 database for live puzzle delivery

### Install dependencies

```bash
npm install
```

### Start the development server

```bash
npm run dev
```

Visit:

- `http://localhost:3000`

### Production build locally

```bash
npm run build
npm run start
```

### Lint

```bash
npm run lint
```

### Test status

There is currently no dedicated `test` script in `package.json`.

## Environment Variables

Create a `.env.local` file in the project root for local development.

### Required for Supabase-backed authentication and sync

```bash
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

### Recommended for correct signup email confirmation origin

```bash
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

This is used as a fallback when the `Origin` header is unavailable during signup.

### Optional for Cloudflare D1 puzzle backend

```bash
CLOUDFLARE_ACCOUNT_ID=...
CLOUDFLARE_DATABASE_ID=...
CLOUDFLARE_API_TOKEN=...
```

Notes:

- `CLOUDFLARE_DATABASE_ID` is optional in code because a fallback ID exists, but you should still set your own database ID in real deployments
- If `CLOUDFLARE_ACCOUNT_ID` or `CLOUDFLARE_API_TOKEN` is missing, live puzzle queries fail and the app falls back to bundled local puzzle data

### Optional for custom full Stockfish WASM hosting

```bash
STOCKFISH18_FULL_WASM_URL=https://your-host/stockfish-18-single.wasm
```

If this is not set, `next.config.ts` rewrites the full engine path to the repository's current default release URL.

## Supabase Setup

### What Supabase is used for

Supabase handles:

- Authentication
- Public profiles
- User preferences
- Learn progress
- Puzzle progress and review state
- Daily puzzle status
- Login streaks
- Bot replay archive
- Public leaderboard RPC
- Public homepage stats RPC

### Setup steps

1. Create a Supabase project.
2. Add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` to `.env.local`.
3. Open the Supabase SQL Editor.
4. Run [`scripts/supabase-auth.sql`](scripts/supabase-auth.sql).
5. Configure authentication URLs:
   - Site URL: `http://localhost:3000`
   - Redirect URL: `http://localhost:3000/auth/confirm`
6. If deploying, update those URLs for your production domain.

### What `scripts/supabase-auth.sql` creates

- `public.profiles`
- `public.user_preferences`
- `public.user_puzzle_summary`
- `public.user_puzzle_attempts`
- `public.user_puzzle_review_queue`
- `public.user_daily_puzzle_status`
- `public.user_bot_replays`
- `public.user_learn_progress`
- `public.user_login_streaks`

It also creates:

- RLS policies for each user-owned table
- profile creation trigger on signup
- update timestamp triggers
- `auth_email_exists(text)` RPC
- `get_public_leaderboard(text, integer)` RPC
- `get_public_site_stats()` RPC

## Cloudflare D1 Puzzle Backend

Puzzle selection is designed to use a Cloudflare D1 database over the HTTP API.

### Query behavior

- Direct puzzle lookup by ID
- Random or daily selection by row ID windowing
- Rating filters
- Theme filters
- Exclusion of recent or already seen puzzle IDs
- Review mode handled separately by the Supabase-backed review queue

### Resilience behavior

- The D1 fetch path times out quickly
- The API retries transient query failures once
- If D1 is unavailable, `/api/puzzles` falls back to `src/data/puzzles.json`

### Important implementation notes

- Daily mode uses a deterministic date-based seed
- Random selection uses row ID wrapping instead of full random sorting
- Theme search prefers an FTS table named `puzzle_theme_fts` when available
- If that FTS table is missing, the app falls back to `LIKE` filtering

## Openings Data Pipeline

The Learn surface is backed by generated data files under `src/data/`.

### Source and generated directories

- `src/data/openings/`
  - TSV and JSON source-like opening data
- `src/data/openings_ecojson/`
  - ECOJSON source downloads and supporting metadata
- `src/data/openings_stats/`
  - Opening popularity/statistics source data
- `src/data/openings_combined/`
  - Generated combined catalog and indexes used at runtime
- `src/data/openingDescriptions.json`
  - Generated descriptions

### Runtime data files used by the app

- `openings.catalog.json`
- `openings.index.by-eco.json`
- `openings.index.by-fen.json`
- `openings.index.by-name-prefix.json`
- `openings.index.move-popularity.json`
- `openings.index.next-moves.json`

### Data scripts

```bash
npm run download:openings
npm run download:openings:ecojson
npm run download:openings:stats
npm run build:openings:combined
npm run build:openings:descriptions
npm run refresh:openings
```

### `refresh:openings`

This chained script runs:

1. `download:openings`
2. `download:openings:ecojson`
3. `download:openings:stats`
4. `build:openings:combined`

## Theme and Asset System

Theme data is defined in `src/data/themeManifest.json`.

### Current asset inventory

- Default board theme: `burled_wood`
- Default piece theme: `glass`
- Board theme count: `42`
- Piece theme count: `44`

### Asset groups

- `public/boards/`
  - Board textures and overlays
- `public/pieces/`
  - Piece set folders, typically with `150` pixel assets
- `public/sounds/`
  - Chess move and interface sound effects
- `public/images/hero/`
  - Home page hero art
- `public/bot-avatars/`
  - Bot profile images

### Preference handling

- Guest users store settings in `localStorage`
- Signed-in users can also persist board theme, piece theme, and sound preferences to Supabase
- Learn, bot, and puzzle settings have separate client preference scopes

## Stockfish Integration

Stockfish assets are served from `public/engines/stockfish/`.

### Included files

- `stockfish-18-lite-single.js`
- `stockfish-18-lite-single.wasm`
- `stockfish-18-single.js`
- `stockfish-18-single.wasm`

### Next.js rewrite behavior

`next.config.ts` rewrites:

- `/engines/stockfish/stockfish-18-single.wasm`

to:

- `process.env.STOCKFISH18_FULL_WASM_URL`
- or the default GitHub release URL when the env var is not set

### Cache behavior

WASM responses under `/engines/stockfish/:path*.wasm` are given long-lived immutable cache headers.

### Practical usage notes

- Lite assets are suitable for in-repo usage
- Full WASM is very large and is better hosted on storage or a CDN in production
- The app intentionally proxies the full WASM path through the same origin to avoid CORS issues

## Persistence Model

### Guest users

Guest users still get usable progress through client storage:

- Learn preferences and opening progress
- Bot preferences
- Puzzle rating and puzzle history
- Daily puzzle completion state
- Puzzle theme statistics

### Signed-in users

Signed-in users gain server-backed sync for:

- Account profile and username
- Board/piece/sound preferences
- Learn progress
- Puzzle summary and attempts
- Puzzle review queue
- Daily puzzle completion
- Login streaks
- Bot replay archive

### Local storage schema

The main client preferences key is:

- `ChessLearn-client-preferences`

Additional appearance state is also stored for puzzles under:

- `ChessLearn-puzzle-appearance`

The root layout also reads:

- `ChessLearn-theme`

to avoid a dark/light theme flash on first render.

## Database Schema Summary

This is not a replacement for reading the SQL file, but it is the high-level map of what the schema does.

### Profile and auth helpers

- `profiles`
  - One row per auth user
  - Stores username
- `handle_new_user()`
  - Auto-creates a profile row
- `auth_email_exists(text)`
  - Used during signup to give a direct duplicate-email message

### Preferences

- `user_preferences`
  - Board theme
  - Piece theme
  - Sound enabled

### Puzzle progress

- `user_puzzle_summary`
  - Rating, solved/failed counts, streaks, best mode scores, imported theme stats
- `user_puzzle_attempts`
  - Append-only attempt log
- `user_puzzle_review_queue`
  - Replay queue for failed or saved puzzles
- `user_daily_puzzle_status`
  - Daily puzzle completion status

### Bot replay archive

- `user_bot_replays`
  - Stores synchronized replay payloads

### Learn progress

- `user_learn_progress`
  - JSON payload storing opening progress by slug and variation

### Login streaks

- `user_login_streaks`
  - Current streak, best streak, and activity timestamps

### Public RPC functions

- `get_public_leaderboard(board_type, result_limit)`
- `get_public_site_stats()`

## Scripts Reference

`package.json` currently defines these scripts:

```bash
npm run dev
npm run build
npm run start
npm run lint
npm run scrape:themes
npm run download:openings
npm run download:openings:ecojson
npm run download:openings:stats
npm run build:openings:combined
npm run build:openings:descriptions
npm run refresh:openings
```

### Script details

- `dev`
  - Starts the Next.js dev server

- `build`
  - Creates a production build

- `start`
  - Runs the production server

- `lint`
  - Runs ESLint

- `scrape:themes`
  - Runs `download_themes.js`
  - Intended for theme asset gathering/maintenance

- `download:openings`
  - Downloads the base openings database source

- `download:openings:ecojson`
  - Downloads ECOJSON opening source data

- `download:openings:stats`
  - Downloads opening popularity/statistics source data

- `build:openings:combined`
  - Builds the runtime combined opening catalog and indexes

- `build:openings:descriptions`
  - Builds generated opening descriptions

- `refresh:openings`
  - Refreshes the opening dataset pipeline end to end

## Deployment Notes

### Minimum deployment checklist

1. Set Supabase environment variables.
2. Run the Supabase SQL setup.
3. Set `NEXT_PUBLIC_SITE_URL` for the deployed domain.
4. Configure Cloudflare D1 credentials if you want live puzzle delivery.
5. Decide whether to host full Stockfish locally or via `STOCKFISH18_FULL_WASM_URL`.
6. Verify the `/auth/confirm` redirect URL in Supabase.

### Production recommendations

- Host the full Stockfish WASM file on reliable object storage or a CDN
- Do not rely on the default fallback D1 database ID
- Treat the bundled puzzle JSON as resilience fallback, not as your primary production dataset
- Keep Supabase RLS enabled exactly as defined in the SQL file

## Troubleshooting

### Build succeeds poorly or pages fail at runtime

Check:

- `.env.local` presence
- Supabase redirect configuration
- Cloudflare D1 credentials
- Whether you are accidentally depending on missing generated data files

### Signup emails redirect incorrectly

Set:

- `NEXT_PUBLIC_SITE_URL`

and verify Supabase auth redirect URLs.

### Puzzle API returns fallback content

This usually means one of:

- `CLOUDFLARE_ACCOUNT_ID` is missing
- `CLOUDFLARE_API_TOKEN` is missing
- D1 API calls are failing or timing out

The app is designed to continue working with local fallback puzzle data in that case.

### `/api/preferences` or `/api/learn-progress` returns `401`

You are not authenticated, or the session refresh path is not configured correctly.

Check:

- Supabase env vars
- auth cookies
- `src/proxy.ts`

### `/api/torch/status` reports failure

The endpoint tries:

1. `.venv/Scripts/python.exe`
2. `python`

Make sure:

- Python is installed
- Torch is installed in that interpreter
- The process can execute the interpreter from the project root

### Stockfish full engine fails to load

Check:

- `STOCKFISH18_FULL_WASM_URL`
- whether the target URL actually serves a WASM file
- whether the rewrite path resolves successfully

## Known Gaps

- No dedicated automated test script is currently defined
- No repository license file is currently present
- The repo includes optional diagnostics and pipeline paths that depend on external services or local runtimes

## License

No license file is currently present in this repository. Add a license before distributing the project publicly.
