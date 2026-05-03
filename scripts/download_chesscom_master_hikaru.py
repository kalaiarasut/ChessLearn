#!/usr/bin/env python3
"""Download Hikaru games from Chess.com's Master Games Database."""

from __future__ import annotations

import argparse
import html
import json
import re
import shutil
import subprocess
import sys
import time
from pathlib import Path
from typing import Iterable


ROOT = Path(__file__).resolve().parents[1]
BASE_DIR = ROOT / "data" / "player-games" / "hikaru"
RAW_DIR = BASE_DIR / "raw" / "manual"
PAGE_DIR = BASE_DIR / "raw" / "chesscom-master-pages"
CHUNK_DIR = BASE_DIR / "raw" / "chesscom-master-chunks"
PAGE_CHUNK_DIR = BASE_DIR / "raw" / "chesscom-master-page-chunks"
PAGE_ID_DIR = BASE_DIR / "raw" / "chesscom-master-page-ids"
COMBINED_PATH = RAW_DIR / "chesscom-master-hikaru-full.pgn"
SUMMARY_PATH = BASE_DIR / "chesscom-master-summary.json"

SEARCH_URL = (
    "https://www.chess.com/games/search"
    "?fromSearchShort=1&p1=Hikaru%20Nakamura&playerId=291573&page={page}"
)
DOWNLOAD_URL = "https://www.chess.com/games/downloadPgn?game_ids={game_ids}"
USER_AGENT = "Mozilla/5.0 Chessify-HikaruBotResearch/0.1"


def curl_text(url: str, timeout: int = 120) -> str:
    curl = shutil.which("curl.exe") or shutil.which("curl")
    if not curl:
        raise RuntimeError("curl.exe is required for this downloader on Windows.")
    result = subprocess.run(
        [
            curl,
            "-k",
            "-L",
            "-sS",
            "--retry",
            "6",
            "--retry-delay",
            "4",
            "--retry-all-errors",
            "-A",
            USER_AGENT,
            url,
        ],
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
        timeout=timeout,
    )
    if result.returncode != 0:
        raise RuntimeError(result.stderr.strip() or f"curl failed for {url}")
    return result.stdout


def split_pgn_games(pgn: str) -> list[str]:
    if not pgn.strip():
        return []
    return [chunk.strip() for chunk in re.split(r"\n\s*\n(?=\[Event\s+\")", pgn.strip()) if chunk.strip()]


def get_page_count(html_text: str) -> int:
    match = re.search(r'data-total-pages="(\d+)"', html_text)
    if match:
        return int(match.group(1))
    pages = [int(item) for item in re.findall(r"[?&]page=(\d+)", html.unescape(html_text))]
    return max(pages) if pages else 1


def extract_game_ids(html_text: str) -> list[str]:
    ids = re.findall(r'data-game-id="(\d+)"', html_text)
    seen: set[str] = set()
    unique = []
    for game_id in ids:
        if game_id not in seen:
            seen.add(game_id)
            unique.append(game_id)
    return unique


def download_chunk_pgn(index: int, game_ids: list[str], retries: int = 4) -> str:
    chunk_path = CHUNK_DIR / f"chunk-{index:04d}.pgn"
    if chunk_path.exists() and chunk_path.stat().st_size > 0:
        text = chunk_path.read_text(encoding="utf-8", errors="replace")
        if len(split_pgn_games(text)) == len(game_ids):
            return text

    for attempt in range(1, retries + 1):
        pgn = curl_text(DOWNLOAD_URL.format(game_ids=",".join(game_ids)))
        games = split_pgn_games(pgn)
        if len(games) == len(game_ids):
            chunk_path.parent.mkdir(parents=True, exist_ok=True)
            chunk_path.write_text(pgn, encoding="utf-8")
            return pgn
        wait = 10 * attempt
        print(
            f"Chunk {index:04d} returned {len(games)}/{len(game_ids)} PGNs; "
            f"retrying in {wait}s"
        )
        time.sleep(wait)
    raise RuntimeError(f"Chunk {index:04d} failed after {retries} attempts")


def download_page_chunk_pgn(page: int, chunk_index: int, game_ids: list[str], retries: int = 5) -> str:
    chunk_path = PAGE_CHUNK_DIR / f"page-{page:03d}-chunk-{chunk_index:02d}.pgn"
    if chunk_path.exists() and chunk_path.stat().st_size > 0:
        text = chunk_path.read_text(encoding="utf-8", errors="replace")
        if len(split_pgn_games(text)) == len(game_ids):
            return text

    for attempt in range(1, retries + 1):
        pgn = curl_text(DOWNLOAD_URL.format(game_ids=",".join(game_ids)))
        games = split_pgn_games(pgn)
        if len(games) == len(game_ids):
            chunk_path.parent.mkdir(parents=True, exist_ok=True)
            chunk_path.write_text(pgn, encoding="utf-8")
            return pgn
        wait = 12 * attempt
        print(
            f"Page {page:03d} chunk {chunk_index:02d} returned "
            f"{len(games)}/{len(game_ids)} PGNs; retrying in {wait}s"
        )
        time.sleep(wait)
    raise RuntimeError(f"Page {page:03d} chunk {chunk_index:02d} failed after {retries} attempts")


