# Graph Report - .  (2026-06-15)

## Corpus Check
- 125 files · ~133,702 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1041 nodes · 1834 edges · 77 communities (58 shown, 19 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 29 edges (avg confidence: 0.88)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Vs Computer Play Mode|Vs Computer Play Mode]]
- [[_COMMUNITY_Navigation and Main Page Layout|Navigation and Main Page Layout]]
- [[_COMMUNITY_Chess Openings Analysis|Chess Openings Analysis]]
- [[_COMMUNITY_Social and Board Preferences Settings|Social and Board Preferences Settings]]
- [[_COMMUNITY_Project Configuration and Dependencies|Project Configuration and Dependencies]]
- [[_COMMUNITY_Openings Database Compilation|Openings Database Compilation]]
- [[_COMMUNITY_Opening Practice and Loader|Opening Practice and Loader]]
- [[_COMMUNITY_Openings Catalog Library|Openings Catalog Library]]
- [[_COMMUNITY_Puzzle Progress and Ratings|Puzzle Progress and Ratings]]
- [[_COMMUNITY_Hikaru Training Corpus Builder|Hikaru Training Corpus Builder]]
- [[_COMMUNITY_Hikaru Model Training|Hikaru Model Training]]
- [[_COMMUNITY_Puzzle UI Dashboard Components|Puzzle UI Dashboard Components]]
- [[_COMMUNITY_Learning Dashboard Page|Learning Dashboard Page]]
- [[_COMMUNITY_Local Preferences and Client Settings|Local Preferences and Client Settings]]
- [[_COMMUNITY_Opening Descriptions Builder|Opening Descriptions Builder]]
- [[_COMMUNITY_Data Openings Component|Data Openings Component]]
- [[_COMMUNITY_Display Preferences Context Usedisplaypreferences Component|Display Preferences Context Usedisplaypreferences Component]]
- [[_COMMUNITY_Puzzle Progress Createemptydailypuzzlestatus Component|Puzzle Progress Createemptydailypuzzlestatus Component]]
- [[_COMMUNITY_Build Puzzle Component|Build Puzzle Component]]
- [[_COMMUNITY_Client Preferences Clientpreferences Component|Client Preferences Clientpreferences Component]]
- [[_COMMUNITY_Evaluate Hikaru Baseline Component|Evaluate Hikaru Baseline Component]]
- [[_COMMUNITY_Tsconfig Component|Tsconfig Component]]
- [[_COMMUNITY_Computer Engine Assets Stockfish Component|Computer Engine Assets Stockfish Component]]
- [[_COMMUNITY_Learn Progress Component|Learn Progress Component]]
- [[_COMMUNITY_Login Streak Component|Login Streak Component]]
- [[_COMMUNITY_Computer Engine Assets Component|Computer Engine Assets Component]]
- [[_COMMUNITY_Computer Hikaru Style Prior Component|Computer Hikaru Style Prior Component]]
- [[_COMMUNITY_Id Component|Id Component]]
- [[_COMMUNITY_Match Component|Match Component]]
- [[_COMMUNITY_Download Hikaru Sources Component|Download Hikaru Sources Component]]
- [[_COMMUNITY_Puzzle Progress Buildlocalpuzzleprogresssnapshot Component|Puzzle Progress Buildlocalpuzzleprogresssnapshot Component]]
- [[_COMMUNITY_Download Lichess Broadcast Hikaru Component|Download Lichess Broadcast Hikaru Component]]
- [[_COMMUNITY_Proxy Component|Proxy Component]]
- [[_COMMUNITY_Download Chesscom Master Hikaru Component|Download Chesscom Master Hikaru Component]]
- [[_COMMUNITY_Layout Component|Layout Component]]
- [[_COMMUNITY_Puzzlesyncbanner Component|Puzzlesyncbanner Component]]
- [[_COMMUNITY_Leaderboard Page Leaderboardpage Component|Leaderboard Page Leaderboardpage Component]]
- [[_COMMUNITY_Glicko Component|Glicko Component]]
- [[_COMMUNITY_Analysis Page Replayarchiveentry Component|Analysis Page Replayarchiveentry Component]]
- [[_COMMUNITY_Chessboard Flat Component|Chessboard Flat Component]]
- [[_COMMUNITY_Import Component|Import Component]]
- [[_COMMUNITY_Auth Component|Auth Component]]
- [[_COMMUNITY_History Component|History Component]]
- [[_COMMUNITY_Computer Page Boardpiecestofen Component|Computer Page Boardpiecestofen Component]]
- [[_COMMUNITY_Puzzle Progress Server Getauthenticatedpuzzleuserid Component|Puzzle Progress Server Getauthenticatedpuzzleuserid Component]]
- [[_COMMUNITY_Preferences Component|Preferences Component]]
- [[_COMMUNITY_Export Theme Fts Chunks Component|Export Theme Fts Chunks Component]]
- [[_COMMUNITY_Export To Sql Chunks Component|Export To Sql Chunks Component]]
- [[_COMMUNITY_Status Component|Status Component]]
- [[_COMMUNITY_Components Kpicard Kpicard Component|Components Kpicard Kpicard Component]]
- [[_COMMUNITY_Profile Component|Profile Component]]
- [[_COMMUNITY_Computer Page Generatechess960Backrank Component|Computer Page Generatechess960Backrank Component]]
- [[_COMMUNITY_Computer Page Buildopeningbookbyside Component|Computer Page Buildopeningbookbyside Component]]
- [[_COMMUNITY_Magicui Confetti Component|Magicui Confetti Component]]
- [[_COMMUNITY_Next Config Component|Next Config Component]]
- [[_COMMUNITY_Supabase Auth Get Public Component|Supabase Auth Get Public Component]]
- [[_COMMUNITY_Agents Nextjs Agent Rules Component|Agents Nextjs Agent Rules Component]]
- [[_COMMUNITY_Icon Branding Concept Component|Icon Branding Concept Component]]
- [[_COMMUNITY_Doc Hikaru Bot Single Component|Doc Hikaru Bot Single Component]]
- [[_COMMUNITY_Eslint Config Component|Eslint Config Component]]
- [[_COMMUNITY_Playwright Puzzle Category Smoke Component|Playwright Puzzle Category Smoke Component]]
- [[_COMMUNITY_Postcss Config Component|Postcss Config Component]]
- [[_COMMUNITY_Data Openings Getopeningbyslug Component|Data Openings Getopeningbyslug Component]]
- [[_COMMUNITY_Chessboard Flat Piece Set Component|Chessboard Flat Piece Set Component]]
- [[_COMMUNITY_Data Openingdescriptions Data Component|Data Openingdescriptions Data Component]]
- [[_COMMUNITY_Openings Stats Readme Source Component|Openings Stats Readme Source Component]]
- [[_COMMUNITY_Openings Stats Sources Manifest Component|Openings Stats Sources Manifest Component]]
- [[_COMMUNITY_Playwright Puzzle Category Smoke Component|Playwright Puzzle Category Smoke Component]]
- [[_COMMUNITY_Supabase Auth User Preferences Component|Supabase Auth User Preferences Component]]
- [[_COMMUNITY_Supabase Auth User Puzzle Component|Supabase Auth User Puzzle Component]]
- [[_COMMUNITY_Supabase Auth User Puzzle Component|Supabase Auth User Puzzle Component]]
- [[_COMMUNITY_Tsconfig Tsconfig Component|Tsconfig Tsconfig Component]]
- [[_COMMUNITY_Vscode Tasks Dev Component|Vscode Tasks Dev Component]]

