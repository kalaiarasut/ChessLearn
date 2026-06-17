# Puzzle Progress Server Getauthenticatedpuzzleuserid Component

> 7 nodes · cohesion 0.52

## Key Concepts

- **route.ts** (10 connections) — `src/app/api/puzzles/route.ts`
- **GET()** (8 connections) — `src/app/api/puzzles/route.ts`
- **getAuthenticatedPuzzleUserId()** (4 connections) — `src/lib/puzzle-progress-server.ts`
- **getRecentPuzzleIdsForUser()** (4 connections) — `src/lib/puzzle-progress-server.ts`
- **parseExcludeIds()** (2 connections) — `src/app/api/puzzles/route.ts`
- **parseInteger()** (2 connections) — `src/app/api/puzzles/route.ts`
- **withTimeout()** (2 connections) — `src/app/api/puzzles/route.ts`

## Relationships

- [[Local Preferences and Client Settings]] (3 shared connections)
- [[Id Component]] (3 shared connections)
- [[Puzzle Service Component]] (3 shared connections)
- [[Match Component]] (1 shared connections)

## Source Files

- `src/app/api/puzzles/route.ts`
- `src/lib/puzzle-progress-server.ts`

## Audit Trail

- EXTRACTED: 32 (100%)
- INFERRED: 0 (0%)
- AMBIGUOUS: 0 (0%)

---

*Part of the graphify knowledge wiki. See [[index]] to navigate.*