# Local Preferences and Client Settings

> 25 nodes · cohesion 0.16

## Key Concepts

- **puzzle-progress-server.ts** (61 connections) — `src/lib/puzzle-progress-server.ts`
- **getPuzzleProgressSnapshotForUser()** (15 connections) — `src/lib/puzzle-progress-server.ts`
- **importLocalPuzzleProgressForCurrentUser()** (13 connections) — `src/lib/puzzle-progress-server.ts`
- **createEmptyPuzzleProgressSnapshot()** (5 connections) — `src/lib/puzzle-progress.ts`
- **createEmptyDailyPuzzleStatus()** (4 connections) — `src/lib/puzzle-progress.ts`
- **ensureUserPuzzleSummary()** (4 connections) — `src/lib/puzzle-progress-server.ts`
- **fetchTodayDailyStatus()** (4 connections) — `src/lib/puzzle-progress-server.ts`
- **hasSummaryActivity()** (4 connections) — `src/lib/puzzle-progress-server.ts`
- **fetchAllAttemptRows()** (3 connections) — `src/lib/puzzle-progress-server.ts`
- **fetchPagedRows()** (3 connections) — `src/lib/puzzle-progress-server.ts`
- **fetchQueuedReviewRows()** (3 connections) — `src/lib/puzzle-progress-server.ts`
- **hasUserPuzzleServerHistory()** (3 connections) — `src/lib/puzzle-progress-server.ts`
- **mergeImportedThemeStats()** (3 connections) — `src/lib/puzzle-progress-server.ts`
- **normalizeImportedThemeStats()** (3 connections) — `src/lib/puzzle-progress-server.ts`
- **toDailyStatus()** (3 connections) — `src/lib/puzzle-progress-server.ts`
- **buildImportReplaySeeds()** (2 connections) — `src/lib/puzzle-progress-server.ts`
- **buildReviewThemeCounts()** (2 connections) — `src/lib/puzzle-progress-server.ts`
- **buildThemeStatsFromAttempts()** (2 connections) — `src/lib/puzzle-progress-server.ts`
- **normalizeImportThemeStats()** (2 connections) — `src/lib/puzzle-progress-server.ts`
- **toSummary()** (2 connections) — `src/lib/puzzle-progress-server.ts`
- **AttemptRow** (1 connections) — `src/lib/puzzle-progress-server.ts`
- **DailyStatusRow** (1 connections) — `src/lib/puzzle-progress-server.ts`
- **PuzzleSupabaseClient** (1 connections) — `src/lib/puzzle-progress-server.ts`
- **ReviewQueueRow** (1 connections) — `src/lib/puzzle-progress-server.ts`
- **SummaryRow** (1 connections) — `src/lib/puzzle-progress-server.ts`

## Relationships

- [[Id Component]] (13 shared connections)
- [[Import Component]] (11 shared connections)
- [[Attempt Component]] (10 shared connections)
- [[Puzzle Progress Buildlocalpuzzleprogresssnapshot Component]] (6 shared connections)
- [[Puzzle Service Component]] (5 shared connections)
- [[Puzzle Progress Server Getauthenticatedpuzzleuserid Component]] (3 shared connections)
- [[Match Component]] (3 shared connections)
- [[Proxy Component]] (1 shared connections)

## Source Files

- `src/lib/puzzle-progress-server.ts`
- `src/lib/puzzle-progress.ts`

## Audit Trail

- EXTRACTED: 146 (100%)
- INFERRED: 0 (0%)
- AMBIGUOUS: 0 (0%)

---

*Part of the graphify knowledge wiki. See [[index]] to navigate.*