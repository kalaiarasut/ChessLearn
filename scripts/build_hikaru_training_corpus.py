#!/usr/bin/env python3
"""Build a duplicate-safe Hikaru training corpus from downloaded PGNs."""

from __future__ import annotations

import argparse
import json
import re
import sys
from collections import Counter, defaultdict
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable

import chess
import chess.pgn


ROOT = Path(__file__).resolve().parents[1]
BASE_DIR = ROOT / "data" / "player-games" / "hikaru"
RAW_DIR = BASE_DIR / "raw"
PROCESSED_DIR = BASE_DIR / "processed"

MASTER_FULL = RAW_DIR / "manual" / "chesscom-master-hikaru-full.pgn"
MANUAL_SEED = RAW_DIR / "manual" / "chesscom-master-hikaru.pgn"
CHESSCOM_ALL = RAW_DIR / "chesscom" / "hikaru_all.pgn"
LICHESS_BROADCAST = RAW_DIR / "lichess-broadcast" / "hikaru_lichess_broadcast.pgn"

COMBINED_CLEAN = PROCESSED_DIR / "hikaru_clean_unique.pgn"
TRAIN_PGN = PROCESSED_DIR / "hikaru_train.pgn"
TEST_PGN = PROCESSED_DIR / "hikaru_test.pgn"
SUMMARY_JSON = PROCESSED_DIR / "hikaru_corpus_summary.json"
SUMMARY_MD = PROCESSED_DIR / "hikaru_corpus_summary.md"

HIKARU_FIDE_ID = "2016192"
VALID_RESULTS = {"1-0", "0-1", "1/2-1/2"}
STANDARD_VARIANTS = {"", "standard", "chess", "from position"}


@dataclass(frozen=True)
class SourceSpec:
    label: str
    path: Path


@dataclass
class AcceptedGame:
    game: chess.pgn.Game
    source: str
    source_file: str
    year: int | None
    time_class: str
    plies: int
    hikaru_color: str
    hikaru_target_positions: int
    opening_positions: int
    middlegame_positions: int
    endgame_positions: int


def source_specs() -> list[SourceSpec]:
    sources = [
        SourceSpec("chesscom-master", MASTER_FULL),
        SourceSpec("chesscom-account", CHESSCOM_ALL),
        SourceSpec("lichess-broadcast", LICHESS_BROADCAST),
        SourceSpec("manual-seed", MANUAL_SEED),
    ]
    monthly_dir = RAW_DIR / "lichess-broadcast" / "monthly-matches"
    if monthly_dir.exists():
        for path in sorted(monthly_dir.glob("*.pgn")):
            sources.append(SourceSpec(f"lichess-broadcast-monthly:{path.stem}", path))
    return [source for source in sources if source.path.exists() and source.path.stat().st_size > 0]


def normalize(value: str) -> str:
    return re.sub(r"\s+", " ", value.strip()).lower()


def parse_year(headers: chess.pgn.Headers) -> int | None:
    date = headers.get("Date", "")
    match = re.match(r"^(\d{4})", date)
    if not match:
        return None
    return int(match.group(1))


def is_hikaru(headers: chess.pgn.Headers) -> tuple[bool, str]:
    white = normalize(headers.get("White", ""))
    black = normalize(headers.get("Black", ""))
    white_fide = headers.get("WhiteFideId", "")
    black_fide = headers.get("BlackFideId", "")
    white_match = (
        "hikaru" in white
        or "nakamura" in white
        or white_fide == HIKARU_FIDE_ID
    )
    black_match = (
        "hikaru" in black
        or "nakamura" in black
        or black_fide == HIKARU_FIDE_ID
    )
    if white_match:
        return True, "white"
    if black_match:
        return True, "black"
    return False, ""


def is_standard(headers: chess.pgn.Headers) -> bool:
    variant = normalize(headers.get("Variant", headers.get("Rules", "standard")))
    return variant in STANDARD_VARIANTS


def classify_time_class(headers: chess.pgn.Headers) -> str:
    time_class = normalize(headers.get("TimeClass", ""))
    if time_class in {"bullet", "blitz", "rapid", "daily", "classical"}:
        return time_class

    tc = headers.get("TimeControl", "")
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