## God Nodes (most connected - your core abstractions)
1. `createSupabaseServerClient()` - 44 edges
2. `useTheme()` - 27 edges
3. `loadClientPreferences()` - 22 edges
4. `PlayComputerPage()` - 20 edges
5. `main()` - 17 edges
6. `getPuzzleProgressSnapshotForUser()` - 17 edges
7. `createSupabaseBrowserClient()` - 16 edges
8. `compilerOptions` - 16 edges
9. `recordPuzzleAttemptForCurrentUser()` - 15 edges
10. `usePuzzleProgress()` - 15 edges

## Surprising Connections (you probably didn't know these)
- `ChessLearn Overview` --references--> `getOpeningCards()`  [EXTRACTED]
  README.md → src/lib/openings-catalog.ts
- `ChessLearn Overview` --references--> `ClientPreferences`  [EXTRACTED]
  README.md → src/lib/client-preferences.ts
- `ChessLearn Overview` --references--> `getPuzzles()`  [EXTRACTED]
  README.md → src/lib/puzzle-service.ts
- `main()` --semantically_similar_to--> `main()`  [INFERRED] [semantically similar]
  scripts/train_hikaru_style_prior.py → scripts/evaluate_hikaru_baseline.py
- `OpeningPage` --semantically_similar_to--> `PlayComputerPage()`  [INFERRED] [semantically similar]
  src/app/learn/[opening]/page.tsx → src/app/play/computer/page.tsx

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Hikaru Data Collection & Preprocessing Pipeline** — scripts_download_chesscom_master_hikaru_main, scripts_download_hikaru_sources_main, scripts_download_lichess_broadcast_hikaru_main, scripts_build_hikaru_training_corpus_main [INFERRED 0.85]
- **Openings Database Collection & Processing Flow** — scripts_download_openings_db_run, scripts_download_ecojson_source_run, scripts_download_openings_stats_source_run, scripts_build_combined_openings_run, scripts_build_opening_descriptions_main [INFERRED 0.85]
- **Puzzle SQLite DB Chunking & Cloudflare D1 Upload Pipeline** — scripts_build_puzzle_db_builddatabase, scripts_export_theme_fts_chunks_export, scripts_export_to_sql_chunks_export, scripts_upload_to_d1_main [INFERRED 0.85]
- **Authentication Flow** — actions_auth_login, actions_auth_signup, actions_auth_logout, confirm_route_get [INFERRED 0.85]
- **Matchmaking and Gameplay Flow** — actions_match_findorcreatematch, actions_match_createfriendmatch, actions_match_joinfriendmatch, actions_match_syncgamestate [INFERRED 0.85]
- **Puzzle Progress Tracking Flow** — attempt_route_post, import_route_post, id_route_post, review_route_get, puzzle_progress_route_get, puzzles_route_get [INFERRED 0.85]
- **Chess Game Board UI Pages** — _opening__page_openingpage, computer_page_playcomputerpage, online_page_playonlinecontent [INFERRED 0.95]
- **Stockfish Web Worker Integration** — _opening__use_stockfish_analysis_usestockfishanalysis, computer_use_stockfish_player_usestockfishplayer, computer_use_stockfish_engine_download_usestockfishenginedownload [INFERRED 0.95]
- **Puzzles Dashboard View Layer** — improvement_areas_page_improvementareaspage, _components_themestatrow_themestatrow, _components_kpicard_kpicard, _components_dashboardnav_dashboardnav [INFERRED 0.85]
- **Puzzle Pages Authentication & Server Sync Flow** — dashboard_page_dashboardpage, strengths_page_strengthspage, puzzles_puzzles_client_page_puzzlesclientpage, solve_page_puzzlesolvepage [INFERRED 0.85]
- **User Display and Gameplay Preferences Flow** — lib_client_preferences_clientpreferences, lib_display_preferences_context_displaypreferencesprovider, lib_theme_context_themeprovider [INFERRED 0.85]
- **Supabase SSR Client Authentication Flow** — supabase_client_createsupabasebrowserclient, supabase_server_createsupabaseserverclient, supabase_proxy_updatesession [INFERRED 0.95]
- **Puzzle Progress Lifecycle Flow** — lib_puzzle_progress_server_getpuzzleprogresssnapshotforuser, lib_puzzle_progress_buildlocalpuzzleprogresssnapshot, lib_use_puzzle_progress_usepuzzleprogress [INFERRED 0.95]

