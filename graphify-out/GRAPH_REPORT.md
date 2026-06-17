# Graph Report - .  (2026-06-15)

## Corpus Check
- 126 files · ~139,190 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1046 nodes · 1851 edges · 75 communities (58 shown, 17 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 39 edges (avg confidence: 0.89)
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
- [[_COMMUNITY_Download Chesscom Master Hikaru Component|Download Chesscom Master Hikaru Component]]
- [[_COMMUNITY_Display Preferences Context Usedisplaypreferences Component|Display Preferences Context Usedisplaypreferences Component]]
- [[_COMMUNITY_Computer Page Getgameoverreasonlabel Component|Computer Page Getgameoverreasonlabel Component]]
- [[_COMMUNITY_Data Openings Component|Data Openings Component]]
- [[_COMMUNITY_Import Component|Import Component]]
- [[_COMMUNITY_Evaluate Hikaru Baseline Component|Evaluate Hikaru Baseline Component]]
- [[_COMMUNITY_Tsconfig Component|Tsconfig Component]]
- [[_COMMUNITY_Puzzle Service Component|Puzzle Service Component]]
- [[_COMMUNITY_Match Component|Match Component]]
- [[_COMMUNITY_Computer Engine Assets Component|Computer Engine Assets Component]]
- [[_COMMUNITY_Computer Hikaru Style Prior Component|Computer Hikaru Style Prior Component]]
- [[_COMMUNITY_Login Streak Component|Login Streak Component]]
- [[_COMMUNITY_Puzzle Progress Buildlocalpuzzleprogresssnapshot Component|Puzzle Progress Buildlocalpuzzleprogresssnapshot Component]]
- [[_COMMUNITY_Id Component|Id Component]]
- [[_COMMUNITY_Download Hikaru Sources Component|Download Hikaru Sources Component]]
- [[_COMMUNITY_Board Settings Modal Component|Board Settings Modal Component]]
- [[_COMMUNITY_Proxy Component|Proxy Component]]
- [[_COMMUNITY_Opening Page Openingpage Component|Opening Page Openingpage Component]]
- [[_COMMUNITY_Computer Engine Assets Stockfish Component|Computer Engine Assets Stockfish Component]]
- [[_COMMUNITY_Layout Component|Layout Component]]
- [[_COMMUNITY_Attempt Component|Attempt Component]]
- [[_COMMUNITY_Glicko Component|Glicko Component]]
- [[_COMMUNITY_Userealtimematch Component|Userealtimematch Component]]
- [[_COMMUNITY_Bot Replays Component|Bot Replays Component]]
- [[_COMMUNITY_Chessboard Flat Component|Chessboard Flat Component]]
- [[_COMMUNITY_Friends Component|Friends Component]]
- [[_COMMUNITY_Computer Page Boardpiecestofen Component|Computer Page Boardpiecestofen Component]]
- [[_COMMUNITY_Puzzle Progress Server Getauthenticatedpuzzleuserid Component|Puzzle Progress Server Getauthenticatedpuzzleuserid Component]]
- [[_COMMUNITY_Preferences Component|Preferences Component]]
- [[_COMMUNITY_Script Torch Status Component|Script Torch Status Component]]
- [[_COMMUNITY_History Component|History Component]]
- [[_COMMUNITY_Computer Page Generatechess960Backrank Component|Computer Page Generatechess960Backrank Component]]
- [[_COMMUNITY_Concept Puzzles Sqlite Wal Component|Concept Puzzles Sqlite Wal Component]]
- [[_COMMUNITY_Computer Page Buildopeningbookbyside Component|Computer Page Buildopeningbookbyside Component]]
- [[_COMMUNITY_Db Rpc Get Public Component|Db Rpc Get Public Component]]
- [[_COMMUNITY_Magicui Confetti Component|Magicui Confetti Component]]
- [[_COMMUNITY_Opening Use Torch Status Component|Opening Use Torch Status Component]]
- [[_COMMUNITY_Agents Nextjs Rules Component|Agents Nextjs Rules Component]]
- [[_COMMUNITY_Icon Branding Component|Icon Branding Component]]
- [[_COMMUNITY_Eslint Config Component|Eslint Config Component]]
- [[_COMMUNITY_Next Config Component|Next Config Component]]
- [[_COMMUNITY_Playwright Puzzle Category Smoke Component|Playwright Puzzle Category Smoke Component]]
- [[_COMMUNITY_Postcss Config Component|Postcss Config Component]]
- [[_COMMUNITY_Data Openings Getopeningbyslug Component|Data Openings Getopeningbyslug Component]]
- [[_COMMUNITY_Data Openings Openingcourses Component|Data Openings Openingcourses Component]]
- [[_COMMUNITY_Data Openings Rawopenings Component|Data Openings Rawopenings Component]]
- [[_COMMUNITY_Id Route Post Component|Id Route Post Component]]
- [[_COMMUNITY_Opening Loading Openingloading Component|Opening Loading Openingloading Component]]
- [[_COMMUNITY_Opening Page Miniboardpreview Component|Opening Page Miniboardpreview Component]]
- [[_COMMUNITY_Slug Route Get Component|Slug Route Get Component]]
- [[_COMMUNITY_Doc Hikaru Bot Single Component|Doc Hikaru Bot Single Component]]
- [[_COMMUNITY_Playwright Puzzle Category Smoke Component|Playwright Puzzle Category Smoke Component]]
- [[_COMMUNITY_Supabase Auth Profiles Component|Supabase Auth Profiles Component]]
- [[_COMMUNITY_Supabase Auth User Puzzle Component|Supabase Auth User Puzzle Component]]

## God Nodes (most connected - your core abstractions)
1. `createSupabaseServerClient()` - 44 edges
2. `useTheme()` - 27 edges
3. `loadClientPreferences()` - 21 edges
4. `main()` - 18 edges
5. `createSupabaseBrowserClient()` - 16 edges
6. `compilerOptions` - 16 edges
7. `PlayComputerPage()` - 15 edges
8. `getPuzzleProgressSnapshotForUser()` - 15 edges
9. `AuthMenu()` - 14 edges
10. `recordPuzzleAttemptForCurrentUser()` - 14 edges

## Surprising Connections (you probably didn't know these)
- `ChessLearn Overview and Tech Stack` --conceptually_related_to--> `ClientPreferences`  [INFERRED]
  README.md → src/lib/client-preferences.ts
- `Chess Openings Analysis Document` --conceptually_related_to--> `getOpeningCards()`  [INFERRED]
  src/data/openings_stats/README.source.md → src/lib/openings-catalog.ts
- `useStockfishAnalysis Hook` --semantically_similar_to--> `useStockfishPlayer()`  [INFERRED] [semantically similar]
  src/app/learn/[opening]/use-stockfish-analysis.ts → src/app/play/computer/use-stockfish-player.ts
- `calculateNewRating()` --semantically_similar_to--> `calculateNextPuzzleRating()`  [INFERRED] [semantically similar]
  src/lib/glicko.ts → src/lib/puzzle-progress.ts
- `useLearnProgressSync()` --semantically_similar_to--> `usePuzzleProgress()`  [INFERRED] [semantically similar]
  src/lib/use-learn-progress-sync.ts → src/lib/use-puzzle-progress.ts

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Hikaru Nakamura Training Corpus Pipeline** — scripts_download_chesscom_master_hikaru_main, scripts_download_hikaru_sources_main, scripts_download_lichess_broadcast_hikaru_main, scripts_build_hikaru_training_corpus_main [EXTRACTED 1.00]
- **Hikaru Style-Prior Training and Baseline Evaluation** — scripts_evaluate_hikaru_baseline_main, scripts_train_hikaru_style_prior_main, scripts_build_hikaru_training_corpus_main [EXTRACTED 1.00]
- **Chess Openings Data Compilation Pipeline** — scripts_download_openings_db_run, scripts_download_ecojson_source_run, scripts_download_openings_stats_source_run, scripts_build_combined_openings_run, scripts_build_opening_descriptions_main [EXTRACTED 1.00]
- **Authentication and Confirmation Flow** — actions_auth_login, actions_auth_signup, actions_auth_logout, confirm_route_get [INFERRED 0.85]
- **Online Matchmaking and Match Setup Flow** — actions_match_findorcreatematch, actions_match_createfriendmatch, actions_match_joinfriendmatch [INFERRED 0.85]
- **Puzzle Attempt, Import, and Review Endpoints** — attempt_route_post, import_route_post, review_route_get, _id__route_post, puzzle_progress_route_get [INFERRED 0.85]
- **Computer Player Engine & Review Hooks** — computer_use_stockfish_player_usestockfishplayer, computer_use_game_review_usegamereview, computer_use_stockfish_engine_download_usestockfishenginedownload [INFERRED 0.85]
- **Puzzles Dashboard View and Navigation Components** — improvement_areas_page_improvementareaspage, _components_dashboardheader_dashboardheader, _components_dashboardnav_dashboardnav, _components_themestatrow_themestatrow, _components_kpicard_kpicard [INFERRED 0.85]
- **User Authentication and Profile Management Flow** — signup_page_signupcontent, components_auth_menu_authmenu, settings_page_settingspage [INFERRED 0.85]
- **Puzzle Training and Analytics Ecosystem** — dashboard_page_dashboardpage, strengths_page_strengthspage, puzzles_puzzles_client_page_puzzlesclientpage, solve_page_solverinner [INFERRED 0.95]
- **User Preferences and Chessboard Customization Flow** — settings_page_settingspage, components_board_settings_modal_boardsettingsmodal, components_settings_layout_settingsmodallayout [INFERRED 0.95]
- **Supabase Auth and Session Flow** — supabase_client_createsupabasebrowserclient, supabase_server_createsupabaseserverclient, supabase_proxy_updatesession [EXTRACTED 1.00]
- **Puzzle Progress Local to Server Synchronization** — lib_puzzle_progress_server_importlocalpuzzleprogressforcurrentuser, lib_puzzle_progress_server_recordpuzzleattemptforcurrentuser, lib_use_puzzle_progress_usepuzzleprogress [INFERRED 0.95]

## Communities (75 total, 17 thin omitted)

### Community 0 - "Vs Computer Play Mode"
Cohesion: 0.06
Nodes (61): fallbackDescriptionForName(), fallbackOpeningByCoreKey, fallbackOpenings, getOpeningPreferenceScore(), isFuzzyTokenMatch(), isUsableOpeningDescription(), LearnPage(), levenshteinDistance() (+53 more)

### Community 1 - "Navigation and Main Page Layout"
Cohesion: 0.03
Nodes (38): BEGINNER_ESTIMATED_ELOS, BOARD_THEME_ASSETS, BOT_OPENING_ENGINE_CHOICE, BotMovePersonality, BotOpeningChoice, BotReplaySyncStatus, CAPTURE_DISPLAY_ORDER, CUSTOM_EDITOR_PIECES (+30 more)

### Community 2 - "Chess Openings Analysis"
Cohesion: 0.06
Nodes (30): AnalysisContent(), BOARD_THEME_ASSETS, clamp(), COLLAPSED_CATEGORIES, cpToWhiteWinPercent(), EXPANDED_CATEGORIES, FILES, formatEval() (+22 more)

### Community 3 - "Social and Board Preferences Settings"
Cohesion: 0.08
Nodes (29): DashboardHeader Component, DashboardNav Component, AuthFormState, isValidEmail(), login(), logout(), readValue(), signup() (+21 more)

### Community 4 - "Project Configuration and Dependencies"
Cohesion: 0.05
Nodes (43): dependencies, better-sqlite3, canvas-confetti, chess.js, framer-motion, lucide-react, next, ogl (+35 more)

### Community 5 - "Openings Database Compilation"
Cohesion: 0.07
Nodes (39): addStatsSample(), addToSetMap(), buildKey(), computePriority(), createStatsAccumulator(), ECO_FILES, ECOJSON_DIR, fenToFen4() (+31 more)

### Community 6 - "Opening Practice and Loader"
Cohesion: 0.10
Nodes (32): KpiCard Component, PuzzleLoginOverlay Component, PuzzleSyncBanner Component, ThemeStatRow Component, KpiCard(), KpiCardProps, PuzzleLoginOverlay(), PuzzleLoginOverlayProps (+24 more)

### Community 7 - "Openings Catalog Library"
Cohesion: 0.10
Nodes (26): aggregateOpeningStats(), buildMainLineMovePopularity(), CATALOG_PATH, extractSanHistory(), fenToFen4(), getOpeningBySlug(), getOpeningCards(), getRootOpeningName() (+18 more)

### Community 8 - "Puzzle Progress and Ratings"
Cohesion: 0.07
Nodes (19): ANALYSIS_PRESET_TO_DEPTH, AnalysisEngineChoice, AnalysisStrength, BOARD_THEME_ASSETS, BranchVariation, DEFAULT_FEN, FILES, formatOpeningTitle() (+11 more)

### Community 9 - "Hikaru Training Corpus Builder"
Cohesion: 0.09
Nodes (22): createLiquidEffect(), createTouchTexture(), PixelBlast(), SHAPE_MAP, Database RPC: get_public_leaderboard, LeaderboardCategory, LeaderboardPage(), LeaderboardPlayer (+14 more)

### Community 10 - "Hikaru Model Training"
Cohesion: 0.16
Nodes (27): Hikaru Style-Prior Move Ranker, add_rates(), connect_exact_book(), empty_bucket(), evaluate_model(), exact_counts(), feature_log_prob(), hikaru_color() (+19 more)

### Community 11 - "Puzzle UI Dashboard Components"
Cohesion: 0.17
Nodes (27): Headers, AcceptedGame, apply_chessify_headers(), build_summary(), classify_time_class(), clean_termination(), count_hikaru_positions(), decorate_game() (+19 more)

### Community 12 - "Learning Dashboard Page"
Cohesion: 0.08
Nodes (17): Wrangler D1 SQL Chunking Strategy, db, DB_FILE, OUT_DIR, stmt, db, DB_FILE, OUT_DIR (+9 more)

### Community 13 - "Local Preferences and Client Settings"
Cohesion: 0.16
Nodes (24): createEmptyDailyPuzzleStatus(), createEmptyPuzzleProgressSnapshot(), AttemptRow, buildImportReplaySeeds(), buildReviewThemeCounts(), buildThemeStatsFromAttempts(), DailyStatusRow, ensureUserPuzzleSummary() (+16 more)

### Community 14 - "Opening Descriptions Builder"
Cohesion: 0.16
Nodes (22): BAD_DESCRIPTION_PATTERNS, CATALOG_PATH, cleanupText(), completeSentence(), deterministicDescriptionForName(), fallbackDescriptionForName(), fetchDescriptionFromInternet(), fetchJson() (+14 more)

### Community 15 - "Download Chesscom Master Hikaru Component"
Cohesion: 0.19
Nodes (21): chunks(), curl_text(), download_chunk_pgn(), download_page_chunk_pgn(), expected_ids_for_page(), extract_game_ids(), get_page_count(), load_or_fetch_page_ids() (+13 more)

### Community 16 - "Display Preferences Context Usedisplaypreferences Component"
Cohesion: 0.12
Nodes (20): useDisplayPreferences(), AVAILABLE_BOARD_THEMES, AVAILABLE_PIECE_THEMES, BOARD_ASSETS, canPlayPuzzleLine(), EmptyState, FILES, FreeMoveHistoryEntry (+12 more)

### Community 17 - "Computer Page Getgameoverreasonlabel Component"
Cohesion: 0.10
Nodes (14): getGameOverReasonLabel(), Glicko Rating System, BOARD_THEME_ASSETS, FILES, getOpening(), PIECE_THEME_ASSETS, PlayOnlineContent(), TIME_CONTROLS (+6 more)

### Community 18 - "Data Openings Component"
Cohesion: 0.10
Nodes (15): LessonBranch, LessonLine, LessonStep, OPENING_LEVEL_LABELS, OPENING_LEVELS, OpeningCourse, openingCourses, OpeningLevel (+7 more)

### Community 19 - "Import Component"
Cohesion: 0.11
Nodes (18): isValidImportPayload(), POST(), PuzzleActivityEntry, CanonicalPuzzleMode, DailyPuzzleStatus, DEFAULT_PUZZLE_PROGRESS_SUMMARY, PuzzleAttemptMode, PuzzleAttemptOutcome (+10 more)

### Community 20 - "Evaluate Hikaru Baseline Component"
Cohesion: 0.22
Nodes (19): add_rates(), connect_db(), empty_bucket(), evaluate(), hikaru_color(), iter_hikaru_targets(), main(), material_count() (+11 more)

### Community 21 - "Tsconfig Component"
Cohesion: 0.10
Nodes (19): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+11 more)

