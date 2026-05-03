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
| Chess.com account `hikaru` | 68,016 raw games, 66,284 clean standard games downloaded | Primary source for bullet/blitz style | Downloaded via PubAPI |
| Chess.com master games page | 8,532 listed games | Curated master/tournament supplement | Needs scraping/export check and dedupe |
| 365Chess Hikaru profile | 3,659 listed games | OTB/classical/rapid supplement | Download likely requires account/session |
| Lichess FIDE broadcasts | 100+ tournament pages visible | Recent elite rapid/blitz/classical broadcast games | Needs tournament PGN extraction and dedupe |
| ChessMonitor Masters DB | 10.1M global master games | Reference/cross-check, possible export if account access exists | Likely overlaps TWIC/Lichess/365Chess |
| ChessPrime | 247 listed games | Low-priority supplement | Too small to matter much |

Current Chess.com clean corpus:

- Total clean standard games: 66,284.
- Blitz: 45,735.
- Bullet: 19,400.
- Rapid: 895.
- Classical by inferred time control: 72.
- Unknown time class: 182.

Current manual Chess.com Master Games export:

- Raw games: 25.
- Clean games: 25.
- Time class: blitz.
- Note: this export appears to contain only selected/visible rows, not the full 8,532 listed master games.

Expected final unique clean Hikaru corpus after adding non-Chess.com sources and dedupe:

- Chess.com base: 66,284 clean standard games.
- All practical sources: about 70k-74k useful unique games after dedupe.

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