## Communities (77 total, 19 thin omitted)

### Community 0 - "Vs Computer Play Mode"
Cohesion: 0.03
Nodes (38): BEGINNER_ESTIMATED_ELOS, BOARD_THEME_ASSETS, BOT_OPENING_ENGINE_CHOICE, BotMovePersonality, BotOpeningChoice, BotReplaySyncStatus, CAPTURE_DISPLAY_ORDER, CUSTOM_EDITOR_PIECES (+30 more)

### Community 1 - "Navigation and Main Page Layout"
Cohesion: 0.05
Nodes (33): DashboardHeader, DashboardNav, Home(), HomeStreakState, AuthMenu(), DashboardHeader(), DashboardNav(), PixelBlast() (+25 more)

### Community 2 - "Chess Openings Analysis"
Cohesion: 0.06
Nodes (35): OpeningPage, useStockfishAnalysis, useTorchStatus, AnalysisContent(), AnalysisPage(), BOARD_THEME_ASSETS, clamp(), COLLAPSED_CATEGORIES (+27 more)

### Community 3 - "Social and Board Preferences Settings"
Cohesion: 0.06
Nodes (33): acceptFriendRequest(), sendFriendRequest(), BoardSettingsModal(), BoardSettingsModalProps, BoardTab, BoardPiecesSettingsTab(), SettingsModalLayout(), SettingsTabConfig (+25 more)