### Community 22 - "Puzzle Service Component"
Cohesion: 0.18
Nodes (14): buildFilter(), canPlayLine(), D1ResponseRow, formatPuzzles(), getCredentials(), getDailyPuzzle(), getPuzzles(), hashSeed() (+6 more)

### Community 23 - "Match Component"
Cohesion: 0.21
Nodes (12): createFriendMatch(), findOrCreateMatch(), joinFriendMatch(), rejectMatch(), setChatStatus(), syncGameState(), createProfile(), getProfile() (+4 more)

### Community 24 - "Computer Engine Assets Component"
Cohesion: 0.13
Nodes (10): STOCKFISH_18_FULL_WASM_CANDIDATE_URLS, STOCKFISH_18_FULL_WASM_LOCAL_PATH Constant, DEFAULT_STATUS, DownloadableEngineVariant, ENGINE_MANIFESTS, EngineAsset, EngineDownloadStatus, EngineManifest (+2 more)

### Community 25 - "Computer Hikaru Style Prior Component"
Cohesion: 0.19
Nodes (15): DEFAULT_WEIGHTS, EngineMoveCandidate, featureLogProb(), HikaruStyleModel, HikaruStyleTable, loadHikaruStyleModel(), materialCount(), moveFeatures() (+7 more)

### Community 26 - "Login Streak Component"
Cohesion: 0.24
Nodes (14): dayNumber(), fetchLoginStreakRow(), getAuthenticatedContext(), getLoginStreakForCurrentUser(), LoginStreakRow, LoginStreakSnapshot, LoginStreakSupabaseClient, LoginStreakUpdate (+6 more)