def material_count(board: chess.Board) -> int:
    return sum(
        len(board.pieces(piece_type, color))
        for piece_type in (
            chess.PAWN,
            chess.KNIGHT,
            chess.BISHOP,
            chess.ROOK,
            chess.QUEEN,
        )
        for color in (chess.WHITE, chess.BLACK)
    )


def phase_for_position(board: chess.Board, ply_index: int) -> str:
    if ply_index < 20:
        return "opening"
    if material_count(board) <= 12:
        return "endgame"
    return "middlegame"


def clean_termination(headers: chess.pgn.Headers) -> bool:
    termination = normalize(headers.get("Termination", ""))
    if not termination:
        return True
    blocked = ("abandoned", "unterminated", "rules infraction", "fair play")
    return not any(word in termination for word in blocked)


def legal_move_sequence(game: chess.pgn.Game) -> tuple[list[chess.Move], list[str]] | None:
    board = game.board()
    moves: list[chess.Move] = []
    uci_moves: list[str] = []
    try:
        for move in game.mainline_moves():
            if move not in board.legal_moves:
                return None
            board.push(move)
            moves.append(move)
            uci_moves.append(move.uci())
    except Exception:
        return None
    return moves, uci_moves


def duplicate_key(game: chess.pgn.Game, uci_moves: list[str]) -> str:
    headers = game.headers
    return "|".join(
        [
            normalize(headers.get("Date", "")),
            normalize(headers.get("White", "")),
            normalize(headers.get("Black", "")),
            normalize(headers.get("Result", "")),
            " ".join(uci_moves),
        ]
    )


def count_hikaru_positions(game: chess.pgn.Game, hikaru_color: str) -> tuple[int, Counter[str]]:
    board = game.board()
    target_color = chess.WHITE if hikaru_color == "white" else chess.BLACK
    target_positions = 0
    by_phase: Counter[str] = Counter()
    for ply_index, move in enumerate(game.mainline_moves()):
        if board.turn == target_color:
            phase = phase_for_position(board, ply_index)
            target_positions += 1
            by_phase[phase] += 1
        board.push(move)
    return target_positions, by_phase


def decorate_game(game: chess.pgn.Game, accepted: AcceptedGame, split: str) -> chess.pgn.Game:
    game.headers["ChessifySource"] = accepted.source
    game.headers["ChessifySourceFile"] = accepted.source_file
    game.headers["ChessifyTimeClass"] = accepted.time_class
    game.headers["ChessifyHikaruColor"] = accepted.hikaru_color
    game.headers["ChessifySplit"] = split
    return game


def apply_chessify_headers(
    game: chess.pgn.Game,
    source: str,
    source_file: str,
    time_class: str,
    hikaru_color: str,
    split: str,
) -> chess.pgn.Game:
    game.headers["ChessifySource"] = source
    game.headers["ChessifySourceFile"] = source_file
    game.headers["ChessifyTimeClass"] = time_class
    game.headers["ChessifyHikaruColor"] = hikaru_color
    game.headers["ChessifySplit"] = split
    return game


def write_game_to_handle(
    handle,
    exporter: chess.pgn.StringExporter,
    game: chess.pgn.Game,
    source: str,
    source_file: str,
    time_class: str,
    hikaru_color: str,
    split: str,
) -> None:
    apply_chessify_headers(game, source, source_file, time_class, hikaru_color, split)
    handle.write(game.accept(exporter).rstrip())
    handle.write("\n\n")


def write_pgn(path: Path, games: Iterable[AcceptedGame], split: str) -> int:
    exporter = chess.pgn.StringExporter(headers=True, variations=False, comments=False)
    count = 0
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8", newline="\n") as output:
        for accepted in games:
            decorate_game(accepted.game, accepted, split)
            output.write(accepted.game.accept(exporter).rstrip())
            output.write("\n\n")
            count += 1
    return count


