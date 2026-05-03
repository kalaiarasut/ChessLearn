#!/usr/bin/env python3
"""Train and evaluate a lightweight Hikaru style-prior move ranker."""

from __future__ import annotations

import argparse
import json
import math
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
EXACT_BOOK_DB = PROCESSED_DIR / "hikaru_exact_position_book.sqlite"
MODEL_JSON = PROCESSED_DIR / "hikaru_style_prior.json"
EVAL_JSON = PROCESSED_DIR / "hikaru_style_prior_eval.json"
EVAL_MD = PROCESSED_DIR / "hikaru_style_prior_eval.md"

PIECE_NAMES = {
    chess.PAWN: "pawn",
    chess.KNIGHT: "knight",
    chess.BISHOP: "bishop",
    chess.ROOK: "rook",
    chess.QUEEN: "queen",
    chess.KING: "king",
}

WEIGHTS = {
    "exact": 9.0,
    "piece": 0.25,
    "piece_by_phase": 0.75,
    "piece_by_phase_time": 1.0,
    "to_square": 0.2,
    "to_square_by_piece": 0.45,
    "to_square_by_phase": 0.45,
    "to_square_by_phase_piece": 1.0,
    "flag": 0.2,
    "flag_by_phase": 0.6,
    "from_to_by_phase": 0.35,
    "from_to_by_phase_piece": 0.55,
    "uci_by_phase_time": 0.55,
}


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


def move_flag(board: chess.Board, move: chess.Move) -> str:
    if board.is_castling(move):
        return "castle"
    if move.promotion:
        return "promotion"
    is_capture = board.is_capture(move)
    gives_check = board.gives_check(move)
    if is_capture and gives_check:
        return "capture_check"
    if gives_check:
        return "check"
    if is_capture:
        return "capture"
    return "quiet"


def move_features(board: chess.Board, move: chess.Move, phase: str, time_class: str) -> dict[str, str]:
    piece = board.piece_at(move.from_square)
    piece_name = PIECE_NAMES.get(piece.piece_type if piece else None, "unknown")
    to_square = chess.square_name(move.to_square)
    from_square = chess.square_name(move.from_square)
    uci = move.uci()
    return {
        "piece": piece_name,
        "piece_by_phase": piece_name,
        "piece_by_phase_time": piece_name,
        "to_square": to_square,
        "to_square_by_piece": to_square,
        "to_square_by_phase": to_square,
        "to_square_by_phase_piece": to_square,
        "flag": move_flag(board, move),
        "flag_by_phase": move_flag(board, move),
        "from_to_by_phase": f"{from_square}{to_square}",
        "from_to_by_phase_piece": f"{from_square}{to_square}",
        "uci_by_phase_time": uci,
    }


def table_name(base: str, phase: str, time_class: str, piece: str) -> str:
    if base == "piece_by_phase":
        return f"{base}:{phase}"
    if base == "piece_by_phase_time":
        return f"{base}:{phase}|{time_class}"
    if base == "to_square_by_piece":
        return f"{base}:{piece}"
    if base == "to_square_by_phase":
        return f"{base}:{phase}"
    if base == "to_square_by_phase_piece":
        return f"{base}:{phase}|{piece}"
    if base == "flag_by_phase":
        return f"{base}:{phase}"
    if base == "from_to_by_phase":
        return f"{base}:{phase}"
    if base == "from_to_by_phase_piece":
        return f"{base}:{phase}|{piece}"
    if base == "uci_by_phase_time":
        return f"{base}:{phase}|{time_class}"
    return base


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
            time_class = game.headers.get("ChessifyTimeClass", "unknown")
            board = game.board()
            for ply_index, move in enumerate(game.mainline_moves()):
                if board.turn == target_color:
                    phase = phase_for_position(board, ply_index)
                    yield board.copy(stack=False), move, phase, time_class
                board.push(move)
            if game_index % 5000 == 0:
                print(f"{path.name}: scanned {game_index} games", flush=True)


def train_model(train_path: Path) -> dict[str, object]:
    tables: dict[str, Counter[str]] = defaultdict(Counter)
    targets = 0
    started = time.time()
    for board, move, phase, time_class in iter_hikaru_targets(train_path):
        features = move_features(board, move, phase, time_class)
        piece = features["piece"]
        for base, value in features.items():
            name = table_name(base, phase, time_class, piece)
            tables[name][value] += 1
        targets += 1
        if targets % 100000 == 0:
            print(f"style targets={targets:,} elapsed={time.time() - started:.1f}s", flush=True)

    serial_tables = {
        name: {
            "total": sum(counter.values()),
            "counts": dict(counter.most_common()),
        }
        for name, counter in sorted(tables.items())
    }
    return {
        "method": "hikaru_lightweight_style_prior",
        "train_pgn": str(TRAIN_PGN.relative_to(ROOT)),
        "train_targets": targets,
        "weights": WEIGHTS,
        "tables": serial_tables,
    }


def connect_exact_book(path: Path) -> sqlite3.Connection | None:
    if not path.exists():
        return None
    conn = sqlite3.connect(path)
    conn.execute("PRAGMA cache_size=-200000")
    return conn


def exact_counts(conn: sqlite3.Connection | None, board: chess.Board) -> dict[str, int]:
    if conn is None:
        return {}
    rows = conn.execute(
        "SELECT move, count FROM move_counts WHERE position = ?",
        (position_key(board),),
    ).fetchall()
    return {move: count for move, count in rows}


def feature_log_prob(table: dict[str, object], value: str, vocab_floor: int = 8, alpha: float = 0.5) -> float:
    counts = table.get("counts", {})
    total = int(table.get("total", 0))
    vocab = max(vocab_floor, len(counts))
    count = int(counts.get(value, 0))
    return math.log((count + alpha) / (total + alpha * vocab))


