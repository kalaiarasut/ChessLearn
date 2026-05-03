#!/usr/bin/env python3
"""Download and count Hikaru game sources for the Chessify bot project.

Raw game corpora are intentionally written under data/player-games/, which is
gitignored because the files can become large.
"""

from __future__ import annotations

import argparse
import http.client
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
RAW_DIR = BASE_DIR / "raw"
CHESSCOM_DIR = RAW_DIR / "chesscom"
SUMMARY_PATH = BASE_DIR / "download-summary.json"

USER_AGENT = "Chessify-HikaruBotResearch/0.1 (contact: dev@chessify.local)"


@dataclass
class PgnGame:
    text: str
    headers: dict[str, str]


def request_text(
    url: str,
    accept: str = "application/json",
    retries: int = 3,
    insecure: bool = False,
) -> str:
    last_error: Exception | None = None
    retried_insecure = False
    for attempt in range(1, retries + 1):
        req = Request(
            url,
            headers={
                "User-Agent": USER_AGENT,
                "Accept": accept,
                "Accept-Encoding": "identity",
            },
        )
        try:
            context = ssl._create_unverified_context() if insecure else None
            with urlopen(req, timeout=45, context=context) as response:
                return response.read().decode("utf-8", errors="replace")
        except HTTPError as exc:
            last_error = exc
            if exc.code == 429:
                wait = 30 * attempt
                print(f"429 rate limited, waiting {wait}s: {url}")
                time.sleep(wait)
                continue
            body = exc.read(500).decode("utf-8", errors="replace")
            raise RuntimeError(f"HTTP {exc.code} for {url}: {body[:200]}") from exc
        except URLError as exc:
            last_error = exc
            reason = getattr(exc, "reason", None)
            if (
                not insecure
                and not retried_insecure
                and isinstance(reason, ssl.SSLCertVerificationError)
            ):
                print(f"TLS certificate verification failed; retrying unverified TLS for: {url}")
                retried_insecure = True
                insecure = True
                continue
            time.sleep(3 * attempt)
        except http.client.RemoteDisconnected as exc:
            last_error = exc
            wait = 3 * attempt
            print(f"Remote closed connection, retrying in {wait}s: {url}")
            time.sleep(wait)
        except (ConnectionResetError, TimeoutError, OSError) as exc:
            last_error = exc
            wait = 3 * attempt
            print(f"Network error, retrying in {wait}s: {url}: {exc}")
            time.sleep(wait)

    curl_text = request_text_with_curl(url, accept=accept, insecure=insecure)
    if curl_text is not None:
        return curl_text
    raise RuntimeError(f"Failed after {retries} attempts: {url}: {last_error}")


def request_text_with_curl(url: str, accept: str, insecure: bool) -> str | None:
    curl = shutil.which("curl.exe") or shutil.which("curl")
    if not curl:
        return None

    command = [
        curl,
        "-sS",
        "-L",
        "--retry",
        "5",
        "--retry-delay",
        "3",
        "--retry-all-errors",
        "-A",
        USER_AGENT,
        "-H",
        f"Accept: {accept}",
        "-H",
        "Accept-Encoding: identity",
    ]
    if insecure:
        command.append("-k")
    command.append(url)

    print(f"Falling back to curl for: {url}")
    result = subprocess.run(command, capture_output=True, text=True, timeout=90)
    if result.returncode != 0:
        print(result.stderr.strip())
        return None
    return result.stdout


def split_pgn_games(pgn: str) -> list[PgnGame]:
    chunks = re.split(r"\n\s*\n(?=\[Event\s+\")", pgn.strip())
    games: list[PgnGame] = []
    for chunk in chunks:
        if not chunk.strip():
            continue
        headers = dict(re.findall(r'^\[([A-Za-z0-9_]+)\s+"(.*)"\]$', chunk, flags=re.MULTILINE))
        if headers:
            games.append(PgnGame(text=chunk, headers=headers))
    return games


