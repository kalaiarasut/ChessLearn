# Hikaru Bot Single-Phase Training Plan

## Goal

Build one complete Hikaru-style bot pass, not separate v1/v2 releases. The bot should use all practical Hikaru data sources from the beginning, then produce separate behavior profiles for bullet, blitz, rapid, and serious tournament-style play.

The target should not be 90% exact next-move match. Published human-move prediction systems do not reach that level for exact move matching. Our realistic targets are:

- Strong Hikaru-like opening repertoire coverage.
- High top-3/top-5 candidate coverage.
- Time-control-specific style: bullet, blitz, rapid/classical.
- Calibrated playing strength inside Chessify.
- Better stylistic similarity than a plain Stockfish Elo preset.

## Data Sources

| Source | Count Signal | Use | Status |
| --- | ---: | --- | --- |
| Chess.com account `hikaru` | 68,016 raw games, 65,870 final accepted unique games | Primary source for bullet/blitz style | Downloaded via PubAPI and merged |
| Chess.com master games page | 8,532 listed games, 8,392 final accepted unique games | Curated master/tournament supplement | Downloaded page-by-page from Chess.com Master Games |
| 365Chess Hikaru profile | 3,659 listed games | OTB/classical/rapid supplement | Download likely requires account/session |
| Lichess FIDE broadcasts | 22 local broadcast PGNs found, 11 final accepted unique games | Recent elite rapid/blitz/classical broadcast games | Local broadcast files filtered and deduped |
| ChessMonitor Masters DB | 10.1M global master games | Reference/cross-check, possible export if account access exists | Likely overlaps TWIC/Lichess/365Chess |
| ChessPrime | 247 listed games | Low-priority supplement | Too small to matter much |

Current Chess.com clean corpus:

- Total clean standard games: 66,284.
- Blitz: 45,735.
- Bullet: 19,400.
- Rapid: 895.
- Classical by inferred time control: 72.
- Unknown time class: 182.

Completed Chess.com Master Games extraction:

- The first manual browser export contained only 25 selected games.
- Codex then downloaded the full Chess.com Master Games result set page-by-page.
- Chess.com listed 8,532 rows; the PGN parser saw 8,642 game objects because the source PGN contains some extra/duplicate blocks.
- After cleaning and dedupe, 8,392 master games were retained.
- The 25 manually supplied games are preserved as a seed file but add 0 extra games after dedupe.

Completed final unique clean Hikaru corpus:

- Clean unique games: 74,273.
- Train games: 72,190.
- Test games: 2,083, using games from year 2026 and later as holdout.
- Total plies: 6,474,749.
- Hikaru move targets: 3,249,289.
- Final combined PGN: `data/player-games/hikaru/processed/hikaru_clean_unique.pgn`.
- Train PGN: `data/player-games/hikaru/processed/hikaru_train.pgn`.
- Test PGN: `data/player-games/hikaru/processed/hikaru_test.pgn`.

Final accepted games by source:

- Chess.com account: 65,870.
- Chess.com master: 8,392.
- Lichess broadcast: 11.

Final accepted games by time class:

- Blitz: 49,413.
- Bullet: 19,766.
- Rapid: 1,459.
- Classical: 135.
- Unknown: 3,500.

## Clean Game Definition

Keep games only when all of these are true:

- Standard chess rules.
- PGN is present and parseable.
- Hikaru is White or Black.
- At least 12 full moves or 24 plies unless the game is a meaningful known tournament miniature.
- Result is a real completed game, not abandoned or aborted.
- Time control is known or inferable.
- Duplicate hash has not already been imported.

Exclude or isolate:

- Daily/correspondence games for the main model.
- Chess960/freestyle games unless building a separate freestyle profile.
- Odds games, training games, and engine/bot games.
- Very short joke games and one-move resignations.

## Processing Pipeline

1. Download raw source files into `data/player-games/hikaru/raw/`.
2. Parse PGNs and normalize names, dates, URLs, time controls, ECO, result, and source.
3. Deduplicate by game URL when available, then by normalized move text plus date/player pair.
4. Split into:
   - `hikaru_bullet`
   - `hikaru_blitz`
   - `hikaru_rapid`
   - `hikaru_classical_tournament`
   - `hikaru_opening_book`
