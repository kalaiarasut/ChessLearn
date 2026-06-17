# Match Component

> 17 nodes · cohesion 0.21

## Key Concepts

- **createSupabaseServerClient()** (44 connections) — `src/lib/supabase/server.ts`
- **match.ts** (12 connections) — `src/app/actions/match.ts`
- **joinFriendMatch()** (6 connections) — `src/app/actions/match.ts`
- **createFriendMatch()** (5 connections) — `src/app/actions/match.ts`
- **findOrCreateMatch()** (5 connections) — `src/app/actions/match.ts`
- **profile.ts** (5 connections) — `src/app/actions/profile.ts`
- **syncGameState()** (4 connections) — `src/app/actions/match.ts`
- **setChatStatus()** (3 connections) — `src/app/actions/match.ts`
- **createProfile()** (3 connections) — `src/app/actions/profile.ts`
- **route.ts** (3 connections) — `src/app/auth/confirm/route.ts`
- **page.tsx** (3 connections) — `src/app/onboarding/page.tsx`
- **rejectMatch()** (2 connections) — `src/app/actions/match.ts`
- **getProfile()** (2 connections) — `src/app/actions/profile.ts`
- **GET()** (2 connections) — `src/app/auth/confirm/route.ts`
- **Database RPC: join_invite_match** (1 connections) — `src/app/actions/match.ts`
- **Database RPC: join_matchmaking** (1 connections) — `src/app/actions/match.ts`
- **OnboardingPage()** (1 connections) — `src/app/onboarding/page.tsx`

## Relationships

- [[Computer Page Getgameoverreasonlabel Component]] (6 shared connections)
- [[Proxy Component]] (5 shared connections)
- [[Social and Board Preferences Settings]] (4 shared connections)
- [[Login Streak Component]] (4 shared connections)
- [[Glicko Component]] (3 shared connections)
- [[Friends Component]] (3 shared connections)
- [[Preferences Component]] (3 shared connections)
- [[Local Preferences and Client Settings]] (3 shared connections)
- [[Userealtimematch Component]] (2 shared connections)
- [[History Component]] (2 shared connections)
- [[Bot Replays Component]] (2 shared connections)
- [[Hikaru Training Corpus Builder]] (2 shared connections)

## Source Files

- `src/app/actions/match.ts`
- `src/app/actions/profile.ts`
- `src/app/auth/confirm/route.ts`
- `src/app/onboarding/page.tsx`
- `src/lib/supabase/server.ts`

## Audit Trail

- EXTRACTED: 98 (96%)
- INFERRED: 4 (4%)
- AMBIGUOUS: 0 (0%)

---

*Part of the graphify knowledge wiki. See [[index]] to navigate.*