def is_clean_chesscom_game(game: PgnGame) -> bool:
    headers = game.headers
    white = headers.get("White", "").lower()
    black = headers.get("Black", "").lower()
    white_fide_id = headers.get("WhiteFideId", "")
    black_fide_id = headers.get("BlackFideId", "")
    player_names = {white, black}
    is_hikaru = (
        "hikaru" in white
        or "hikaru" in black
        or "nakamura, hikaru" in player_names
        or white_fide_id == "2016192"
        or black_fide_id == "2016192"
    )
    if not is_hikaru:
        return False

    variant = headers.get("Variant", headers.get("Rules", "standard")).lower()
    if variant not in {"", "standard", "chess"}:
        return False

    result = headers.get("Result", "")
    if result not in {"1-0", "0-1", "1/2-1/2"}:
        return False

    termination = headers.get("Termination", "").lower()
    if any(word in termination for word in ("abandoned", "unterminated")):
        return False

    # Count move numbers as a cheap PGN-only filter. The later parser can use
    # python-chess for exact ply counts.
    move_numbers = re.findall(r"\b\d+\.", game.text)
    if len(move_numbers) < 12:
        return False

    return True


def classify_time_class(game: PgnGame) -> str:
    time_class = game.headers.get("TimeClass") or game.headers.get("TimeControl") or "unknown"
    time_class = time_class.lower()
    if time_class in {"bullet", "blitz", "rapid", "daily"}:
        return time_class
    tc = game.headers.get("TimeControl", "")
    match = re.match(r"^(\d+)(?:\+(\d+))?$", tc)
    if not match:
        return "unknown"
    base = int(match.group(1))
    inc = int(match.group(2) or 0)
    estimated_seconds = base + 40 * inc
    if estimated_seconds < 180:
        return "bullet"
    if estimated_seconds < 600:
        return "blitz"
    if estimated_seconds < 3600:
        return "rapid"
    return "classical"


def pgn_duplicate_key(game: PgnGame) -> str:
    headers = game.headers
    moves = re.sub(r"^\[[^\n]+\]\s*", "", game.text, flags=re.MULTILINE).strip()
    moves = re.sub(r"\s+", " ", moves)
    return "|".join(
        [
            headers.get("Date", ""),
            headers.get("White", ""),
            headers.get("Black", ""),
            headers.get("Result", ""),
            moves,
        ]
    ).lower()


def write_json(path: Path, data: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, indent=2, sort_keys=True), encoding="utf-8")


