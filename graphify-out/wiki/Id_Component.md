# Id Component

> 14 nodes · cohesion 0.21

## Key Concepts

- **getNextReviewPuzzleForCurrentUser()** (10 connections) — `src/lib/puzzle-progress-server.ts`
- **getPuzzleAuthContext()** (8 connections) — `src/lib/puzzle-progress-server.ts`
- **getPuzzleProgressSnapshotForCurrentUser()** (6 connections) — `src/lib/puzzle-progress-server.ts`
- **requireUser()** (6 connections) — `src/lib/puzzle-progress-server.ts`
- **updateReviewQueueItemForCurrentUser()** (6 connections) — `src/lib/puzzle-progress-server.ts`
- **route.ts** (4 connections) — `src/app/api/puzzle-progress/review/[id]/route.ts`
- **toReviewItem()** (3 connections) — `src/lib/puzzle-progress-server.ts`
- **route.ts** (3 connections) — `src/app/api/puzzle-progress/route.ts`
- **route.ts** (3 connections) — `src/app/api/puzzle-progress/review/route.ts`
- **POST()** (2 connections) — `src/app/api/puzzle-progress/review/[id]/route.ts`
- **findNextReviewRow()** (2 connections) — `src/lib/puzzle-progress-server.ts`
- **GET()** (2 connections) — `src/app/api/puzzle-progress/route.ts`
- **GET()** (2 connections) — `src/app/api/puzzle-progress/review/route.ts`
- **RouteContext** (1 connections) — `src/app/api/puzzle-progress/review/[id]/route.ts`

## Relationships

- [[Local Preferences and Client Settings]] (13 shared connections)
- [[Puzzle Progress Server Getauthenticatedpuzzleuserid Component]] (3 shared connections)
- [[Attempt Component]] (2 shared connections)
- [[Puzzle Service Component]] (1 shared connections)
- [[Match Component]] (1 shared connections)

## Source Files

- `src/app/api/puzzle-progress/review/[id]/route.ts`
- `src/app/api/puzzle-progress/review/route.ts`
- `src/app/api/puzzle-progress/route.ts`
- `src/lib/puzzle-progress-server.ts`

## Audit Trail

- EXTRACTED: 58 (100%)
- INFERRED: 0 (0%)
- AMBIGUOUS: 0 (0%)

---

*Part of the graphify knowledge wiki. See [[index]] to navigate.*