5. Generate feature tables:
   - Opening move frequencies by color and time control.
   - Preferred structures and pawn breaks.
   - Exchange/sacrifice tendency.
   - King attack tendency.
   - Endgame simplification tendency.
   - Blunder/risk profile by clock phase when clocks are available.
6. Build the bot as a style selector over legal moves:
   - Use Stockfish/MultiPV for legal candidate quality.
   - Reweight candidates using Hikaru source-derived style priors.
   - Keep strength calibrated with Chessify's engine ladder.
7. Validate against chronological holdout games:
   - Exact move match.
   - Top-3/top-5 match.
   - Opening-family match.
   - Average centipawn loss profile.
   - Result distribution against fixed Chessify bot anchors.

## Completed Dedupe And Cleaning

Scripts added:

- `scripts/build_hikaru_training_corpus.py`
- `scripts/evaluate_hikaru_baseline.py`
- `scripts/train_hikaru_style_prior.py`

Raw sources merged:

- `data/player-games/hikaru/raw/chesscom/hikaru_all.pgn`
- `data/player-games/hikaru/raw/manual/chesscom-master-hikaru-full.pgn`
- `data/player-games/hikaru/raw/manual/chesscom-master-hikaru.pgn`
- `data/player-games/hikaru/raw/lichess-broadcast/hikaru_lichess_broadcast.pgn`
- `data/player-games/hikaru/raw/lichess-broadcast/monthly-matches/*.pgn`

Dedupe priority:

1. Chess.com Master Games full export.
2. Chess.com account archive.
3. Lichess broadcast PGNs.
4. Manual 25-game seed file.

That priority means a curated master-game copy is retained when the same game appears again later. The manual 25-game seed is intentionally processed last so it cannot inflate the final count.

Dedupe key:

- Legal move sequence converted to UCI.
- Date.
- White player.
- Black player.
- Result.

This catches duplicate PGNs even when source filenames, comments, tags, or formatting differ.

Cleaning filters:

- Hikaru must be White or Black, detected by name or FIDE id `2016192`.
- Result must be `1-0`, `0-1`, or `1/2-1/2`.
- Variant/rules must be standard chess.
- Game must be legally replayable by `python-chess`.
- Game must have at least 20 plies.
- Abandoned, unterminated, rules-infraction, and fair-play termination tags are excluded.

Rejected records:

- Chess.com account: 217 bad termination, 12 duplicate, 1,454 non-standard, 463 too short.
- Chess.com master: 7 duplicate, 110 not Hikaru, 133 too short.
- Lichess broadcast monthly file: 11 duplicate.
- Manual seed: 25 duplicate.

Final move-target coverage:

- Hikaru target positions: 3,249,289.
- Opening targets: 742,730.
- Middlegame targets: 1,874,492.
- Endgame targets: 632,067.

## Baseline Accuracy

Baseline script:

`python scripts/evaluate_hikaru_baseline.py --rebuild-book`

Method:

- Train an exact-position frequency book from `hikaru_train.pgn`.
- For each position where Hikaru is to move, store Hikaru's historical move counts.
- Evaluate on held-out `hikaru_test.pgn`, currently 2026 games.
- If the exact position appeared in training, predict the most frequent Hikaru move from that position.

This is not the final bot model. It is a hard baseline that measures how much can be recovered by memorized position statistics alone. It mostly measures opening/repeated-position coverage; middlegame and endgame exact-position coverage is naturally low.

Training book:

- Training Hikaru move targets indexed: 3,153,579.
- Unique exact positions: 2,408,085.
- Unique position-move pairs: 2,461,551.
- SQLite book: `data/player-games/hikaru/processed/hikaru_exact_position_book.sqlite`.

Held-out test set:

- Test games: 2,083.
- Test Hikaru move targets: 95,710.

Overall exact-position baseline:

- Exact-position coverage: 15,455 / 95,710 = 16.15%.
- Top-1 accuracy on all targets: 9.93%.
- Top-3 accuracy on all targets: 13.51%.
- Top-5 accuracy on all targets: 14.41%.
- Top-1 accuracy when the exact position is covered: 61.51%.
- Top-3 accuracy when covered: 83.68%.
- Top-5 accuracy when covered: 89.23%.