def download_chesscom(username: str = "hikaru", insecure: bool = False) -> dict[str, object]:
    CHESSCOM_DIR.mkdir(parents=True, exist_ok=True)
    archives_url = f"https://api.chess.com/pub/player/{username}/games/archives"
    print(f"Fetching archive list: {archives_url}")
    archive_payload = json.loads(request_text(archives_url, insecure=insecure))
    archives = archive_payload.get("archives", [])
    archive_path = CHESSCOM_DIR / "archives.json"
    write_json(archive_path, archive_payload)

    monthly_counts: list[dict[str, object]] = []
    all_pgn_path = CHESSCOM_DIR / f"{username}_all.pgn"

    total = 0
    clean = 0
    by_time_class: dict[str, int] = {}

    for index, archive_url in enumerate(archives, start=1):
        year_month = "/".join(archive_url.rstrip("/").split("/")[-2:])
        pgn_url = f"{archive_url}/pgn"
        out_path = CHESSCOM_DIR / f"{year_month.replace('/', '-')}.pgn"
        if out_path.exists() and out_path.stat().st_size > 0:
            print(f"[{index}/{len(archives)}] Using existing {year_month}: {out_path}")
            pgn = out_path.read_text(encoding="utf-8", errors="replace")
        else:
            print(f"[{index}/{len(archives)}] Fetching {year_month}")
            pgn = request_text(
                pgn_url,
                accept="application/x-chess-pgn,text/plain,*/*",
                insecure=insecure,
            )
            out_path.parent.mkdir(parents=True, exist_ok=True)
            out_path.write_text(pgn, encoding="utf-8")

        games = split_pgn_games(pgn)
        clean_games = [game for game in games if is_clean_chesscom_game(game)]
        total += len(games)
        clean += len(clean_games)
        month_by_class: dict[str, int] = {}
        for game in clean_games:
            cls = classify_time_class(game)
            by_time_class[cls] = by_time_class.get(cls, 0) + 1
            month_by_class[cls] = month_by_class.get(cls, 0) + 1
        monthly_counts.append(
            {
                "month": year_month,
                "games": len(games),
                "clean_games": len(clean_games),
                "clean_by_time_class": month_by_class,
                "file": str(out_path.relative_to(ROOT)),
            }
        )
        time.sleep(1.1)

    with all_pgn_path.open("w", encoding="utf-8") as combined:
        for item in monthly_counts:
            monthly_path = ROOT / str(item["file"])
            if monthly_path.exists() and monthly_path.stat().st_size > 0:
                combined.write(monthly_path.read_text(encoding="utf-8", errors="replace").rstrip())
                combined.write("\n\n")

    return {
        "source": "chesscom",
        "username": username,
        "archive_months": len(archives),
        "raw_games": total,
        "clean_games": clean,
        "clean_by_time_class": by_time_class,
        "combined_pgn": str(all_pgn_path.relative_to(ROOT)),
        "monthly_counts": monthly_counts,
    }


def count_manual() -> dict[str, object]:
    manual_dir = RAW_DIR / "manual"
    files = sorted(manual_dir.glob("*.pgn")) if manual_dir.exists() else []
    total = 0
    clean = 0
    by_file = []
    by_time_class: dict[str, int] = {}
    seen_game_keys: set[str] = set()
    duplicate_games = 0
    for path in files:
        pgn = path.read_text(encoding="utf-8", errors="replace")
        games = split_pgn_games(pgn)
        unique_games = []
        duplicate_games_in_file = 0
        for game in games:
            key = pgn_duplicate_key(game)
            if key in seen_game_keys:
                duplicate_games += 1
                duplicate_games_in_file += 1
                continue
            seen_game_keys.add(key)
            unique_games.append(game)
        clean_games = [game for game in unique_games if is_clean_chesscom_game(game)]
        total += len(unique_games)
        clean += len(clean_games)
        for game in clean_games:
            cls = classify_time_class(game)
            by_time_class[cls] = by_time_class.get(cls, 0) + 1
        by_file.append(
            {
                "file": str(path.relative_to(ROOT)),
                "games": len(games),
                "unique_games_added": len(unique_games),
                "duplicate_games_skipped": duplicate_games_in_file,
                "clean_games": len(clean_games),
            }
        )
    return {
        "source": "manual",
        "raw_games": total,
        "clean_games": clean,
        "duplicate_games_skipped": duplicate_games,
        "clean_by_time_class": by_time_class,
        "files": by_file,
    }


def main(argv: Iterable[str]) -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", choices=["chesscom", "manual", "all"], default="all")
    parser.add_argument("--username", default="hikaru")
    parser.add_argument(
        "--insecure",
        action="store_true",
        help="Disable TLS verification. Use only behind local TLS inspection/proxy issues.",
    )
    args = parser.parse_args(list(argv))

    summaries = []
    if args.source in {"chesscom", "all"}:
        summaries.append(download_chesscom(args.username, insecure=args.insecure))
    if args.source in {"manual", "all"}:
        summaries.append(count_manual())

    write_json(SUMMARY_PATH, {"sources": summaries})
    print(json.dumps({"sources": summaries}, indent=2, sort_keys=True))
    print(f"Wrote {SUMMARY_PATH}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
