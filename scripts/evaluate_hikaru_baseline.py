#!/usr/bin/env python3
"""Evaluate exact-position Hikaru move prediction from the processed corpus."""

from __future__ import annotations

import argparse
import json
import sqlite3
import time
from collections import Counter, defaultdict
from pathlib import Path
from typing import Iterable

import chess
import chess.pgn


ROOT = Path(__file__).resolve().parents[1]
BASE_DIR = ROOT / "data" / "player-games" / "hikaru"
PROCESSED_DIR = BASE_DIR / "processed"
TRAIN_PGN = PROCESSED_DIR / "hikaru_train.pgn"
TEST_PGN = PROCESSED_DIR / "hikaru_test.pgn"
BOOK_DB = PROCESSED_DIR / "hikaru_exact_position_book.sqlite"
SUMMARY_JSON = PROCESSED_DIR / "hikaru_baseline_eval.json"
SUMMARY_MD = PROCESSED_DIR / "hikaru_baseline_eval.md"


def position_key(board: chess.Board) -> str:
    return " ".join(board.fen(en_passant="legal").split()[:4])


def hikaru_color(game: chess.pgn.Game) -> chess.Color | None:
    color = game.headers.get("ChessifyHikaruColor", "").lower()
    if color == "white":
        return chess.WHITE
    if color == "black":
        return chess.BLACK
    white = game.headers.get("White", "").lower()
    black = game.headers.get("Black", "").lower()
    if "hikaru" in white or "nakamura" in white:
        return chess.WHITE
    if "hikaru" in black or "nakamura" in black:
        return chess.BLACK
    return None


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


def iter_hikaru_targets(path: Path):
    with path.open("r", encoding="utf-8", errors="replace") as handle:
        game_index = 0
        while True:
            game = chess.pgn.read_game(handle)
            if game is None:
                break
            game_index += 1
            target_color = hikaru_color(game)
            if target_color is None:
                continue
            board = game.board()
            for ply_index, move in enumerate(game.mainline_moves()):
                if board.turn == target_color:
                    yield {
                        "position": position_key(board),
                        "move": move.uci(),
                        "phase": phase_for_position(board, ply_index),
                        "time_class": game.headers.get("ChessifyTimeClass", "unknown"),
                        "source": game.headers.get("ChessifySource", "unknown"),
                    }
                board.push(move)
            if game_index % 5000 == 0:
                print(f"{path.name}: scanned {game_index} games", flush=True)


def connect_db(path: Path) -> sqlite3.Connection:
    conn = sqlite3.connect(path)
    conn.execute("PRAGMA journal_mode=OFF")
    conn.execute("PRAGMA synchronous=OFF")
    conn.execute("PRAGMA temp_store=MEMORY")
    conn.execute("PRAGMA cache_size=-200000")
    return conn


def rebuild_book(db_path: Path, train_path: Path, batch_size: int = 20000) -> dict[str, int]:
    if db_path.exists():
        db_path.unlink()
    conn = connect_db(db_path)
    conn.execute(
        """
        CREATE TABLE move_counts (
          position TEXT NOT NULL,
          move TEXT NOT NULL,
          count INTEGER NOT NULL,
          PRIMARY KEY (position, move)
        )
        """
    )
    sql = """
        INSERT INTO move_counts(position, move, count)
        VALUES (?, ?, ?)
        ON CONFLICT(position, move)
        DO UPDATE SET count = count + excluded.count
    """
    batch_counter: Counter[tuple[str, str]] = Counter()
    total_targets = 0
    started = time.time()
    for item in iter_hikaru_targets(train_path):
        batch_counter[(item["position"], item["move"])] += 1
        total_targets += 1
        if len(batch_counter) >= batch_size:
            conn.executemany(sql, [(pos, move, count) for (pos, move), count in batch_counter.items()])
            conn.commit()
            batch_counter.clear()
            print(f"book targets={total_targets:,} elapsed={time.time() - started:.1f}s", flush=True)
    if batch_counter:
        conn.executemany(sql, [(pos, move, count) for (pos, move), count in batch_counter.items()])
        conn.commit()
    unique_positions = conn.execute("SELECT COUNT(DISTINCT position) FROM move_counts").fetchone()[0]
    unique_position_moves = conn.execute("SELECT COUNT(*) FROM move_counts").fetchone()[0]
    conn.close()
    return {
        "train_targets": total_targets,
        "unique_positions": unique_positions,
        "unique_position_moves": unique_position_moves,
    }


def empty_bucket() -> Counter[str]:
    return Counter(
        {
            "targets": 0,
            "covered": 0,
            "top1": 0,
            "top1_tie": 0,
            "top3": 0,
            "top5": 0,
        }
    )


def add_rates(bucket: Counter[str]) -> dict[str, float | int]:
    targets = bucket["targets"]
    covered = bucket["covered"]
    return {
        "targets": targets,
        "covered": covered,
        "coverage": covered / targets if targets else 0.0,
        "top1_accuracy_all": bucket["top1"] / targets if targets else 0.0,
        "top1_tie_accuracy_all": bucket["top1_tie"] / targets if targets else 0.0,
        "top3_accuracy_all": bucket["top3"] / targets if targets else 0.0,
        "top5_accuracy_all": bucket["top5"] / targets if targets else 0.0,
        "top1_accuracy_covered": bucket["top1"] / covered if covered else 0.0,
        "top3_accuracy_covered": bucket["top3"] / covered if covered else 0.0,
        "top5_accuracy_covered": bucket["top5"] / covered if covered else 0.0,
    }