### Community 27 - "Puzzle Progress Buildlocalpuzzleprogresssnapshot Component"
Cohesion: 0.18
Nodes (13): buildLocalPuzzleProgressSnapshot(), createPuzzleProgressImportInput(), getTodayUtcDate(), hasMeaningfulLocalPuzzleProgress(), PuzzleProgressSnapshot, upsertDailyStatus(), DEFAULT_SYNC_STATUS, getImportMarkerKey() (+5 more)

### Community 28 - "Id Component"
Cohesion: 0.21
Nodes (11): POST(), RouteContext, findNextReviewRow(), getNextReviewPuzzleForCurrentUser(), getPuzzleAuthContext(), getPuzzleProgressSnapshotForCurrentUser(), requireUser(), toReviewItem() (+3 more)

### Community 29 - "Download Hikaru Sources Component"
Cohesion: 0.37
Nodes (12): classify_time_class(), count_manual(), download_chesscom(), is_clean_chesscom_game(), main(), pgn_duplicate_key(), PgnGame, Path (+4 more)

### Community 30 - "Board Settings Modal Component"
Cohesion: 0.27
Nodes (10): BoardPreview(), BoardSettingsModal(), BoardSettingsModalProps, BoardTab, BoardPiecesSettingsTab(), BoardThumbnail(), PieceThumbnail(), SettingsModalLayout() (+2 more)

