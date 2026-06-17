# Download Chesscom Master Hikaru Component

> 23 nodes · cohesion 0.19

## Key Concepts

- **main()** (11 connections) — `scripts/download_chesscom_master_hikaru.py`
- **download_chesscom_master_hikaru.py** (10 connections) — `scripts/download_chesscom_master_hikaru.py`
- **download_lichess_broadcast_hikaru.py** (10 connections) — `scripts/download_lichess_broadcast_hikaru.py`
- **main()** (9 connections) — `scripts/download_lichess_broadcast_hikaru.py`
- **curl_text()** (5 connections) — `scripts/download_chesscom_master_hikaru.py`
- **load_or_fetch_page_ids()** (5 connections) — `scripts/download_chesscom_master_hikaru.py`
- **download_chunk_pgn()** (4 connections) — `scripts/download_chesscom_master_hikaru.py`
- **download_page_chunk_pgn()** (4 connections) — `scripts/download_chesscom_master_hikaru.py`
- **split_pgn_games()** (4 connections) — `scripts/download_chesscom_master_hikaru.py`
- **extract_game_ids()** (3 connections) — `scripts/download_chesscom_master_hikaru.py`
- **decompress_zst()** (3 connections) — `scripts/download_lichess_broadcast_hikaru.py`
- **download_file()** (3 connections) — `scripts/download_lichess_broadcast_hikaru.py`
- **get_broadcast_urls()** (3 connections) — `scripts/download_lichess_broadcast_hikaru.py`
- **get_local_zst_files()** (3 connections) — `scripts/download_lichess_broadcast_hikaru.py`
- **is_hikaru_game()** (3 connections) — `scripts/download_lichess_broadcast_hikaru.py`
- **PgnGame** (3 connections) — `scripts/download_lichess_broadcast_hikaru.py`
- **Path** (3 connections) — `scripts/download_lichess_broadcast_hikaru.py`
- **request_text()** (3 connections) — `scripts/download_lichess_broadcast_hikaru.py`
- **split_pgn_games()** (3 connections) — `scripts/download_lichess_broadcast_hikaru.py`
- **chunks()** (2 connections) — `scripts/download_chesscom_master_hikaru.py`
- **expected_ids_for_page()** (2 connections) — `scripts/download_chesscom_master_hikaru.py`
- **get_page_count()** (2 connections) — `scripts/download_chesscom_master_hikaru.py`
- **request_text_with_curl()** (2 connections) — `scripts/download_lichess_broadcast_hikaru.py`

## Relationships

- [[Puzzle UI Dashboard Components]] (2 shared connections)

## Source Files

- `scripts/download_chesscom_master_hikaru.py`
- `scripts/download_lichess_broadcast_hikaru.py`

## Audit Trail

- EXTRACTED: 96 (96%)
- INFERRED: 4 (4%)
- AMBIGUOUS: 0 (0%)

---

*Part of the graphify knowledge wiki. See [[index]] to navigate.*