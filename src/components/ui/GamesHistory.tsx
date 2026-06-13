"use client";

import React, { useEffect, useState } from "react";
import { LayoutGrid, List, User } from "lucide-react";
import { fetchUserGames } from "@/app/actions/history";
import { Chess } from "chess.js";
import themeManifest from "@/data/themeManifest.json";

const PIECE_THEME_ASSETS = themeManifest.pieceAssets as Record<string, string>;

const MiniBoard = ({ pgn, isWhite }: { pgn: string, isWhite: boolean }) => {
  const [board, setBoard] = useState<any[]>([]);
  useEffect(() => {
    const game = new Chess();
    try { if (pgn) game.loadPgn(pgn); } catch (e) {}
    setBoard(game.board());
  }, [pgn]);

  if (board.length === 0) return null;
  const rows = isWhite ? board : [...board].reverse();
  
  return (
    <div className="w-full aspect-square rounded shadow-sm overflow-hidden flex flex-col mb-4">
      {rows.map((row, rIdx) => {
        const displayRow = isWhite ? row : [...row].reverse();
        return (
          <div key={rIdx} className="flex-1 flex">
            {displayRow.map((square: any, cIdx: number) => {
              const isLight = (rIdx + cIdx) % 2 === 0;
              return (
                <div key={cIdx} className={`flex-1 flex items-center justify-center ${isLight ? 'bg-[#ebecd0]' : 'bg-[#739552]'}`}>
                  {square && (
                    <img 
                      src={PIECE_THEME_ASSETS['neo']?.replace('{piece}', `${square.color}${square.type}`) || `/pieces/neo/${square.color}${square.type}.png`} 
                      alt={`${square.color}${square.type}`}
                      className="w-full h-full object-contain drop-shadow-sm p-[2%]"
                      draggable={false}
                    />
                  )}
                </div>
              )
            })}
          </div>
        )
      })}
    </div>
  );
};

interface GamesHistoryProps {
  userId: string | null;
}

export default function GamesHistory({ userId }: GamesHistoryProps) {
  const [games, setGames] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"grid" | "list">("list");
  const [sortBy, setSortBy] = useState<"date" | "result">("date");

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }
    fetchUserGames(userId).then(data => {
      setGames(data);
      setLoading(false);
    });
  }, [userId]);

  if (!userId) {
    return <div className="text-center text-[var(--text-muted)] py-10">Sign in to view your games history.</div>;
  }

  if (loading) {
    return <div className="text-center text-[var(--text-muted)] py-10 animate-pulse">Loading games...</div>;
  }

  const sortedGames = [...games].sort((a, b) => {
    if (sortBy === "date") {
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    } else {
      // Sort by result (wins first)
      const aWin = a.winner_id === userId ? 1 : 0;
      const bWin = b.winner_id === userId ? 1 : 0;
      if (aWin !== bWin) return bWin - aWin;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    }
  });

  return (
    <div className="flex flex-col h-full space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-bold text-[var(--text-primary)]">Your Games</h2>
        <div className="flex items-center gap-2">
          <select 
            className="bg-[var(--surface-alt)] text-[var(--text-primary)] text-sm border border-[var(--border)] rounded-md px-2 py-1 outline-none focus:ring-1 focus:ring-[var(--cta-bg)]"
            value={sortBy}
            onChange={e => setSortBy(e.target.value as "date" | "result")}
          >
            <option value="date">Date</option>
            <option value="result">Result</option>
          </select>
          <div className="bg-[var(--surface-alt)] flex rounded-md overflow-hidden border border-[var(--border)]">
            <button 
              onClick={() => setView("list")} 
              className={`p-1.5 transition-colors ${view === "list" ? "bg-[var(--cta-bg)] text-white" : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"}`}
            >
              <List size={16} />
            </button>
            <button 
              onClick={() => setView("grid")} 
              className={`p-1.5 transition-colors ${view === "grid" ? "bg-[var(--cta-bg)] text-white" : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"}`}
            >
              <LayoutGrid size={16} />
            </button>
          </div>
        </div>
      </div>

      {sortedGames.length === 0 ? (
        <div className="flex flex-col items-center justify-center flex-1 text-[var(--text-muted)] p-10 bg-[var(--surface)] border border-[var(--border)] rounded-xl">
          <p>No games found.</p>
        </div>
      ) : (
        <div className={view === "grid" ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-4" : "flex flex-col gap-2"}>
          {sortedGames.map(game => {
            const isWhite = game.white_player_id === userId;
            const opponent = isWhite ? game.black_player : game.white_player;
            const isWin = game.winner_id === userId;
            const isDraw = !game.winner_id && game.status === "finished";

            return (
              <div 
                key={game.id} 
                className={`flex ${view === "grid" ? "flex-col" : "items-center justify-between"} bg-[var(--surface)] border border-[var(--border)] rounded-xl p-3 transition-colors hover:bg-[var(--surface-hover)]`}
              >
                {view === "grid" && <MiniBoard pgn={game.pgn} isWhite={isWhite} />}
                <div className={`flex items-center ${view === "grid" ? "mb-3" : "gap-3"}`}>
                  <div className="w-8 h-8 bg-[var(--surface-alt)] rounded-full flex items-center justify-center flex-shrink-0">
                    <User className="text-[var(--text-muted)]" size={16} />
                  </div>
                  <div className={`${view === "grid" ? "ml-2" : ""}`}>
                    <div className="font-bold text-sm text-[var(--text-primary)]">{opponent?.username || "Guest"}</div>
                    <div className="text-[10px] text-[var(--text-secondary)]">
                      {isWhite ? "Playing as White" : "Playing as Black"} • {game.time_control || "Custom"}
                    </div>
                  </div>
                </div>
                
                <div className={`flex ${view === "grid" ? "justify-between w-full" : "items-center gap-3 text-right"}`}>
                  <div className={`font-bold px-2 py-0.5 rounded text-[11px] ${isWin ? 'bg-green-500/20 text-green-500' : isDraw ? 'bg-amber-500/20 text-amber-500' : 'bg-red-500/20 text-red-500'}`}>
                    {isWin ? "Victory" : isDraw ? "Draw" : "Defeat"}
                  </div>
                  <div className="text-[10px] text-[var(--text-muted)]">
                    {new Date(game.created_at).toLocaleDateString()}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