### Community 31 - "Proxy Component"
Cohesion: 0.27
Nodes (8): config, proxy(), getSupabaseEnv(), requireEnv(), AUTH_ROUTES, isRouteMatch(), PROTECTED_ROUTES, updateSession()

### Community 32 - "Opening Page Openingpage Component"
Cohesion: 0.24
Nodes (11): OpeningPage Component, useStockfishAnalysis Hook, useTorchStatus Hook, boardPiecesToState(), getGameOverHeadline(), getMaterialSnapshot(), getReplayWinnerDetails(), getSquareVisualCenter() (+3 more)

### Community 33 - "Computer Engine Assets Stockfish Component"
Cohesion: 0.22
Nodes (9): STOCKFISH_18_FULL_WORKER_SCRIPT Constant, chooseHikaruStyleMove(), EngineState, PlayerEngineOptions, PlayerEngineVariant, PlayerStrengthMode, PlayerTimeMode, STOCKFISH_ELO_LIMITS (+1 more)

### Community 34 - "Layout Component"
Cohesion: 0.22
Nodes (7): inter, metadata, playfair, DisplayPreferencesContext, DisplayPreferencesContextType, DisplayPreferencesProvider(), ThemeProvider()

### Community 35 - "Attempt Component"
Cohesion: 0.27
Nodes (9): POST(), applyAttemptToLocalPuzzlePreferences(), calculateNextPuzzleRating(), normalizePuzzleMode(), PuzzleAttemptInput, clearReviewQueueForPuzzle(), queueReviewPuzzle(), recordPuzzleAttemptForCurrentUser() (+1 more)

