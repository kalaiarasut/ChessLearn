# Proxy Component

> 12 nodes · cohesion 0.27

## Key Concepts

- **server.ts** (17 connections) — `src/lib/supabase/server.ts`
- **getSupabaseEnv()** (8 connections) — `src/lib/supabase/env.ts`
- **proxy.ts** (7 connections) — `src/lib/supabase/proxy.ts`
- **env.ts** (5 connections) — `src/lib/supabase/env.ts`
- **updateSession()** (5 connections) — `src/lib/supabase/proxy.ts`
- **proxy.ts** (4 connections) — `src/proxy.ts`
- **proxy()** (2 connections) — `src/proxy.ts`
- **requireEnv()** (2 connections) — `src/lib/supabase/env.ts`
- **isRouteMatch()** (2 connections) — `src/lib/supabase/proxy.ts`
- **config** (1 connections) — `src/proxy.ts`
- **AUTH_ROUTES** (1 connections) — `src/lib/supabase/proxy.ts`
- **PROTECTED_ROUTES** (1 connections) — `src/lib/supabase/proxy.ts`

## Relationships

- [[Match Component]] (5 shared connections)
- [[Userealtimematch Component]] (3 shared connections)
- [[Puzzle UI Dashboard Components]] (1 shared connections)
- [[Social and Board Preferences Settings]] (1 shared connections)
- [[Friends Component]] (1 shared connections)
- [[History Component]] (1 shared connections)
- [[Bot Replays Component]] (1 shared connections)
- [[Hikaru Training Corpus Builder]] (1 shared connections)
- [[Vs Computer Play Mode]] (1 shared connections)
- [[Preferences Component]] (1 shared connections)
- [[Db Rpc Get Public Component]] (1 shared connections)
- [[Login Streak Component]] (1 shared connections)

## Source Files

- `src/lib/supabase/env.ts`
- `src/lib/supabase/proxy.ts`
- `src/lib/supabase/server.ts`
- `src/proxy.ts`

## Audit Trail

- EXTRACTED: 55 (100%)
- INFERRED: 0 (0%)
- AMBIGUOUS: 0 (0%)

---

*Part of the graphify knowledge wiki. See [[index]] to navigate.*