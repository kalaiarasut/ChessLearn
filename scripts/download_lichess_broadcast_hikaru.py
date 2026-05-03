#!/usr/bin/env python3
"""Download Lichess broadcast PGNs and extract Hikaru Nakamura games."""

from __future__ import annotations

import argparse
import json
import re
import shutil
import ssl
import subprocess
import sys
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


ROOT = Path(__file__).resolve().parents[1]
BASE_DIR = ROOT / "data" / "player-games" / "hikaru"
RAW_DIR = BASE_DIR / "raw" / "lichess-broadcast"
ZST_DIR = RAW_DIR / "zst"
MONTHLY_MATCH_DIR = RAW_DIR / "monthly-matches"
COMBINED_PATH = RAW_DIR / "hikaru_lichess_broadcast.pgn"
SUMMARY_PATH = BASE_DIR / "lichess-broadcast-summary.json"

LIST_URL = "https://database.lichess.org/broadcast/list.txt"
USER_AGENT = "Chessify-HikaruBotResearch/0.1 (contact: dev@chessify.local)"
HIKARU_FIDE_ID = "2016192"


@dataclass
class PgnGame:
    text: str
    headers: dict[str, str]


def request_text(url: str, retries: int = 4) -> str:
    last_error: Exception | None = None
    retried_insecure = False
    for attempt in range(1, retries + 1):
        req = Request(url, headers={"User-Agent": USER_AGENT, "Accept": "text/plain,*/*"})
        try:
            context = ssl._create_unverified_context() if retried_insecure else None
            with urlopen(req, timeout=45, context=context) as response:
                return response.read().decode("utf-8", errors="replace")
        except HTTPError as exc:
            last_error = exc
            if exc.code == 429:
                wait = 30 * attempt
                print(f"429 rate limited, waiting {wait}s: {url}")
                time.sleep(wait)
                continue
            raise
        except (URLError, TimeoutError, ConnectionResetError, OSError) as exc:
            last_error = exc
            reason = getattr(exc, "reason", None)
            if isinstance(reason, ssl.SSLCertVerificationError) and not retried_insecure:
                print(f"TLS certificate verification failed; retrying unverified TLS for: {url}")
                retried_insecure = True
                continue
            time.sleep(3 * attempt)
    curl_text = request_text_with_curl(url)
    if curl_text is not None:
        return curl_text
    raise RuntimeError(f"Failed after {retries} attempts: {url}: {last_error}")


def request_text_with_curl(url: str) -> str | None:
    curl = shutil.which("curl.exe") or shutil.which("curl")
    if not curl:
        return None
    command = [
        curl,
        "-k",
        "-sS",
        "-L",
        "--retry",
        "5",
        "--retry-delay",
        "3",
        "--retry-all-errors",
        "-A",
        USER_AGENT,
        url,
    ]
    print(f"Falling back to curl for: {url}")
    result = subprocess.run(command, capture_output=True, text=True, timeout=90)
    if result.returncode != 0:
        print(result.stderr.strip())
        return None
    return result.stdout


def download_file(url: str, path: Path) -> None:
    if path.exists() and path.stat().st_size > 0:
        print(f"Using existing {path.name}")
        return

    path.parent.mkdir(parents=True, exist_ok=True)
    curl = shutil.which("curl.exe") or shutil.which("curl")
    if curl:
        command = [
            curl,
            "-k",
            "-L",
            "--fail",
            "--retry",
            "6",
            "--retry-delay",
            "5",
            "--retry-all-errors",
            "-A",
            USER_AGENT,
            "-o",
            str(path),
            url,
        ]
        subprocess.run(command, check=True)
        return

    req = Request(url, headers={"User-Agent": USER_AGENT})
    with urlopen(req, timeout=120) as response:
        path.write_bytes(response.read())


def get_broadcast_urls(limit: int | None = None) -> list[str]:
    text = request_text(LIST_URL)
    urls = [item for item in text.split() if item.endswith(".pgn.zst")]

    # The HTML page can list the newest month before list.txt catches up.
    newest_known = "https://database.lichess.org/broadcast/lichess_db_broadcast_2026-04.pgn.zst"
    if newest_known not in urls:
        urls.insert(0, newest_known)

    if limit is not None:
        return urls[:limit]
    return urls


def get_local_zst_files(limit: int | None = None) -> list[Path]:
    files = sorted(ZST_DIR.glob("*.pgn.zst"))
    if limit is not None:
        return files[:limit]
    return files