### Community 36 - "Glicko Component"
Cohesion: 0.47
Nodes (9): calculateNewRating(), computeDelta(), computeV(), computeVolatility(), E(), g(), PlayerRating, toGlicko2() (+1 more)

### Community 37 - "Userealtimematch Component"
Cohesion: 0.33
Nodes (6): MatchStatus, RealtimeMatchState, useRealtimeMatch(), createSupabaseBrowserClient(), GlobalInviteListener(), InvitePayload

### Community 38 - "Bot Replays Component"
Cohesion: 0.43
Nodes (7): GET(), getAuthenticatedContext(), normalizeReplayArchive(), normalizeReplayEntry(), PUT(), ReplayArchiveEntry, ReplayOutcome

### Community 39 - "Chessboard Flat Component"
Cohesion: 0.29
Nodes (7): ANIMATED_SQUARES, ChessboardFlat(), ChessboardFlatProps, FILES, INITIAL_POSITION, RANKS, squareToPosition()

### Community 40 - "Friends Component"
Cohesion: 0.43
Nodes (5): acceptFriendRequest(), sendFriendRequest(), Friendship, PlayersTab(), Profile

### Community 41 - "Computer Page Boardpiecestofen Component"
Cohesion: 0.29
Nodes (7): boardPiecesToFen(), getCustomBoardStartFen(), getReplayLastMoveSquares(), parseFenBoardPlacement(), toSquare(), validateCustomBoardPiecesForEngine(), validateStartingFen()