### Community 4 - "Project Configuration and Dependencies"
Cohesion: 0.05
Nodes (43): dependencies, better-sqlite3, canvas-confetti, chess.js, framer-motion, lucide-react, next, ogl (+35 more)

### Community 5 - "Openings Database Compilation"
Cohesion: 0.07
Nodes (39): addStatsSample(), addToSetMap(), buildKey(), computePriority(), createStatsAccumulator(), ECO_FILES, ECOJSON_DIR, fenToFen4() (+31 more)

### Community 6 - "Opening Practice and Loader"
Cohesion: 0.06
Nodes (22): ANALYSIS_PRESET_TO_DEPTH, AnalysisEngineChoice, AnalysisStrength, BOARD_THEME_ASSETS, BranchVariation, DEFAULT_FEN, FILES, formatOpeningTitle() (+14 more)

### Community 7 - "Openings Catalog Library"
Cohesion: 0.11
Nodes (25): aggregateOpeningStats(), buildMainLineMovePopularity(), CATALOG_PATH, extractSanHistory(), fenToFen4(), getOpeningBySlug(), getOpeningCards(), getRootOpeningName() (+17 more)

### Community 8 - "Puzzle Progress and Ratings"
Cohesion: 0.10
Nodes (27): POST(), PuzzleActivityEntry, applyAttemptToLocalPuzzlePreferences(), calculateNextPuzzleRating(), CanonicalPuzzleMode, createPuzzleProgressImportInput(), DailyPuzzleStatus, DEFAULT_PUZZLE_PROGRESS_SUMMARY (+19 more)

### Community 9 - "Hikaru Training Corpus Builder"
Cohesion: 0.17
Nodes (27): Headers, AcceptedGame, apply_chessify_headers(), build_summary(), classify_time_class(), clean_termination(), count_hikaru_positions(), decorate_game() (+19 more)

### Community 10 - "Hikaru Model Training"
Cohesion: 0.17
Nodes (26): add_rates(), connect_exact_book(), empty_bucket(), evaluate_model(), exact_counts(), feature_log_prob(), hikaru_color(), iter_hikaru_targets() (+18 more)

### Community 11 - "Puzzle UI Dashboard Components"
Cohesion: 0.17
Nodes (14): KpiCard(), KpiCardProps, PuzzleLoginOverlay(), PuzzleLoginOverlayProps, ThemeStatRow(), ThemeStatRowProps, DashboardPage(), RADAR_THEMES (+6 more)

### Community 12 - "Learning Dashboard Page"
Cohesion: 0.13
Nodes (19): fallbackDescriptionForName(), fallbackOpeningByCoreKey, fallbackOpenings, getOpeningPreferenceScore(), isFuzzyTokenMatch(), isUsableOpeningDescription(), levenshteinDistance(), looksLikeVariationName() (+11 more)

### Community 13 - "Local Preferences and Client Settings"
Cohesion: 0.15
Nodes (19): asNumber(), BoardOrientation, BotClientPreferences, clampNumber(), DEFAULT_CLIENT_PREFERENCES, isScopedPreferences(), LearnVariationProgress, loadClientPreferences() (+11 more)

### Community 14 - "Opening Descriptions Builder"
Cohesion: 0.17
Nodes (22): BAD_DESCRIPTION_PATTERNS, CATALOG_PATH, cleanupText(), completeSentence(), deterministicDescriptionForName(), fallbackDescriptionForName(), fetchDescriptionFromInternet(), fetchJson() (+14 more)

