"use client";

import Image from "next/image";
import { useState } from "react";
import { Gamepad2, LayoutGrid, Monitor } from "lucide-react";
import type { MoveMethod } from "@/lib/client-preferences";

type SettingsCategory = "board" | "gameplay" | "interface";
type BoardTab = "boards" | "pieces";

type BoardSettingsModalProps = {
  open: boolean;
  boardTheme: string;
  pieceTheme: string;
  boardThemes: string[];
  pieceThemes: string[];
  boardAssets: Record<string, string>;
  pieceAssets: Record<string, string>;
  moveMethod: MoveMethod;
  showLegalMoves: boolean;
  soundEnabled: boolean;
  masterVolume: number;
  saving?: boolean;
  error?: string | null;
  onBoardThemeChange: (theme: string) => void;
  onPieceThemeChange: (theme: string) => void;
  onMoveMethodChange: (method: MoveMethod) => void;
  onShowLegalMovesChange: (enabled: boolean) => void;
  onSoundEnabledChange: (enabled: boolean) => void;
  onMasterVolumeChange: (volume: number) => void;
  onPreviewSound?: () => void;
  onClose: () => void;
  onSave: () => void;
};

function BoardThumbnail({ src, className = "" }: { src: string; className?: string }) {
  return (
    <div className={`relative overflow-hidden ${className}`}>
      <Image src={src} alt="" fill sizes="120px" className="object-cover" unoptimized />
    </div>
  );
}

function PieceThumbnail({ src, alt }: { src: string; alt: string }) {
  return (
    <Image
      src={src}
      alt={alt}
      width={96}
      height={96}
      className="w-full h-full object-contain drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]"
      unoptimized
    />
  );
}