### Community 42 - "Puzzle Progress Server Getauthenticatedpuzzleuserid Component"
Cohesion: 0.52
Nodes (6): getAuthenticatedPuzzleUserId(), getRecentPuzzleIdsForUser(), GET(), parseExcludeIds(), parseInteger(), withTimeout()

### Community 43 - "Preferences Component"
Cohesion: 0.33
Nodes (6): ALLOWED_BOARD_THEMES, ALLOWED_PIECE_THEMES, GET(), PreferencesPayload, PUT(), sanitizePayload()

### Community 44 - "Script Torch Status Component"
Cohesion: 0.38
Nodes (6): Torch Status Python Script, GET(), getPythonCandidates(), ROOT, runTorchStatus(), TORCH_STATUS_SCRIPT

### Community 45 - "History Component"
Cohesion: 0.50
Nodes (3): fetchUserGames(), GamesHistoryProps, PIECE_THEME_ASSETS

### Community 46 - "Computer Page Generatechess960Backrank Component"
Cohesion: 0.40
Nodes (5): generateChess960BackRank(), generateShuffleBackRank(), shuffleArray(), toDoubleFischerFen(), toTranscendentalFen()

### Community 47 - "Concept Puzzles Sqlite Wal Component"
Cohesion: 0.40
Nodes (4): SQLite WAL Mode for Puzzle DB Creation, buildDatabase(), CSV_FILE, DB_FILE

