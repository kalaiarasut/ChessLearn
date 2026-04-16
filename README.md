# Chessify 

Premium Next.js & Tailwind CSS clone of the #1 Chess site landing page. Featuring custom typography (Playfair Display and Inter) and a placeholder wrapper perfectly sized for AI video generated content.

## Tech Stack
- Framework: Next.js (App Router)
- Styling: Tailwind CSS v4
- Icons: Lucide React

## AI Prompt Used
To generate the 3D background animation with Sora/Runway:
"A cinematic, photorealistic 3D animated render of a modern minimalist chessboard. Wide field of view, viewed from a stylish isometric perspective from the bottom-right corner (the White side perspective), looking diagonally across the dark-charcoal studio background towards the Black pieces on the top-left. The board features clean white and light grey squares with a subtle brushed metal edge. The chess pieces are stylized and ultra-modern, composed of high-quality matte black resin and polished white glass materials. Soft, diffused overhead studio lighting casts elegant shadows on the board. The camera simply performs a very slow, continuous, and smooth cinematic forward zoom directly into the center of the board. 4k resolution, smooth 60fps, sleek, luxury UI aesthetic, perfectly matching a premium dark-mode website interface."

## Getting Started
```bash
npm run dev
# or
yarn dev
```

## Supabase Auth Setup
1. Copy `.env.example` to `.env.local` and fill in your Supabase values.
2. In Supabase SQL Editor, run [`scripts/supabase-auth.sql`](scripts/supabase-auth.sql).
3. In Supabase Auth settings, set the site URL to `http://localhost:3000`.
4. Add `http://localhost:3000/auth/confirm` to redirect URLs.

### Implemented Auth Flow
- `POST` signup via server action on `/signup`
- `POST` login via server action on `/login`
- Email verification callback at `/auth/confirm`
- Session refresh + route guard in `src/proxy.ts`
- Protected route: `/learn` (redirects to `/login` when signed out)

### Preferences Persistence
- `GET /api/preferences` loads signed-in user's saved board/piece/sound preferences.
- `PUT /api/preferences` saves board/piece/sound preferences for the signed-in user.
- Preferences are stored in `public.user_preferences` (created by `scripts/supabase-auth.sql`).