def evaluate(db_path: Path, test_path: Path) -> dict[str, object]:
    conn = connect_db(db_path)
    query = "SELECT move, count FROM move_counts WHERE position = ? ORDER BY count DESC, move ASC"
    overall = empty_bucket()
    by_phase: dict[str, Counter[str]] = defaultdict(empty_bucket)
    by_time_class: dict[str, Counter[str]] = defaultdict(empty_bucket)
    started = time.time()

    for index, item in enumerate(iter_hikaru_targets(test_path), start=1):
        buckets = [overall, by_phase[item["phase"]], by_time_class[item["time_class"]]]
        for bucket in buckets:
            bucket["targets"] += 1
        rows = conn.execute(query, (item["position"],)).fetchall()
        if rows:
            top_moves = [move for move, _ in rows]
            max_count = rows[0][1]
            tied_top_moves = {move for move, count in rows if count == max_count}
            actual = item["move"]
            for bucket in buckets:
                bucket["covered"] += 1
                if actual == top_moves[0]:
                    bucket["top1"] += 1
                if actual in tied_top_moves:
                    bucket["top1_tie"] += 1
                if actual in top_moves[:3]:
                    bucket["top3"] += 1
                if actual in top_moves[:5]:
                    bucket["top5"] += 1
        if index % 20000 == 0:
            print(f"eval targets={index:,} elapsed={time.time() - started:.1f}s", flush=True)
    conn.close()
    return {
        "overall": add_rates(overall),
        "by_phase": {key: add_rates(value) for key, value in sorted(by_phase.items())},
        "by_time_class": {key: add_rates(value) for key, value in sorted(by_time_class.items())},
    }


def pct(value: float) -> str:
    return f"{value * 100:.2f}%"


def write_markdown(summary: dict[str, object]) -> None:
    overall = summary["evaluation"]["overall"]
    lines = [
        "# Hikaru Exact-Position Baseline Evaluation",
        "",
        "This is a memorized-position baseline: if a held-out 2026 position occurred in training, predict Hikaru's most frequent historical move from that exact position.",
        "",
        f"- Test Hikaru move targets: {overall['targets']:,}",
        f"- Exact-position coverage: {overall['covered']:,} ({pct(overall['coverage'])})",
        f"- Top-1 accuracy on all targets: {pct(overall['top1_accuracy_all'])}",
        f"- Top-3 accuracy on all targets: {pct(overall['top3_accuracy_all'])}",
        f"- Top-5 accuracy on all targets: {pct(overall['top5_accuracy_all'])}",
        f"- Top-1 accuracy when covered: {pct(overall['top1_accuracy_covered'])}",
        f"- Top-3 accuracy when covered: {pct(overall['top3_accuracy_covered'])}",
        f"- Top-5 accuracy when covered: {pct(overall['top5_accuracy_covered'])}",
        "",
        "## By Phase",
    ]
    for phase, item in summary["evaluation"]["by_phase"].items():
        lines.append(
            f"- {phase}: targets {item['targets']:,}, coverage {pct(item['coverage'])}, "
            f"top-1 all {pct(item['top1_accuracy_all'])}, top-3 all {pct(item['top3_accuracy_all'])}"
        )
    lines.extend(["", "## By Time Class"])
    for time_class, item in summary["evaluation"]["by_time_class"].items():
        lines.append(
            f"- {time_class}: targets {item['targets']:,}, coverage {pct(item['coverage'])}, "
            f"top-1 all {pct(item['top1_accuracy_all'])}, top-3 all {pct(item['top3_accuracy_all'])}"
        )
    SUMMARY_MD.write_text("\n".join(lines) + "\n", encoding="utf-8")


def main(argv: Iterable[str]) -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--rebuild-book", action="store_true")
    args = parser.parse_args(list(argv))

    PROCESSED_DIR.mkdir(parents=True, exist_ok=True)
    if args.rebuild_book or not BOOK_DB.exists():
        book_summary = rebuild_book(BOOK_DB, TRAIN_PGN)
    else:
        conn = connect_db(BOOK_DB)
        book_summary = {
            "train_targets": None,
            "unique_positions": conn.execute("SELECT COUNT(DISTINCT position) FROM move_counts").fetchone()[0],
            "unique_position_moves": conn.execute("SELECT COUNT(*) FROM move_counts").fetchone()[0],
        }
        conn.close()
    evaluation = evaluate(BOOK_DB, TEST_PGN)
    summary = {
        "method": "exact_position_frequency_baseline",
        "train_pgn": str(TRAIN_PGN.relative_to(ROOT)),
        "test_pgn": str(TEST_PGN.relative_to(ROOT)),
        "book_db": str(BOOK_DB.relative_to(ROOT)),
        "book": book_summary,
        "evaluation": evaluation,
    }
    SUMMARY_JSON.write_text(json.dumps(summary, indent=2, sort_keys=True), encoding="utf-8")
    write_markdown(summary)
    print(json.dumps(summary, indent=2, sort_keys=True))
    print(f"Wrote {SUMMARY_JSON}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(__import__("sys").argv[1:]))
