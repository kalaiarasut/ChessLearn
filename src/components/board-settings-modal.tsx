"use client";

import Image from "next/image";
import { useState } from "react";
import { Gamepad2, LayoutGrid, Monitor } from "lucide-react";
import type { MoveMethod } from "@/lib/client-preferences";

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

import { SettingsModalLayout, BoardPiecesSettingsTab } from "@/components/settings-layout";

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
  const [activeCategory, setActiveCategory] = useState<string>("board");
  const [activeSettingsTab, setActiveSettingsTab] = useState<BoardTab>("boards");

  const tabs = [
    {
      id: "board",
      icon: <LayoutGrid className="w-[18px] h-[18px]" />,
      label: "Board & Pieces",
      title: "Board & Pieces",
      description: "Customize the look and feel of your chess set.",
      content: (
        <BoardPiecesSettingsTab
          activeSettingsTab={activeSettingsTab}
          setActiveSettingsTab={setActiveSettingsTab}
          boardTheme={boardTheme}
          pieceTheme={pieceTheme}
          boardThemes={boardThemes}
          pieceThemes={pieceThemes}
          boardAssets={boardAssets}
          pieceAssets={pieceAssets}
          soundEnabled={soundEnabled}
          onBoardThemeChange={onBoardThemeChange}
          onPieceThemeChange={onPieceThemeChange}
          onSoundEnabledChange={onSoundEnabledChange}
          onPreviewSound={onPreviewSound}
          boardPreviewNode={
            <BoardPreview
              boardTheme={boardTheme}
              pieceTheme={pieceTheme}
              boardAssets={boardAssets}
              pieceAssets={pieceAssets}
            />
          }
        />
      ),
    },
    {
      id: "gameplay",
      icon: <Gamepad2 className="w-[18px] h-[18px]" />,
      label: "Gameplay",
      title: "Gameplay",
      description: "Configure interaction and move behavior for Puzzle mode.",
      content: (
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
      ),
    },
    {
      id: "interface",
      icon: <Monitor className="w-[18px] h-[18px]" />,
      label: "Interface",
      title: "Interface",
      description: "Change platform sounds and UI interactions.",
      content: (
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
      ),
    },
  ];

  return (
    <SettingsModalLayout
      open={open}
      onClose={onClose}
      tabs={tabs}
      activeTabId={activeCategory}
      onTabChange={setActiveCategory}
      error={error}
      footer={
        <button
          onClick={onSave}
          disabled={saving}
          className="px-8 py-2.5 bg-[var(--cta-bg)] hover:bg-[var(--cta-hover)] text-[var(--cta-text)] font-bold rounded-lg transition-colors shadow-lg disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {saving ? "Saving..." : "Save"}
        </button>
      }
    />
  );
}