### Community 15 - "Data Openings Component"
Cohesion: 0.10
Nodes (15): LessonBranch, LessonLine, LessonStep, OPENING_LEVEL_LABELS, OPENING_LEVELS, OpeningCourse, openingCourses, OpeningLevel (+7 more)

### Community 16 - "Display Preferences Context Usedisplaypreferences Component"
Cohesion: 0.11
Nodes (19): useDisplayPreferences(), AVAILABLE_BOARD_THEMES, AVAILABLE_PIECE_THEMES, BOARD_ASSETS, canPlayPuzzleLine(), EmptyState, FILES, FreeMoveHistoryEntry (+11 more)

### Community 17 - "Puzzle Progress Createemptydailypuzzlestatus Component"
Cohesion: 0.18
Nodes (20): createEmptyDailyPuzzleStatus(), createEmptyPuzzleProgressSnapshot(), AttemptRow, buildReviewThemeCounts(), buildThemeStatsFromAttempts(), DailyStatusRow, fetchAllAttemptRows(), fetchPagedRows() (+12 more)

### Community 18 - "Build Puzzle Component"
Cohesion: 0.10
Nodes (15): buildDatabase(), CSV_FILE, DB_FILE, Theme FTS Export routine, SQL Chunk Export routine, CHUNKS_DIR, files, { from: fromArg, dryRun } (+7 more)

### Community 19 - "Client Preferences Clientpreferences Component"
Cohesion: 0.15
Nodes (16): ClientPreferences, buildFilter(), canPlayLine(), D1ResponseRow, formatPuzzles(), getCredentials(), getDailyPuzzle(), getPuzzles() (+8 more)

### Community 20 - "Evaluate Hikaru Baseline Component"
Cohesion: 0.22
Nodes (19): add_rates(), connect_db(), empty_bucket(), evaluate(), hikaru_color(), iter_hikaru_targets(), main(), material_count() (+11 more)

### Community 21 - "Tsconfig Component"
Cohesion: 0.10
Nodes (19): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+11 more)

### Community 22 - "Computer Engine Assets Stockfish Component"
Cohesion: 0.14
Nodes (17): STOCKFISH_18_FULL_WORKER_SCRIPT, chooseHikaruStyleMove(), EngineMoveCandidate, HikaruStyleModel, boardPiecesToState(), getGameOverHeadline(), getMaterialSnapshot(), getReplayWinnerDetails() (+9 more)

### Community 23 - "Learn Progress Component"
Cohesion: 0.19
Nodes (16): GET(), getAuthenticatedContext(), PUT(), LearnClientPreferences, LearnOpeningProgress, LearnSortMode, OpeningVariationSortMode, saveClientPreferences() (+8 more)

### Community 24 - "Login Streak Component"
Cohesion: 0.24
Nodes (14): dayNumber(), fetchLoginStreakRow(), getAuthenticatedContext(), getLoginStreakForCurrentUser(), LoginStreakRow, LoginStreakSnapshot, LoginStreakSupabaseClient, LoginStreakUpdate (+6 more)

### Community 25 - "Computer Engine Assets Component"
Cohesion: 0.14
Nodes (9): STOCKFISH_18_FULL_WASM_CANDIDATE_URLS, STOCKFISH_18_FULL_WASM_LOCAL_PATH, DEFAULT_STATUS, DownloadableEngineVariant, ENGINE_MANIFESTS, EngineAsset, EngineDownloadStatus, EngineManifest (+1 more)

### Community 26 - "Computer Hikaru Style Prior Component"
Cohesion: 0.23
Nodes (13): DEFAULT_WEIGHTS, featureLogProb(), HikaruStyleTable, loadHikaruStyleModel(), materialCount(), moveFeatures(), moveFlag(), normalizeModel() (+5 more)

### Community 27 - "Id Component"
Cohesion: 0.21
Nodes (11): POST(), RouteContext, findNextReviewRow(), getNextReviewPuzzleForCurrentUser(), getPuzzleAuthContext(), getPuzzleProgressSnapshotForCurrentUser(), requireUser(), toReviewItem() (+3 more)