### Community 48 - "Computer Page Buildopeningbookbyside Component"
Cohesion: 0.50
Nodes (4): buildOpeningBookBySide(), normalizeSearchText(), tokenizePgnMoves(), toOpeningChoice()

### Community 49 - "Db Rpc Get Public Component"
Cohesion: 0.50
Nodes (3): Database RPC: get_public_site_stats, GET(), SiteStatsRpcRow

### Community 50 - "Magicui Confetti Component"
Cohesion: 0.50
Nodes (3): Confetti, ConfettiProps, ConfettiRef

### Community 51 - "Opening Use Torch Status Component"
Cohesion: 0.50
Nodes (3): DEFAULT_STATUS, TorchStatus, useTorchStatus()

## Knowledge Gaps
- **356 isolated node(s):** `FILES`, `RANKS`, `INITIAL_POSITION`, `ANIMATED_SQUARES`, `ChessboardFlatProps` (+351 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **17 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Headers` connect `Puzzle UI Dashboard Components` to `Social and Board Preferences Settings`, `Proxy Component`?**
  _High betweenness centrality (0.158) - this node is a cross-community bridge._
- **Why does `main()` connect `Puzzle UI Dashboard Components` to `Hikaru Model Training`, `Evaluate Hikaru Baseline Component`, `Download Hikaru Sources Component`, `Download Chesscom Master Hikaru Component`?**
  _High betweenness centrality (0.139) - this node is a cross-community bridge._
- **Why does `useTheme()` connect `Social and Board Preferences Settings` to `Opening Page Openingpage Component`, `Navigation and Main Page Layout`, `Vs Computer Play Mode`, `Opening Practice and Loader`, `Puzzle Progress and Ratings`, `Display Preferences Context Usedisplaypreferences Component`, `Computer Page Getgameoverreasonlabel Component`?**
  _High betweenness centrality (0.065) - this node is a cross-community bridge._
- **Are the 5 inferred relationships involving `main()` (e.g. with `main()` and `main()`) actually correct?**
  _`main()` has 5 INFERRED edges - model-reasoned connections that need verification._
- **What connects `FILES`, `RANKS`, `INITIAL_POSITION` to the rest of the system?**
  _359 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Vs Computer Play Mode` be split into smaller, more focused modules?**
  _Cohesion score 0.05674044265593561 - nodes in this community are weakly interconnected._
- **Should `Navigation and Main Page Layout` be split into smaller, more focused modules?**
  _Cohesion score 0.03333333333333333 - nodes in this community are weakly interconnected._