def score_move(
    model: dict[str, object],
    board: chess.Board,
    move: chess.Move,
    phase: str,
    time_class: str,
    exact: dict[str, int],
) -> float:
    features = move_features(board, move, phase, time_class)
    piece = features["piece"]
    tables = model["tables"]
    score = 0.0

    if exact:
        total = sum(exact.values())
        legal_count = board.legal_moves.count()
        count = exact.get(move.uci(), 0)
        score += WEIGHTS["exact"] * math.log((count + 0.25) / (total + 0.25 * legal_count))

    for base, value in features.items():
        name = table_name(base, phase, time_class, piece)
        table = tables.get(name)
        if not table:
            continue
        score += WEIGHTS[base] * feature_log_prob(table, value)
    return score


def empty_bucket() -> Counter[str]:
    return Counter({"targets": 0, "top1": 0, "top3": 0, "top5": 0, "exact_covered": 0})


def add_rates(bucket: Counter[str]) -> dict[str, float | int]:
    targets = bucket["targets"]
    return {
        "targets": targets,
        "exact_position_covered": bucket["exact_covered"],
        "exact_position_coverage": bucket["exact_covered"] / targets if targets else 0.0,
        "top1_accuracy": bucket["top1"] / targets if targets else 0.0,
        "top3_accuracy": bucket["top3"] / targets if targets else 0.0,
        "top5_accuracy": bucket["top5"] / targets if targets else 0.0,
    }


def evaluate_model(model: dict[str, object], test_path: Path, exact_db: Path) -> dict[str, object]:
    conn = connect_exact_book(exact_db)
    overall = empty_bucket()
    by_phase: dict[str, Counter[str]] = defaultdict(empty_bucket)
    by_time_class: dict[str, Counter[str]] = defaultdict(empty_bucket)
    started = time.time()

    for index, (board, actual_move, phase, time_class) in enumerate(iter_hikaru_targets(test_path), start=1):
        exact = exact_counts(conn, board)
        scored = sorted(
            ((score_move(model, board, move, phase, time_class, exact), move.uci()) for move in board.legal_moves),
            key=lambda item: (-item[0], item[1]),
        )
        ranked_moves = [uci for _, uci in scored]
        actual = actual_move.uci()
        buckets = [overall, by_phase[phase], by_time_class[time_class]]
        for bucket in buckets:
            bucket["targets"] += 1
            if exact:
                bucket["exact_covered"] += 1
            if actual == ranked_moves[0]:
                bucket["top1"] += 1
            if actual in ranked_moves[:3]:
                bucket["top3"] += 1
            if actual in ranked_moves[:5]:
                bucket["top5"] += 1
        if index % 20000 == 0:
            print(f"style eval targets={index:,} elapsed={time.time() - started:.1f}s", flush=True)

    if conn is not None:
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
        "# Hikaru Style-Prior Evaluation",
        "",
        "This ranks every legal move using Hikaru-derived style priors and an exact-position boost when the test position is known from training. It does not use Stockfish yet.",
        "",
        f"- Test targets: {overall['targets']:,}",
        f"- Exact-position coverage: {overall['exact_position_covered']:,} ({pct(overall['exact_position_coverage'])})",
        f"- Top-1 accuracy: {pct(overall['top1_accuracy'])}",
        f"- Top-3 accuracy: {pct(overall['top3_accuracy'])}",
        f"- Top-5 accuracy: {pct(overall['top5_accuracy'])}",
        "",
        "## By Phase",
    ]
    for phase, item in summary["evaluation"]["by_phase"].items():
        lines.append(
            f"- {phase}: targets {item['targets']:,}, top-1 {pct(item['top1_accuracy'])}, "
            f"top-3 {pct(item['top3_accuracy'])}, top-5 {pct(item['top5_accuracy'])}"
        )
    lines.extend(["", "## By Time Class"])
    for time_class, item in summary["evaluation"]["by_time_class"].items():
        lines.append(
            f"- {time_class}: targets {item['targets']:,}, top-1 {pct(item['top1_accuracy'])}, "
            f"top-3 {pct(item['top3_accuracy'])}, top-5 {pct(item['top5_accuracy'])}"
        )
    EVAL_MD.write_text("\n".join(lines) + "\n", encoding="utf-8")


def main(argv: Iterable[str]) -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--retrain", action="store_true")
    args = parser.parse_args(list(argv))

    if args.retrain or not MODEL_JSON.exists():
        model = train_model(TRAIN_PGN)
        MODEL_JSON.write_text(json.dumps(model, indent=2, sort_keys=True), encoding="utf-8")
    else:
        model = json.loads(MODEL_JSON.read_text(encoding="utf-8"))

    evaluation = evaluate_model(model, TEST_PGN, EXACT_BOOK_DB)
    summary = {
        "method": "style_prior_plus_exact_position_boost_no_engine",
        "model": str(MODEL_JSON.relative_to(ROOT)),
        "train_pgn": str(TRAIN_PGN.relative_to(ROOT)),
        "test_pgn": str(TEST_PGN.relative_to(ROOT)),
        "exact_book_db": str(EXACT_BOOK_DB.relative_to(ROOT)),
        "train_targets": model["train_targets"],
        "weights": model["weights"],
        "evaluation": evaluation,
    }
    EVAL_JSON.write_text(json.dumps(summary, indent=2, sort_keys=True), encoding="utf-8")
    write_markdown(summary)
    print(json.dumps(summary, indent=2, sort_keys=True))
    print(f"Wrote {EVAL_JSON}")
    return 0


if __name__ == "__main__":
    import sys

    raise SystemExit(main(sys.argv[1:]))