def expected_ids_for_page(page: int, total_pages: int, total_games: int = 8532) -> int:
    if page < total_pages:
        return 25
    return total_games - ((total_pages - 1) * 25)


def load_or_fetch_page_ids(page: int, total_pages: int, sleep: float, retries: int = 8) -> list[str]:
    id_path = PAGE_ID_DIR / f"page-{page:03d}.json"
    expected = expected_ids_for_page(page, total_pages)
    if id_path.exists():
        payload = json.loads(id_path.read_text(encoding="utf-8"))
        ids = payload.get("ids", [])
        if len(ids) == expected:
            return ids

    for attempt in range(1, retries + 1):
        html_text = curl_text(SEARCH_URL.format(page=page))
        ids = extract_game_ids(html_text)
        if len(ids) == expected:
            PAGE_ID_DIR.mkdir(parents=True, exist_ok=True)
            id_path.write_text(
                json.dumps({"page": page, "expected": expected, "ids": ids}, indent=2),
                encoding="utf-8",
            )
            return ids
        wait = max(5, sleep * 5) * attempt
        print(
            f"[{page}/{total_pages}] Expected {expected} IDs, got {len(ids)}; "
            f"retrying in {wait:.1f}s"
        )
        time.sleep(wait)
    raise RuntimeError(f"Could not fetch complete ID list for page {page}")


def chunks(items: list[str], size: int) -> Iterable[list[str]]:
    for index in range(0, len(items), size):
        yield items[index : index + size]


