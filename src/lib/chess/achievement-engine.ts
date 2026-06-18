import { Chess, Move } from "chess.js";

export type GamificationIncrements = Record<string, number>;

export function evaluateMoveAchievements(move: Move, isWhite: boolean): GamificationIncrements {
  const increments: GamificationIncrements = {};
  
  if ((isWhite && move.color !== 'w') || (!isWhite && move.color !== 'b')) {
    return increments;
  }

  if (move.captured) {
    increments["Serial Killer"] = 1;
    
    const fromFile = move.from.charCodeAt(0);
    const fromRank = parseInt(move.from[1]);
    const toFile = move.to.charCodeAt(0);
    const toRank = parseInt(move.to[1]);
    
    const dist = Math.max(Math.abs(fromFile - toFile), Math.abs(fromRank - toRank));
    if (dist >= 7) {
      increments["Sniper"] = 1;
    }
  }

  if (move.promotion) {
    increments["Pawn Whisperer"] = 1;
  }

  if (move.flags.includes('e')) {
    increments["En Passant Enthusiast"] = 1;
  }

  if (move.flags.includes('k')) {
    increments["Castling Kingside"] = 1;
  }
  
  if (move.flags.includes('q')) {
    increments["Castling Queenside"] = 1;
  }

  return increments;
}

export function evaluateGameEndAchievements(game: Chess, isWhite: boolean): GamificationIncrements {
  const increments: GamificationIncrements = {};
  const isWinner = (isWhite && game.turn() === 'b') || (!isWhite && game.turn() === 'w');
  
  if (game.isCheckmate() && isWinner) {
    const history = game.history({ verbose: true });
    const lastMove = history[history.length - 1];
    
    if (history.length < 40) {
      increments["Fast & Furious"] = 1;
    }

    if (lastMove.piece === 'n') {
      increments["Knightmare"] = 1;
    }
    
    if (lastMove.piece === 'b') {
      const fromFile = lastMove.from.charCodeAt(0);
      const fromRank = parseInt(lastMove.from[1]);
      const toFile = lastMove.to.charCodeAt(0);
      const toRank = parseInt(lastMove.to[1]);
      
      const dist = Math.max(Math.abs(fromFile - toFile), Math.abs(fromRank - toRank));
      if (dist >= 5) {
        increments["Bishop's Snipe"] = 1;
      }
    }
    
    if (lastMove.piece === 'r') {
      const rooks = game.board().flat().filter(p => p && p.type === 'r' && p.color === lastMove.color);
      if (rooks.length >= 2) {
        increments["Rook 'n' Roll"] = 1;
      }
    }

    if ((lastMove.piece === 'r' || lastMove.piece === 'q') && (lastMove.to[1] === '1' || lastMove.to[1] === '8')) {
      increments["Back Rank Brawler"] = 1;
    }
  }

  if (game.isStalemate()) {
    const myPieces = game.board().flat().filter(p => p && p.color === (isWhite ? 'w' : 'b'));
    if (myPieces.length === 1 && myPieces[0]!.type === 'k') {
      increments["Pacifist"] = 1;
    }
  }

  if (game.history().length > 200) {
    increments["Marathon Runner"] = 1;
  }

  return increments;
}