function BoardPreview({
  boardTheme,
  pieceTheme,
  boardAssets,
  pieceAssets,
}: {
  boardTheme: string;
  pieceTheme: string;
  boardAssets: Record<string, string>;
  pieceAssets: Record<string, string>;
}) {
  const previewPieces = ["bb", "bq", "bp", null, null, null, "wn", "wk", "wr"];
  const piecePath = pieceAssets[pieceTheme] ?? `/pieces/${pieceTheme}/150`;

  return (
    <div className="w-full aspect-square relative shadow-xl rounded-sm overflow-hidden border border-[var(--border)]">
      <Image
        src={boardAssets[boardTheme] ?? `/boards/${boardTheme}.png`}
        alt="Board preview"
        fill
        sizes="420px"
        className="object-cover"
        unoptimized
      />
      <div className="absolute inset-0 grid grid-cols-3 grid-rows-3">
        {previewPieces.map((piece, index) => {
          const row = Math.floor(index / 3);
          const col = index % 3;
          const isLightSquare = (row + col) % 2 === 0;

          return (
            <div key={`${row}-${col}`} className="flex items-center justify-center relative p-1 md:p-2">
              {col === 0 && (
                <span
                  className={`absolute top-1 left-1.5 text-[14px] font-bold ${
                    isLightSquare ? "text-[#b07b46]" : "text-[#e6ca9a]"
                  } select-none`}
                >
                  {8 - row}
                </span>
              )}
              {piece && (
                <Image
                  src={`${piecePath}/${piece}.png`}
                  alt={piece}
                  width={150}
                  height={150}
                  className="w-full h-full object-contain drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]"
                  unoptimized
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function BoardSettingsModal({
  open,
  boardTheme,
  pieceTheme,
  boardThemes,
  pieceThemes,
  boardAssets,
  pieceAssets,
  moveMethod,
  showLegalMoves,
  soundEnabled,
  masterVolume,
  saving = false,
  error,
  onBoardThemeChange,
  onPieceThemeChange,
  onMoveMethodChange,
  onShowLegalMovesChange,
  onSoundEnabledChange,
  onMasterVolumeChange,
  onPreviewSound,
  onClose,
  onSave,
}: BoardSettingsModalProps) {
  const [activeCategory, setActiveCategory] = useState<SettingsCategory>("board");
  const [activeSettingsTab, setActiveSettingsTab] = useState<BoardTab>("boards");

  if (!open) {
    return null;
  }

  const heading =
    activeCategory === "board" ? "Board & Pieces" : activeCategory === "gameplay" ? "Gameplay" : "Interface";
  const description =
    activeCategory === "board"
      ? "Customize the look and feel of your chess set."
      : activeCategory === "gameplay"
        ? "Configure interaction and move behavior for Puzzle mode."
        : "Change platform sounds and UI interactions.";

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="w-[1050px] max-w-[95vw] h-[720px] max-h-[90vh] bg-[var(--surface-alt)] rounded-2xl border border-[var(--border)] shadow-2xl overflow-hidden flex flex-row relative cursor-default"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="w-[240px] md:w-[260px] bg-[var(--surface)] border-r border-[var(--border)] flex flex-col py-4 overflow-y-auto shrink-0 z-10 custom-scrollbar">
          <div className="px-5 mb-4">
            <span className="text-[var(--text-muted)] text-[11px] font-bold uppercase tracking-wider">Settings</span>
          </div>
          <button
            onClick={() => setActiveCategory("board")}
            className={`flex items-center gap-3 px-5 py-3 w-full text-left transition-colors border-l-2 ${
              activeCategory === "board"
                ? "bg-[var(--surface-alt)] text-[var(--text-primary)] font-medium border-[var(--border-hover)] shadow-[-10px_0_20px_rgba(0,0,0,0.12)]"
                : "text-[var(--text-muted)] hover:bg-[var(--skeleton)] hover:text-[var(--text-primary)] border-transparent"
            }`}
          >
            <LayoutGrid className="w-[18px] h-[18px]" />
            <span className="text-[14px]">Board & Pieces</span>
          </button>
          <button
            onClick={() => setActiveCategory("gameplay")}
            className={`flex items-center gap-3 px-5 py-3 w-full text-left transition-colors border-l-2 ${
              activeCategory === "gameplay"
                ? "bg-[var(--surface-alt)] text-[var(--text-primary)] font-medium border-[var(--border-hover)] shadow-[-10px_0_20px_rgba(0,0,0,0.12)]"
                : "text-[var(--text-muted)] hover:bg-[var(--skeleton)] hover:text-[var(--text-primary)] border-transparent"
            }`}
          >
            <Gamepad2 className="w-[18px] h-[18px]" />
            <span className="text-[14px]">Gameplay</span>
          </button>
          <button
            onClick={() => setActiveCategory("interface")}
            className={`flex items-center gap-3 px-5 py-3 w-full text-left transition-colors border-l-2 ${
              activeCategory === "interface"
                ? "bg-[var(--surface-alt)] text-[var(--text-primary)] font-medium border-[var(--border-hover)] shadow-[-10px_0_20px_rgba(0,0,0,0.12)]"
                : "text-[var(--text-muted)] hover:bg-[var(--skeleton)] hover:text-[var(--text-primary)] border-transparent"
            }`}
          >
            <Monitor className="w-[18px] h-[18px]" />
            <span className="text-[14px]">Interface</span>
          </button>
        </div>

        <div className="flex-1 flex flex-col relative min-w-0 bg-[var(--bg)]">
          <div className="px-8 pt-6 pb-3 shrink-0">
            <h2 className="text-[24px] font-bold text-[var(--text-primary)] mb-1 font-sans">{heading}</h2>
            <p className="text-[var(--text-secondary)] text-[14px]">{description}</p>
            {error && <p className="text-[var(--error-text)] text-[12px] mt-2">{error}</p>}
          </div>

          {activeCategory === "board" && (
            <div className="flex flex-col md:flex-row px-8 pb-8 pt-0 gap-8 h-[650px] max-h-[75vh] w-full">
              <div className="w-full md:w-[55%] flex flex-col h-full min-h-0">
                <div className="flex border-b border-[var(--border)] mb-4 shrink-0">
                  <button
                    onClick={() => setActiveSettingsTab("boards")}
                    className={`px-4 py-2 font-semibold text-[14px] transition-colors relative ${
                      activeSettingsTab === "boards"
                        ? "text-[var(--text-primary)]"
                        : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                    }`}
                  >
                    Boards
                    {activeSettingsTab === "boards" && (
                      <div className="absolute bottom-[-1px] left-0 w-full h-[2px] bg-[var(--border-hover)]" />
                    )}
                  </button>
                  <button
                    onClick={() => setActiveSettingsTab("pieces")}
                    className={`px-4 py-2 font-semibold text-[14px] transition-colors relative ${
                      activeSettingsTab === "pieces"
                        ? "text-[var(--text-primary)]"
                        : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                    }`}
                  >
                    Pieces
                    {activeSettingsTab === "pieces" && (
                      <div className="absolute bottom-[-1px] left-0 w-full h-[2px] bg-[var(--border-hover)]" />
                    )}
                  </button>
                </div>

                <div className="flex-1 min-h-0 overflow-y-auto pr-2 custom-scrollbar">
                  {activeSettingsTab === "boards" && (
                    <div className="grid grid-cols-4 gap-4 px-2 py-3 pb-6">
                      {boardThemes.map((theme) => {
                        const isSelected = boardTheme === theme;
                        const bgImage = boardAssets[theme] ?? `/boards/${theme}.png`;

                        return (
                          <button
                            key={theme}
                            onClick={() => {
                              onBoardThemeChange(theme);
                              onPreviewSound?.();
                            }}
                            className={`group relative flex flex-col gap-1.5 transition-all ${isSelected ? "z-10" : "z-0"}`}
                          >
                            <div
                              className={`relative aspect-square rounded-lg border-2 overflow-hidden transition-all ${
                                isSelected
                                  ? "border-[var(--border-hover)] scale-[1.05] shadow-[0_0_15px_rgba(0,0,0,0.25)]"
                                  : "border-transparent group-hover:border-[var(--border-hover)]"
                              }`}
                            >
                              <BoardThumbnail src={bgImage} className="w-full h-full" />
                              {isSelected && (
                                <div className="absolute top-1 right-1 w-4 h-4 bg-[var(--text-primary)] rounded-full flex items-center justify-center z-20">
                                  <svg
                                    className="w-2.5 h-2.5 text-[var(--surface)]"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                    strokeWidth={3}
                                  >
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                  </svg>
                                </div>
                              )}
                            </div>
                            <span
                              className={`text-[10px] uppercase tracking-wider font-bold truncate px-1 transition-colors ${
                                isSelected
                                  ? "text-[var(--text-primary)]"
                                  : "text-[var(--text-muted)] group-hover:text-[var(--text-primary)]"
                              }`}
                            >
                              {theme.replace(/_/g, " ")}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {activeSettingsTab === "pieces" && (
                    <div className="grid grid-cols-4 gap-4 px-2 py-3 pb-6">
                      {pieceThemes.map((theme) => {
                        const isSelected = pieceTheme === theme;
                        const knightSrc = `${pieceAssets[theme] ?? `/pieces/${theme}/150`}/wn.png`;

                        return (
                          <button
                            key={theme}
                            onClick={() => {
                              onPieceThemeChange(theme);
                              onPreviewSound?.();
                            }}
                            className={`group relative flex flex-col gap-1.5 transition-all ${isSelected ? "z-10" : "z-0"}`}
                          >
                            <div
                              className={`relative aspect-square rounded-lg border-2 bg-[var(--skeleton)] flex items-center justify-center transition-all p-2 ${
                                isSelected
                                  ? "border-[var(--border-hover)] scale-[1.05] shadow-[0_0_15px_rgba(0,0,0,0.25)]"
                                  : "border-transparent group-hover:border-[var(--border-hover)] group-hover:bg-[var(--skeleton-soft)]"
                              }`}
                            >
                              <PieceThumbnail src={knightSrc} alt={theme} />
                              {isSelected && (
                                <div className="absolute top-1 right-1 w-4 h-4 bg-[var(--text-primary)] rounded-full flex items-center justify-center z-10">
                                  <svg
                                    className="w-2.5 h-2.5 text-[var(--surface)]"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                    strokeWidth={3}
                                  >
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                  </svg>
                                </div>
                              )}
                            </div>
                            <span
                              className={`text-[10px] uppercase tracking-wider font-bold truncate px-1 transition-colors ${
                                isSelected
                                  ? "text-[var(--text-primary)]"
                                  : "text-[var(--text-muted)] group-hover:text-[var(--text-primary)]"
                              }`}
                            >
                              {theme.replace(/_/g, " ")}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              <div className="w-full md:w-[45%] flex flex-col items-center justify-start rounded-xl p-0 relative shrink-0">
                <BoardPreview
                  boardTheme={boardTheme}
                  pieceTheme={pieceTheme}
                  boardAssets={boardAssets}
                  pieceAssets={pieceAssets}
                />

                <div className="mt-8 w-full flex items-center justify-start gap-4">
                  <label className="relative inline-flex items-center cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={soundEnabled}
                      onChange={(event) => {
                        onSoundEnabledChange(event.target.checked);
                        if (event.target.checked) {
                          onPreviewSound?.();
                        }
                      }}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-[var(--skeleton)] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-[var(--border)] after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-[var(--text-muted)] after:border border-[var(--border)] after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[var(--border-hover)] peer-checked:after:bg-[var(--surface)] group-hover:after:scale-[1.05]" />
                    <span className="ml-3 text-[14px] text-[var(--text-secondary)] font-medium group-hover:text-[var(--text-primary)] transition-colors">
                      Enable Sounds
                    </span>
                  </label>
                </div>
              </div>
            </div>
          )}

          {activeCategory === "gameplay" && (
            <div className="flex-1 px-8 pb-8 overflow-y-auto custom-scrollbar pt-2">
              <div className="space-y-[1px] bg-[var(--border)] border border-[var(--border)] rounded-sm overflow-hidden">
                <div className="flex items-center justify-between px-3 py-2.5 bg-[var(--bg)]">
                  <span className="text-[14px] text-[var(--text-primary)]">Move Method</span>
                  <select
                    value={moveMethod}
                    onChange={(event) => onMoveMethodChange(event.target.value as MoveMethod)}
                    className="bg-[var(--surface-alt)] border border-[var(--border-subtle)] text-[var(--text-primary)] text-[13px] rounded px-3 py-1.5"
                  >
                    <option value="drag">Drag only</option>
                    <option value="click">Click only</option>
                    <option value="both">Both</option>
                  </select>
                </div>
                <div className="flex items-center justify-between px-3 py-2.5 bg-[var(--bg)]">
                  <span className="text-[14px] text-[var(--text-primary)]">Show Legal Moves</span>
                  <input
                    type="checkbox"
                    checked={showLegalMoves}
                    onChange={(event) => onShowLegalMovesChange(event.target.checked)}
                  />
                </div>
              </div>
            </div>
          )}

          {activeCategory === "interface" && (
            <div className="flex-1 px-8 pb-8 overflow-y-auto custom-scrollbar pt-2">
              <div className="space-y-[1px] bg-[var(--border)] border border-[var(--border)] rounded-sm overflow-hidden">
                <div className="flex items-center justify-between px-3 py-2.5 bg-[var(--bg)]">
                  <span className="text-[14px] text-[var(--text-primary)]">Sound Volume</span>
                  <div className="flex items-center gap-3">
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={masterVolume}
                      onChange={(event) => onMasterVolumeChange(Number(event.target.value))}
                    />
                    <span className="text-[12px] text-[var(--text-secondary)] w-9">{masterVolume}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="mt-auto bg-[var(--surface-alt)] px-8 py-5 flex items-center justify-end border-t border-[var(--border)] w-full shrink-0">
            <button
              onClick={onSave}
              disabled={saving}
              className="px-8 py-2.5 bg-[var(--cta-bg)] hover:bg-[var(--cta-hover)] text-[var(--cta-text)] font-bold rounded-lg transition-colors shadow-lg disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {saving ? "Saving..." : "Save"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