def main(argv: Iterable[str]) -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--limit-pages", type=int, default=None)
    parser.add_argument("--start-page", type=int, default=1)
    parser.add_argument("--end-page", type=int, default=None)
    parser.add_argument("--sleep", type=float, default=0.4)
    parser.add_argument("--chunk-size", type=int, default=10)
    parser.add_argument("--page-mode", action="store_true", help="Use stable per-page chunks.")
    parser.add_argument("--rebuild-only", action="store_true", help="Only rebuild combined PGN from saved page chunks.")
    args = parser.parse_args(list(argv))

    RAW_DIR.mkdir(parents=True, exist_ok=True)
    PAGE_DIR.mkdir(parents=True, exist_ok=True)
    CHUNK_DIR.mkdir(parents=True, exist_ok=True)
    PAGE_CHUNK_DIR.mkdir(parents=True, exist_ok=True)
    PAGE_ID_DIR.mkdir(parents=True, exist_ok=True)

    first_html = curl_text(SEARCH_URL.format(page=1))
    actual_total_pages = get_page_count(first_html)
    total_pages = actual_total_pages
    if args.limit_pages is not None:
        total_pages = min(total_pages, args.limit_pages)
    if args.end_page is not None:
        total_pages = min(total_pages, args.end_page)
    if args.start_page < 1:
        raise ValueError("--start-page must be 1 or higher")
    if args.start_page > actual_total_pages:
        raise ValueError(f"--start-page cannot be higher than {actual_total_pages}")

    if args.page_mode or args.rebuild_only:
        page_summaries = []
        chunk_summaries = []
        combined_games: list[str] = []
        seen_game_keys: set[str] = set()
        all_ids: list[str] = []
        seen_ids: set[str] = set()

        if not args.rebuild_only:
            for page in range(args.start_page, total_pages + 1):
                print(f"[{page}/{actual_total_pages}] Fetching stable page IDs")
                ids = load_or_fetch_page_ids(page, actual_total_pages, args.sleep)
                new_ids = [game_id for game_id in ids if game_id not in seen_ids]
                for game_id in new_ids:
                    seen_ids.add(game_id)
                    all_ids.append(game_id)

                page_games = 0
                for chunk_index, game_ids in enumerate(chunks(new_ids, args.chunk_size), start=1):
                    print(
                        f"[{page}/{actual_total_pages}] Downloading page chunk "
                        f"{chunk_index} ({len(game_ids)} games)"
                    )
                    pgn = download_page_chunk_pgn(page, chunk_index, game_ids)
                    page_games += len(split_pgn_games(pgn))
                    time.sleep(args.sleep)

                page_summaries.append(
                    {
                        "page": page,
                        "ids": len(ids),
                        "new_ids": len(new_ids),
                        "pgn_games": page_games,
                    }
                )
                time.sleep(args.sleep)

        chunk_files = sorted(PAGE_CHUNK_DIR.glob("page-*-chunk-*.pgn"))
        for path in chunk_files:
            pgn_games = split_pgn_games(path.read_text(encoding="utf-8", errors="replace"))
            unique_in_file = 0
            for game in pgn_games:
                key = re.sub(r"\s+", " ", game)
                if key in seen_game_keys:
                    continue
                seen_game_keys.add(key)
                combined_games.append(game)
                unique_in_file += 1
            chunk_summaries.append(
                {
                    "file": str(path.relative_to(ROOT)),
                    "pgn_games": len(pgn_games),
                    "unique_games_added": unique_in_file,
                }
            )

        COMBINED_PATH.write_text("\n\n".join(combined_games) + "\n", encoding="utf-8")
        page_id_files = sorted(PAGE_ID_DIR.glob("page-*.json"))
        manifest_ids = []
        manifest_seen = set()
        for path in page_id_files:
            payload = json.loads(path.read_text(encoding="utf-8"))
            for game_id in payload.get("ids", []):
                if game_id not in manifest_seen:
                    manifest_seen.add(game_id)
                    manifest_ids.append(game_id)
        summary = {
            "source": "chesscom-master-games",
            "mode": "page-mode",
            "actual_total_pages": actual_total_pages,
            "processed_start_page": args.start_page,
            "processed_end_page": total_pages,
            "manifest_pages": len(page_id_files),
            "unique_game_ids": len(manifest_ids),
            "downloaded_pgn_games": len(combined_games),
            "combined_pgn": str(COMBINED_PATH.relative_to(ROOT)),
            "page_chunks_dir": str(PAGE_CHUNK_DIR.relative_to(ROOT)),
            "page_ids_dir": str(PAGE_ID_DIR.relative_to(ROOT)),
            "page_summaries": page_summaries,
            "chunk_summaries": chunk_summaries,
        }
        SUMMARY_PATH.write_text(json.dumps(summary, indent=2, sort_keys=True), encoding="utf-8")
        print(json.dumps(summary, indent=2, sort_keys=True))
        print(f"Wrote {SUMMARY_PATH}")
        return 0

    all_ids: list[str] = []
    seen_ids: set[str] = set()
    page_summaries = []

    page = 1
    while page <= total_pages:
        print(f"[{page}/{total_pages}] Fetching search page")
        html_text = first_html if page == 1 else curl_text(SEARCH_URL.format(page=page))
        ids = extract_game_ids(html_text)
        if not ids:
            print(f"[{page}/{total_pages}] No IDs found; retrying after 10s")
            time.sleep(10)
            html_text = curl_text(SEARCH_URL.format(page=page))
            ids = extract_game_ids(html_text)
        new_ids = [game_id for game_id in ids if game_id not in seen_ids]
        for game_id in new_ids:
            seen_ids.add(game_id)
            all_ids.append(game_id)

        page_summaries.append(
            {
                "page": page,
                "ids": len(ids),
                "new_ids": len(new_ids),
            }
        )
        page += 1
        time.sleep(args.sleep)

    combined_games: list[str] = []
    chunk_summaries = []
    game_id_chunks = list(chunks(all_ids, args.chunk_size))
    for index, game_ids in enumerate(game_id_chunks, start=1):
        print(f"[chunk {index}/{len(game_id_chunks)}] Downloading {len(game_ids)} games")
        pgn = download_chunk_pgn(index, game_ids)
        pgn_games = split_pgn_games(pgn)
        combined_games.extend(pgn_games)
        chunk_summaries.append(
            {
                "chunk": index,
                "ids": len(game_ids),
                "pgn_games": len(pgn_games),
                "file": str((CHUNK_DIR / f"chunk-{index:04d}.pgn").relative_to(ROOT)),
            }
        )
        time.sleep(args.sleep)

    COMBINED_PATH.write_text("\n\n".join(combined_games) + "\n", encoding="utf-8")
    summary = {
        "source": "chesscom-master-games",
        "pages": total_pages,
        "unique_game_ids": len(all_ids),
        "downloaded_pgn_games": len(combined_games),
        "combined_pgn": str(COMBINED_PATH.relative_to(ROOT)),
        "chunks_dir": str(CHUNK_DIR.relative_to(ROOT)),
        "page_summaries": page_summaries,
        "chunk_summaries": chunk_summaries,
    }
    SUMMARY_PATH.write_text(json.dumps(summary, indent=2, sort_keys=True), encoding="utf-8")
    print(json.dumps(summary, indent=2, sort_keys=True))
    print(f"Wrote {SUMMARY_PATH}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