By phase:

- Opening: 20,830 targets, 70.12% coverage, 42.98% top-1 all-target accuracy, 59.08% top-3 all-target accuracy.
- Middlegame: 55,811 targets, 1.40% coverage, 0.92% top-1 all-target accuracy, 1.04% top-3 all-target accuracy.
- Endgame: 19,069 targets, 0.35% coverage, 0.21% top-1 all-target accuracy, 0.24% top-3 all-target accuracy.

By time class:

- Blitz: 74,827 targets, 15.73% coverage, 9.51% top-1 all-target accuracy, 13.17% top-3 all-target accuracy.
- Bullet: 19,432 targets, 17.93% coverage, 11.84% top-1 all-target accuracy, 15.09% top-3 all-target accuracy.
- Rapid: 221 targets, 10.86% coverage, 5.43% top-1 all-target accuracy, 8.60% top-3 all-target accuracy.
- Classical: 80 targets, 17.50% coverage, 10.00% top-1 all-target accuracy, 15.00% top-3 all-target accuracy.
- Unknown: 1,150 targets, 14.09% coverage, 6.00% top-1 all-target accuracy, 9.91% top-3 all-target accuracy.

Interpretation:

- Exact memorization alone already gives strong opening behavior: 70.12% of held-out opening targets are covered, and covered opening positions reach 84.25% top-3 accuracy.
- Overall exact-move accuracy is low because most middlegame/endgame positions are novel and have no exact training match.
- A realistic Hikaru bot should combine this exact-position/opening book with an engine-guided candidate selector and style priors, rather than trying to reach 90% exact next-move accuracy across all positions.
- The baseline confirms the data is useful for openings and repeated structures, but a learned style model is needed for novel middlegame and endgame positions.

## Style-Prior Move Selector

Script:

`python scripts/train_hikaru_style_prior.py --retrain`

Outputs:

- Style model: `data/player-games/hikaru/processed/hikaru_style_prior.json`
- Style evaluation JSON: `data/player-games/hikaru/processed/hikaru_style_prior_eval.json`
- Style evaluation report: `data/player-games/hikaru/processed/hikaru_style_prior_eval.md`

Method:

- Train lightweight Hikaru move-preference priors from `hikaru_train.pgn`.
- For every Hikaru-to-move training position, count features of the move Hikaru actually played.
- Features include phase, time class, piece moved, destination square, move flags such as quiet/capture/check/castle/promotion, and from-to square patterns.
- At evaluation time, rank every legal move in the held-out position by these Hikaru-derived priors.
- If the exact position exists in the exact-position SQLite book, add a strong exact-position boost.
- This does not use Stockfish yet, so it measures style-prior ranking only, not engine-quality-aware bot play.

Training:

- Training Hikaru move targets: 3,153,579.
- Test Hikaru move targets: 95,710.
- Exact-position coverage remains 16.15%, but unlike the exact-memory baseline, the style-prior model ranks every legal move in every test position.

Overall style-prior accuracy:

- Top-1: 15.74%.
- Top-3: 28.87%.
- Top-5: 37.31%.

Improvement over exact-position-only baseline:

- Top-1 improved from 9.93% to 15.74%.
- Top-3 improved from 13.51% to 28.87%.
- Top-5 improved from 14.41% to 37.31%.

By phase:

- Opening: 20,830 targets, top-1 46.17%, top-3 68.80%, top-5 78.26%.
- Middlegame: 55,811 targets, top-1 5.57%, top-3 13.72%, top-5 20.61%.
- Endgame: 19,069 targets, top-1 12.29%, top-3 29.60%, top-5 41.44%.

By time class:

- Blitz: 74,827 targets, top-1 15.15%, top-3 28.41%, top-5 36.90%.
- Bullet: 19,432 targets, top-1 18.35%, top-3 30.85%, top-5 39.10%.
- Rapid: 221 targets, top-1 14.03%, top-3 24.89%, top-5 33.48%.
- Classical: 80 targets, top-1 13.75%, top-3 27.50%, top-5 31.25%.
- Unknown: 1,150 targets, top-1 11.13%, top-3 26.00%, top-5 35.13%.