### Community 28 - "Match Component"
Cohesion: 0.27
Nodes (10): createFriendMatch(), findOrCreateMatch(), joinFriendMatch(), rejectMatch(), setChatStatus(), syncGameState(), GET(), GET() (+2 more)

### Community 29 - "Download Hikaru Sources Component"
Cohesion: 0.37
Nodes (12): classify_time_class(), count_manual(), download_chesscom(), is_clean_chesscom_game(), main(), pgn_duplicate_key(), PgnGame, Path (+4 more)

### Community 30 - "Puzzle Progress Buildlocalpuzzleprogresssnapshot Component"
Cohesion: 0.23
Nodes (10): buildLocalPuzzleProgressSnapshot(), hasMeaningfulLocalPuzzleProgress(), PuzzleProgressSnapshot, DEFAULT_SYNC_STATUS, getImportMarkerKey(), hasSuccessfulImportMarker(), loadLocalPreferences(), loadLocalSnapshot() (+2 more)

### Community 31 - "Download Lichess Broadcast Hikaru Component"
Cohesion: 0.35
Nodes (11): decompress_zst(), download_file(), get_broadcast_urls(), get_local_zst_files(), is_hikaru_game(), main(), PgnGame, Path (+3 more)

### Community 32 - "Proxy Component"
Cohesion: 0.27
Nodes (8): config, proxy(), getSupabaseEnv(), requireEnv(), AUTH_ROUTES, isRouteMatch(), PROTECTED_ROUTES, updateSession()

### Community 33 - "Download Chesscom Master Hikaru Component"
Cohesion: 0.45
Nodes (10): chunks(), curl_text(), download_chunk_pgn(), download_page_chunk_pgn(), expected_ids_for_page(), extract_game_ids(), get_page_count(), load_or_fetch_page_ids() (+2 more)

### Community 34 - "Layout Component"
Cohesion: 0.22
Nodes (7): inter, metadata, playfair, DisplayPreferencesContext, DisplayPreferencesContextType, DisplayPreferencesProvider(), ThemeProvider()

### Community 35 - "Puzzlesyncbanner Component"
Cohesion: 0.22
Nodes (6): PuzzleSyncBanner(), PuzzleSyncBannerProps, PuzzleSyncStatus, BOARD_THEME_ASSETS, PIECE_THEME_ASSETS, PUZZLE_MODES

### Community 36 - "Leaderboard Page Leaderboardpage Component"
Cohesion: 0.24
Nodes (7): LeaderboardPage(), CATEGORIES, GET(), LeaderboardCategory, LeaderboardRpcRow, toCategory(), toLimit()

### Community 37 - "Glicko Component"
Cohesion: 0.47
Nodes (9): calculateNewRating(), computeDelta(), computeV(), computeVolatility(), E(), g(), PlayerRating, toGlicko2() (+1 more)

### Community 38 - "Analysis Page Replayarchiveentry Component"
Cohesion: 0.33
Nodes (7): ReplayArchiveEntry, GET(), getAuthenticatedContext(), normalizeReplayArchive(), PUT(), ReplayArchiveEntry, ReplayOutcome

### Community 39 - "Chessboard Flat Component"
Cohesion: 0.36
Nodes (7): ANIMATED_SQUARES, ChessboardFlat(), ChessboardFlatProps, FILES, INITIAL_POSITION, RANKS, squareToPosition()

### Community 40 - "Import Component"
Cohesion: 0.32
Nodes (7): isValidImportPayload(), POST(), PuzzleProgressImportInput, buildImportReplaySeeds(), ensureUserPuzzleSummary(), importLocalPuzzleProgressForCurrentUser(), normalizeImportThemeStats()

### Community 41 - "Auth Component"
Cohesion: 0.52
Nodes (6): AuthFormState, isValidEmail(), login(), logout(), readValue(), signup()

### Community 42 - "History Component"
Cohesion: 0.33
Nodes (4): fetchUserGames(), GamesHistory(), GamesHistoryProps, PIECE_THEME_ASSETS

### Community 43 - "Computer Page Boardpiecestofen Component"
Cohesion: 0.29
Nodes (7): boardPiecesToFen(), getCustomBoardStartFen(), getReplayLastMoveSquares(), parseFenBoardPlacement(), toSquare(), validateCustomBoardPiecesForEngine(), validateStartingFen()