def build_summary(accepted: list[AcceptedGame], rejected: dict[str, Counter[str]], total_seen: Counter[str]) -> dict[str, object]:
    by_source = Counter(game.source for game in accepted)
    by_time_class = Counter(game.time_class for game in accepted)
    by_color = Counter(game.hikaru_color for game in accepted)
    by_year = Counter(str(game.year or "unknown") for game in accepted)
    target_positions_by_phase = Counter()
    target_positions_by_source = Counter()
    total_target_positions = 0
    total_plies = 0
    for game in accepted:
        total_plies += game.plies
        total_target_positions += game.hikaru_target_positions
        target_positions_by_phase["opening"] += game.opening_positions
        target_positions_by_phase["middlegame"] += game.middlegame_positions
        target_positions_by_phase["endgame"] += game.endgame_positions
        target_positions_by_source[game.source] += game.hikaru_target_positions

    return {
        "sources_seen": dict(total_seen),
        "accepted_games": len(accepted),
        "accepted_by_source": dict(sorted(by_source.items())),
        "accepted_by_time_class": dict(sorted(by_time_class.items())),
        "accepted_by_hikaru_color": dict(sorted(by_color.items())),
        "accepted_by_year": dict(sorted(by_year.items())),
        "rejected_by_source": {source: dict(counter) for source, counter in sorted(rejected.items())},
        "total_plies": total_plies,
        "hikaru_target_positions": total_target_positions,
        "hikaru_target_positions_by_phase": dict(sorted(target_positions_by_phase.items())),
        "hikaru_target_positions_by_source": dict(sorted(target_positions_by_source.items())),
        "outputs": {
            "combined_clean_pgn": str(COMBINED_CLEAN.relative_to(ROOT)),
            "train_pgn": str(TRAIN_PGN.relative_to(ROOT)),
            "test_pgn": str(TEST_PGN.relative_to(ROOT)),
            "summary_json": str(SUMMARY_JSON.relative_to(ROOT)),
            "summary_md": str(SUMMARY_MD.relative_to(ROOT)),
        },
    }


def write_markdown_summary(summary: dict[str, object], train_count: int, test_count: int, test_year: int) -> None:
    lines = [
        "# Hikaru Training Corpus Summary",
        "",
        f"- Clean unique games: {summary['accepted_games']:,}",
        f"- Train games: {train_count:,}",
        f"- Test games: {test_count:,} (year >= {test_year})",
        f"- Total plies: {summary['total_plies']:,}",
        f"- Hikaru move targets: {summary['hikaru_target_positions']:,}",
        "",
        "## By source",
    ]
    for key, value in summary["accepted_by_source"].items():
        lines.append(f"- {key}: {value:,}")
    lines.extend(["", "## By time class"])
    for key, value in summary["accepted_by_time_class"].items():
        lines.append(f"- {key}: {value:,}")
    lines.extend(["", "## Hikaru target positions by phase"])
    for key, value in summary["hikaru_target_positions_by_phase"].items():
        lines.append(f"- {key}: {value:,}")
    lines.extend(["", "## Rejections"])
    for source, counters in summary["rejected_by_source"].items():
        parts = ", ".join(f"{key}: {value:,}" for key, value in sorted(counters.items()))
        lines.append(f"- {source}: {parts}")
    SUMMARY_MD.write_text("\n".join(lines) + "\n", encoding="utf-8")