Interpretation:

- This is a real improvement because the model no longer fails when the exact position is unseen.
- Opening behavior is now strong: Hikaru's actual held-out opening move appears in the top 5 ranked legal moves 78.26% of the time.
- Middlegame remains the hardest part because exact positions are mostly novel and pure style priors do not know tactical engine quality.
- Endgame top-5 is much better than exact memorization, but it still needs engine legality/quality filtering to avoid stylistic but bad moves.
- The next production step is to combine this style prior with Stockfish MultiPV candidates: Stockfish supplies good candidate moves, and the Hikaru prior reorders or samples among them.

## App Integration

Completed on 2026-05-03:

- Copied the trained lightweight style-prior model into `public/hikaru_style_prior.json` so the browser can load it without bundling the whole training dataset.
- Added `src/app/play/computer/hikaru-style-prior.ts` as the client-side scorer. It loads the model, validates legal UCI moves with `chess.js`, extracts phase/time/piece/square/flag features, and scores candidate moves against Hikaru-derived priors.
- Updated `src/app/play/computer/use-stockfish-player.ts` so the bot can request Stockfish `MultiPV` candidates. When Hikaru Style is active and the model is ready, Stockfish supplies up to five engine-quality candidate moves and the Hikaru scorer reranks them. If the model is unavailable, or no legal candidate is matched, the hook falls back to the normal Stockfish best move.
- Added a `Move Personality` setting in `src/app/play/computer/page.tsx` with `Stockfish` and `Hikaru Style` options. The choice is saved in local storage under `ChessLearn.bot.movePersonality.v1`.
- The active style time class is inferred from the selected clock: bullet for very short clocks, rapid for longer clocks, and blitz as the default.

Important behavior note:

- This is not a full neural Hikaru clone. It is a safe production layer: Stockfish keeps move quality and legality under control, while the Hikaru prior changes which strong candidate is preferred.
- Expected practical effect: openings and familiar structures should look much more Hikaru-like; sharp middlegames will still be mostly engine-driven because the style model is intentionally lightweight.

Verification:

- `npm.cmd run build` passed on 2026-05-03 with the Hikaru Style integration included.
- Production smoke check passed on 2026-05-03 at `/play/computer`: Settings > Engine shows `Move Personality`, selecting `Hikaru Style` loads the public model and reaches `Ready`.
- The build still prints unrelated existing warnings/noise about `next.config.ts` tracing, Recharts chart dimensions, and `/puzzles` static rendering, but these did not fail the build and were not introduced by the Hikaru bot integration.

## Implementation Direction

Do not train from zero unless we later choose a full neural policy model. For the current Chessify architecture, the practical implementation is:

- Download and normalize all source data.
- Build style/opening statistics.
- Add a Hikaru profile layer to the bot move selector.
- Use engine candidates for strength and legality.
- Use source-derived weights for human-like move choice.

This gives us a one-pass production bot without waiting for a full neural training stack.

## Immediate Download Plan

1. Run the downloader for Chess.com PubAPI:
   `python scripts/download_hikaru_sources.py --source chesscom`
2. If this network has TLS inspection, retry:
   `python scripts/download_hikaru_sources.py --source chesscom --insecure`
3. If this network blocks `api.chess.com`, run the same command from an unblocked network or use a browser/VPN/proxy.
3. Add manual/exported PGNs from 365Chess, Chess.com master games, Lichess broadcasts, and TWIC into:
   `data/player-games/hikaru/raw/manual/`
4. Re-run the parser/count mode after each source is added.

## Manual Source Download Instructions

Place every manually exported `.pgn` file here:

`data/player-games/hikaru/raw/manual/`

Use clear filenames, for example:

- `chesscom-master-hikaru.pgn`
- `365chess-hikaru.pgn`
- `twic-hikaru.pgn`
- `chessgames-hikaru.pgn`

After adding manual PGNs, count them with:

`python scripts/download_hikaru_sources.py --source manual`

Recommended manual sources:

1. Chess.com Master Games
   - Link: `https://www.chess.com/games/hikaru-nakamura`
   - Goal: export/download all Hikaru Nakamura master games as PGN.
   - Expected listed count: 8,532 games.
   - Use: serious/master-game supplement. Expect overlap with other master sources.
   - Checked status: this is the Chess.com Master Games Database, not Hikaru's regular Chess.com account archive. The right-side filter can set `Player 1 = Hikaru Nakamura`, and the list exposes row checkboxes plus a download icon. Try selecting the header checkbox and clicking the download icon. If it exports all filtered games, save it as `chesscom-master-hikaru.pgn`. If it only exports visible/selected rows page-by-page, skip it for now because it is too manual.

2. 365Chess
   - Link: `https://www.365chess.com/players/Hikaru_Nakamura`
   - Goal: download/export Hikaru Nakamura games as PGN.
   - Expected listed count: 3,659 games.
   - Use: OTB/classical and rapid supplement.
   - Checked status: the player page has a `Download games` link, but it redirects to `signin.php?download=1`. Bulk PGN download requires logging in and may require membership depending on account limits.
   - Current decision: skip for now because the available workflow is effectively one-by-one/manual.

3. Lichess Broadcast Database
   - Link: `https://database.lichess.org/`
   - Download the broadcast `.pgn.zst` files and place them here:
     `data/player-games/hikaru/raw/lichess-broadcast/zst/`
   - Then filter Hikaru games locally:
     `python scripts/download_lichess_broadcast_hikaru.py --local-only`
   - Use: recent broadcast/tournament games. Expect hundreds to low thousands of Hikaru matches, not tens of thousands.

4. Lichess FIDE Hikaru page
   - Link: `https://lichess.org/fide/2016192/Nakamura_Hikaru`
   - Goal: find Hikaru-related broadcast events, then export PGN from event pages when available.
   - Use: targeted event exports if the full broadcast database is too large.

5. TWIC
   - Link: `https://theweekinchess.com/twic`
   - Goal: download weekly PGNs, then filter for Hikaru Nakamura.
   - Use: OTB/tournament supplement.
   - Note: high overlap with other master databases, but useful for verification.

6. Chessgames.com
   - Link: `https://www.chessgames.com/perl/chessplayer?pid=10084`
   - Goal: use as a reference and small supplement if export is available.
   - Use: lower priority because bulk export is not as clean.

## Who Should Download

If this machine can reach `api.chess.com`, Codex can download faster because it can automate every archive month and produce counts immediately.

If this machine is blocked by FortiGuard or another web filter, the user will be faster by running the script on an unblocked connection, then placing the downloaded folder back into the repo workspace. The script is designed so the same files and counts are reproducible either way.

## Current Download Attempt

Codex attempted the Chess.com PubAPI download from this workspace on 2026-05-02. The restricted network returned `HTTP 403`. After switching to a mobile network and making the downloader resumable with socket-disconnect handling, the full Chess.com account archive downloaded successfully.

Downloaded files:

- Monthly PGNs: `data/player-games/hikaru/raw/chesscom/*.pgn`
- Combined PGN: `data/player-games/hikaru/raw/chesscom/hikaru_all.pgn`
- Count summary: `data/player-games/hikaru/download-summary.json`

## Bot Selection Integration

The bot identity is now selected in `Custom Bot Setup`, not in the settings panel.

- Bot 1 and Bot 2 each have their own bot selector.
- Available bot choices: Hikaru, Stockfish Lite, Stockfish Full.
- Hikaru uses the trained style prior to rerank Stockfish candidate moves.
- Stockfish Lite and Stockfish Full use normal Stockfish move choice.
- Stockfish Full remains disabled when the full engine bundle is unavailable.
- Bot images are stored in `public/bot-avatars/hikaru.jpg` and `public/bot-avatars/stockfish.jpeg`.
- The Hikaru card includes an info badge that explains the held-out style-prior evaluation: top-1 15.74%, top-3 28.87%, top-5 37.31%, with opening positions at top-1 46.17%, top-3 68.80%, top-5 78.26%.
- `next.config.ts` rewrites `/engines/stockfish/stockfish-18-single.wasm` to `STOCKFISH18_FULL_WASM_URL` when deployed. This keeps the browser and worker on the normal local engine path while allowing Vercel to serve the full WASM from the GitHub release asset instead of requiring the ignored 108MB file in the repository.
