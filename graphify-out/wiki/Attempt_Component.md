# Attempt Component

> 10 nodes · cohesion 0.27

## Key Concepts

- **recordPuzzleAttemptForCurrentUser()** (14 connections) — `src/lib/puzzle-progress-server.ts`
- **route.ts** (5 connections) — `src/app/api/puzzle-progress/attempt/route.ts`
- **applyAttemptToLocalPuzzlePreferences()** (5 connections) — `src/lib/puzzle-progress.ts`
- **calculateNextPuzzleRating()** (5 connections) — `src/lib/puzzle-progress.ts`
- **normalizePuzzleMode()** (5 connections) — `src/lib/puzzle-progress.ts`
- **PuzzleAttemptInput** (4 connections) — `src/lib/puzzle-progress.ts`
- **queueReviewPuzzle()** (3 connections) — `src/lib/puzzle-progress-server.ts`
- **POST()** (2 connections) — `src/app/api/puzzle-progress/attempt/route.ts`
- **clearReviewQueueForPuzzle()** (2 connections) — `src/lib/puzzle-progress-server.ts`
- **shouldQueueFailure()** (2 connections) — `src/lib/puzzle-progress-server.ts`

## Relationships

- [[Local Preferences and Client Settings]] (10 shared connections)
- [[Import Component]] (5 shared connections)
- [[Display Preferences Context Usedisplaypreferences Component]] (2 shared connections)
- [[Puzzle Progress Buildlocalpuzzleprogresssnapshot Component]] (2 shared connections)
- [[Id Component]] (2 shared connections)
- [[Glicko Component]] (1 shared connections)
- [[Match Component]] (1 shared connections)

## Source Files

- `src/app/api/puzzle-progress/attempt/route.ts`
- `src/lib/puzzle-progress-server.ts`
- `src/lib/puzzle-progress.ts`

## Audit Trail

- EXTRACTED: 46 (98%)
- INFERRED: 1 (2%)
- AMBIGUOUS: 0 (0%)

---

*Part of the graphify knowledge wiki. See [[index]] to navigate.*