def main(argv: Iterable[str]) -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--min-plies", type=int, default=20)
    parser.add_argument("--test-year", type=int, default=2026)
    args = parser.parse_args(list(argv))

    PROCESSED_DIR.mkdir(parents=True, exist_ok=True)
    specs = source_specs()
    if not specs:
        raise RuntimeError("No PGN sources found.")

    rejected: dict[str, Counter[str]] = defaultdict(Counter)
    total_seen: Counter[str] = Counter()
    seen_keys: set[str] = set()

    accepted_count = 0
    train_count = 0
    test_count = 0
    total_plies = 0
    total_target_positions = 0
    by_source: Counter[str] = Counter()
    by_time_class: Counter[str] = Counter()
    by_color: Counter[str] = Counter()
    by_year: Counter[str] = Counter()
    target_positions_by_phase: Counter[str] = Counter()
    target_positions_by_source: Counter[str] = Counter()
    exporter = chess.pgn.StringExporter(headers=True, variations=False, comments=False)

    with (
        COMBINED_CLEAN.open("w", encoding="utf-8", newline="\n") as combined_output,
        TRAIN_PGN.open("w", encoding="utf-8", newline="\n") as train_output,
        TEST_PGN.open("w", encoding="utf-8", newline="\n") as test_output,
    ):
        for spec in specs:
            source_file = str(spec.path.relative_to(ROOT))
            print(f"Reading {spec.label}: {source_file}", flush=True)
            with spec.path.open("r", encoding="utf-8", errors="replace") as handle:
                while True:
                    try:
                        game = chess.pgn.read_game(handle)
                    except Exception as exc:
                        rejected[spec.label]["parse_error"] += 1
                        print(
                            f"Stopping {spec.label} after PGN parse error: {type(exc).__name__}: {exc}",
                            flush=True,
                        )
                        break
                    if game is None:
                        break

                    total_seen[spec.label] += 1
                    headers = game.headers
                    has_hikaru, hikaru_color = is_hikaru(headers)
                    if not has_hikaru:
                        rejected[spec.label]["not_hikaru"] += 1
                        continue
                    if not is_standard(headers):
                        rejected[spec.label]["non_standard"] += 1
                        continue
                    if headers.get("Result", "") not in VALID_RESULTS:
                        rejected[spec.label]["bad_result"] += 1
                        continue
                    if not clean_termination(headers):
                        rejected[spec.label]["bad_termination"] += 1
                        continue

                    legal = legal_move_sequence(game)
                    if legal is None:
                        rejected[spec.label]["illegal_or_unparseable_moves"] += 1
                        continue
                    moves, uci_moves = legal
                    if len(moves) < args.min_plies:
                        rejected[spec.label]["too_short"] += 1
                        continue

                    key = duplicate_key(game, uci_moves)
                    if key in seen_keys:
                        rejected[spec.label]["duplicate"] += 1
                        continue
                    seen_keys.add(key)

                    year = parse_year(headers)
                    time_class = classify_time_class(headers)
                    targets, phase_counts = count_hikaru_positions(game, hikaru_color)
                    split = "test" if (year or 0) >= args.test_year else "train"

                    write_game_to_handle(
                        combined_output,
                        exporter,
                        game,
                        spec.label,
                        source_file,
                        time_class,
                        hikaru_color,
                        "all",
                    )
                    split_output = test_output if split == "test" else train_output
                    write_game_to_handle(
                        split_output,
                        exporter,
                        game,
                        spec.label,
                        source_file,
                        time_class,
                        hikaru_color,
                        split,
                    )

                    accepted_count += 1
                    if split == "test":
                        test_count += 1
                    else:
                        train_count += 1
                    by_source[spec.label] += 1
                    by_time_class[time_class] += 1
                    by_color[hikaru_color] += 1
                    by_year[str(year or "unknown")] += 1
                    total_plies += len(moves)
                    total_target_positions += targets
                    target_positions_by_source[spec.label] += targets
                    target_positions_by_phase["opening"] += phase_counts["opening"]
                    target_positions_by_phase["middlegame"] += phase_counts["middlegame"]
                    target_positions_by_phase["endgame"] += phase_counts["endgame"]

            print(
                f"Finished {spec.label}: seen={total_seen[spec.label]} "
                f"accepted={by_source[spec.label]}",
                flush=True,
            )

    summary = {
        "sources_seen": dict(total_seen),
        "accepted_games": accepted_count,
        "accepted_by_source": dict(sorted(by_source.items())),
        "accepted_by_time_class": dict(sorted(by_time_class.items())),
        "accepted_by_hikaru_color": dict(sorted(by_color.items())),
        "accepted_by_year": dict(sorted(by_year.items())),
        "rejected_by_source": {source: dict(counter) for source, counter in sorted(rejected.items())},
        "total_plies": total_plies,
        "hikaru_target_positions": total_target_positions,
        "hikaru_target_positions_by_phase": dict(sorted(target_positions_by_phase.items())),
        "hikaru_target_positions_by_source": dict(sorted(target_positions_by_source.items())),
        "outputs": {
            "combined_clean_pgn": str(COMBINED_CLEAN.relative_to(ROOT)),
            "train_pgn": str(TRAIN_PGN.relative_to(ROOT)),
            "test_pgn": str(TEST_PGN.relative_to(ROOT)),
            "summary_json": str(SUMMARY_JSON.relative_to(ROOT)),
            "summary_md": str(SUMMARY_MD.relative_to(ROOT)),
        },
    }
    summary["train_games"] = train_count
    summary["test_games"] = test_count
    summary["test_year"] = args.test_year
    SUMMARY_JSON.write_text(json.dumps(summary, indent=2, sort_keys=True), encoding="utf-8")
    write_markdown_summary(summary, train_count, test_count, args.test_year)

    print(json.dumps(summary, indent=2, sort_keys=True))
    print(f"Wrote {SUMMARY_JSON}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