def split_pgn_games(pgn: str) -> list[PgnGame]:
    chunks = re.split(r"\n\s*\n(?=\[Event\s+\")", pgn.strip())
    games: list[PgnGame] = []
    for chunk in chunks:
        if not chunk.strip():
            continue
        headers = dict(re.findall(r'^\[([A-Za-z0-9_]+)\s+"(.*)"\]$', chunk, flags=re.MULTILINE))
        if headers:
            games.append(PgnGame(text=chunk.strip(), headers=headers))
    return games


def is_hikaru_game(game: PgnGame) -> bool:
    headers = game.headers
    values = " ".join(
        [
            headers.get("White", ""),
            headers.get("Black", ""),
            headers.get("WhiteFideId", ""),
            headers.get("BlackFideId", ""),
        ]
    ).lower()
    return (
        HIKARU_FIDE_ID in values
        or "nakamura, hikaru" in values
        or "hikaru nakamura" in values
        or re.search(r"\bnakamura\b", values) is not None
    )


def decompress_zst(path: Path) -> str:
    seven_zip = shutil.which("7z.exe") or shutil.which("7z")
    if not seven_zip:
        raise RuntimeError("7z.exe is required to decompress .zst files. Install 7-Zip or zstd.")
    result = subprocess.run(
        [seven_zip, "e", "-so", str(path)],
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
        check=True,
    )
    return result.stdout


def main(argv: Iterable[str]) -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--limit", type=int, default=None, help="Only process newest N files.")
    parser.add_argument(
        "--local-only",
        action="store_true",
        help="Do not download. Filter existing .pgn.zst files from the local zst folder.",
    )
    args = parser.parse_args(list(argv))

    RAW_DIR.mkdir(parents=True, exist_ok=True)
    ZST_DIR.mkdir(parents=True, exist_ok=True)
    MONTHLY_MATCH_DIR.mkdir(parents=True, exist_ok=True)

    if args.local_only:
        local_files = get_local_zst_files(args.limit)
        work_items = [(path.name, "", path) for path in local_files]
    else:
        urls = get_broadcast_urls(args.limit)
        work_items = [(url.rsplit("/", 1)[-1], url, ZST_DIR / url.rsplit("/", 1)[-1]) for url in urls]

    source_summaries = []
    total_games = 0
    total_matches = 0
    seen_game_urls: set[str] = set()

    with COMBINED_PATH.open("w", encoding="utf-8") as combined:
        for index, (name, url, zst_path) in enumerate(work_items, start=1):
            month = name.replace("lichess_db_broadcast_", "").replace(".pgn.zst", "")
            match_path = MONTHLY_MATCH_DIR / f"{month}.pgn"

            if args.local_only:
                print(f"[{index}/{len(work_items)}] Using local {name}")
            else:
                print(f"[{index}/{len(work_items)}] Downloading {name}")
                try:
                    download_file(url, zst_path)
                except Exception as exc:
                    print(f"Skipping {name}: {exc}")
                    source_summaries.append({"month": month, "error": str(exc), "url": url})
                    continue

            print(f"[{index}/{len(work_items)}] Filtering {name}")
            pgn = decompress_zst(zst_path)
            games = split_pgn_games(pgn)
            matches = []
            for game in games:
                if not is_hikaru_game(game):
                    continue
                game_url = game.headers.get("GameURL", "")
                if game_url and game_url in seen_game_urls:
                    continue
                if game_url:
                    seen_game_urls.add(game_url)
                matches.append(game)

            total_games += len(games)
            total_matches += len(matches)
            match_path.write_text(
                "\n\n".join(game.text for game in matches) + ("\n" if matches else ""),
                encoding="utf-8",
            )
            for game in matches:
                combined.write(game.text)
                combined.write("\n\n")

            source_summaries.append(
                {
                    "month": month,
                    "broadcast_games": len(games),
                    "hikaru_matches": len(matches),
                    "compressed_file": str(zst_path.relative_to(ROOT)),
                    "match_file": str(match_path.relative_to(ROOT)),
                    "url": url,
                }
            )
            time.sleep(0.5)

    summary = {
        "source": "lichess-broadcast",
        "files": len(work_items),
        "broadcast_games_scanned": total_games,
        "hikaru_matches": total_matches,
        "combined_pgn": str(COMBINED_PATH.relative_to(ROOT)),
        "monthly": source_summaries,
    }
    SUMMARY_PATH.write_text(json.dumps(summary, indent=2, sort_keys=True), encoding="utf-8")
    print(json.dumps(summary, indent=2, sort_keys=True))
    print(f"Wrote {SUMMARY_PATH}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