### Community 44 - "Puzzle Progress Server Getauthenticatedpuzzleuserid Component"
Cohesion: 0.52
Nodes (6): getAuthenticatedPuzzleUserId(), getRecentPuzzleIdsForUser(), GET(), parseExcludeIds(), parseInteger(), withTimeout()

### Community 45 - "Preferences Component"
Cohesion: 0.33
Nodes (6): ALLOWED_BOARD_THEMES, ALLOWED_PIECE_THEMES, GET(), PreferencesPayload, PUT(), sanitizePayload()

### Community 46 - "Export Theme Fts Chunks Component"
Cohesion: 0.33
Nodes (4): db, DB_FILE, OUT_DIR, stmt

### Community 47 - "Export To Sql Chunks Component"
Cohesion: 0.33
Nodes (4): db, DB_FILE, OUT_DIR, stmt

### Community 48 - "Status Component"
Cohesion: 0.47
Nodes (5): GET(), getPythonCandidates(), ROOT, runTorchStatus(), TORCH_STATUS_SCRIPT

### Community 49 - "Components Kpicard Kpicard Component"
Cohesion: 0.40
Nodes (5): KpiCard, PuzzleLoginOverlay, PuzzleSyncBanner, ThemeStatRow, ImprovementAreasPage()

### Community 51 - "Computer Page Generatechess960Backrank Component"
Cohesion: 0.40
Nodes (5): generateChess960BackRank(), generateShuffleBackRank(), shuffleArray(), toDoubleFischerFen(), toTranscendentalFen()

### Community 52 - "Computer Page Buildopeningbookbyside Component"
Cohesion: 0.50
Nodes (4): buildOpeningBookBySide(), normalizeSearchText(), tokenizePgnMoves(), toOpeningChoice()

### Community 53 - "Magicui Confetti Component"
Cohesion: 0.50
Nodes (3): Confetti, ConfettiProps, ConfettiRef

### Community 55 - "Supabase Auth Get Public Component"
Cohesion: 0.67
Nodes (3): get_public_leaderboard function, public.profiles table definition, public.user_puzzle_summary table definition

## Knowledge Gaps
- **351 isolated node(s):** `FILES`, `RANKS`, `ANIMATED_SQUARES`, `eslintConfig`, `themes` (+346 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **19 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Headers` connect `Hikaru Training Corpus Builder` to `Proxy Component`, `Auth Component`?**
  _High betweenness centrality (0.161) - this node is a cross-community bridge._
- **Why does `main()` connect `Hikaru Training Corpus Builder` to `Download Chesscom Master Hikaru Component`, `Evaluate Hikaru Baseline Component`, `Download Hikaru Sources Component`, `Download Lichess Broadcast Hikaru Component`?**
  _High betweenness centrality (0.151) - this node is a cross-community bridge._
- **Why does `createSupabaseServerClient()` connect `Match Component` to `Proxy Component`, `Social and Board Preferences Settings`, `Leaderboard Page Leaderboardpage Component`, `Analysis Page Replayarchiveentry Component`, `Puzzle Progress and Ratings`, `Auth Component`, `History Component`, `Puzzle Progress Server Getauthenticatedpuzzleuserid Component`, `Preferences Component`, `Puzzle Progress Createemptydailypuzzlestatus Component`, `Profile Component`, `Learn Progress Component`, `Login Streak Component`, `Id Component`?**
  _High betweenness centrality (0.079) - this node is a cross-community bridge._
- **Are the 2 inferred relationships involving `PlayComputerPage()` (e.g. with `OpeningPage` and `PlayOnlineContent()`) actually correct?**
  _`PlayComputerPage()` has 2 INFERRED edges - model-reasoned connections that need verification._
- **What connects `FILES`, `RANKS`, `ANIMATED_SQUARES` to the rest of the system?**
  _351 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Vs Computer Play Mode` be split into smaller, more focused modules?**
  _Cohesion score 0.03333333333333333 - nodes in this community are weakly interconnected._
- **Should `Navigation and Main Page Layout` be split into smaller, more focused modules?**
  _Cohesion score 0.05389610389610389 - nodes in this community are weakly interconnected._