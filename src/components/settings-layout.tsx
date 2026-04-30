import { ReactNode } from "react";
import Image from "next/image";

export type SettingsTabConfig = {
  id: string;
  icon: ReactNode;
  label: string;
  title: string;
  description: string;
  content: ReactNode;
};

export function SettingsModalLayout({
  open,
  onClose,
  tabs,
  activeTabId,
  onTabChange,
  footer,
  loading = false,
  error = null,
  contentBg = "bg-[var(--bg)]",
}: {
  open: boolean;
  onClose: () => void;
  tabs: SettingsTabConfig[];
  activeTabId: string;
  onTabChange: (id: string) => void;
  footer?: ReactNode;
  loading?: boolean;
  error?: string | null;
  contentBg?: string;
}) {
  if (!open) return null;
  const activeTab = tabs.find((t) => t.id === activeTabId) || tabs[0];

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="w-[1050px] max-w-[95vw] h-[90vh] md:h-[720px] bg-[var(--surface-alt)] rounded-2xl border border-[var(--border)] shadow-2xl overflow-hidden flex flex-col md:flex-row relative cursor-default"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="w-full md:w-[260px] bg-[var(--surface)] border-b md:border-b-0 md:border-r border-[var(--border)] flex flex-row md:flex-col py-0 md:py-4 overflow-x-auto md:overflow-y-auto shrink-0 z-10 custom-scrollbar">
          <div className="hidden md:block px-5 mb-4 shrink-0">
            <span className="text-[var(--text-muted)] text-[11px] font-bold uppercase tracking-wider">Settings</span>
          </div>
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`flex items-center gap-2 md:gap-3 px-4 md:px-5 py-3 whitespace-nowrap md:w-full text-left transition-colors border-b-2 md:border-b-0 md:border-l-2 ${
                activeTabId === tab.id
                  ? "bg-[var(--surface-alt)] text-[var(--text-primary)] font-medium border-[var(--border-hover)] md:shadow-[-10px_0_20px_rgba(0,0,0,0.12)]"
                  : "text-[var(--text-muted)] hover:bg-[var(--skeleton)] hover:text-[var(--text-primary)] border-transparent"
              }`}
            >
              {tab.icon}
              <span className="text-[14px]">{tab.label}</span>
            </button>
          ))}
        </div>

        <div className={`flex-1 flex flex-col relative min-w-0 ${contentBg} text-[var(--text-primary)] overflow-y-auto`}>
          <div className="px-5 md:px-8 pt-5 md:pt-6 pb-3 shrink-0">
            <h2 className="text-[20px] md:text-[24px] font-bold mb-1 font-sans">{activeTab.title}</h2>
            <p className="text-[var(--text-secondary)] text-[14px]">{activeTab.description}</p>
            {loading && <p className="text-[var(--text-muted)] text-[12px] mt-2">Loading saved preferences...</p>}
            {error && <p className="text-[var(--error-text)] text-[12px] mt-2">{error}</p>}
          </div>

          <div className="flex-1 min-h-0 relative">
            {activeTab.content}
          </div>

          {footer && (
            <div className="mt-auto bg-[var(--surface-alt)] px-5 md:px-8 py-4 md:py-5 flex items-center justify-end border-t border-[var(--border)] w-full shrink-0">
              {footer}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function BoardThumbnail({ src, className = "" }: { src: string; className?: string }) {
  return (
    <div className={`relative overflow-hidden ${className}`}>
      <Image src={src} alt="" fill sizes="120px" className="object-cover" unoptimized />
    </div>
  );
}

export function PieceThumbnail({ src, alt }: { src: string; alt: string }) {
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

export function BoardPiecesSettingsTab({
  activeSettingsTab,
  setActiveSettingsTab,
  boardTheme,
  pieceTheme,
  boardThemes,
  pieceThemes,
  boardAssets,
  pieceAssets,
  soundEnabled,
  onBoardThemeChange,
  onPieceThemeChange,
  onSoundEnabledChange,
  onPreviewSound,
  boardPreviewNode,
}: {
  activeSettingsTab: "boards" | "pieces";
  setActiveSettingsTab: (tab: "boards" | "pieces") => void;
  boardTheme: string;
  pieceTheme: string;
  boardThemes: string[];
  pieceThemes: string[];
  boardAssets: Record<string, string>;
  pieceAssets: Record<string, string>;
  soundEnabled?: boolean;
  onBoardThemeChange: (theme: string) => void;
  onPieceThemeChange: (theme: string) => void;
  onSoundEnabledChange?: (enabled: boolean) => void;
  onPreviewSound?: () => void;
  boardPreviewNode: ReactNode;
}) {
  return (
    <div className="flex flex-col md:flex-row px-4 md:px-8 pb-4 md:pb-8 pt-0 gap-3 md:gap-8 h-auto md:h-[650px] max-h-none md:max-h-[75vh] w-full">
      <div className="w-full md:w-[55%] flex flex-col h-auto md:h-full min-h-0 order-last md:order-first">
        <div className="flex border-b border-[var(--border)] mb-4 shrink-0">
          <button
            onClick={() => setActiveSettingsTab("boards")}
            className={`px-4 py-2 font-semibold text-[14px] transition-colors relative ${
              activeSettingsTab === "boards" ? "text-[var(--text-primary)]" : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
            }`}
          >
            Boards
            {activeSettingsTab === "boards" && <div className="absolute bottom-[-1px] left-0 w-full h-[2px] bg-[var(--border-hover)]" />}
          </button>
          <button
            onClick={() => setActiveSettingsTab("pieces")}
            className={`px-4 py-2 font-semibold text-[14px] transition-colors relative ${
              activeSettingsTab === "pieces" ? "text-[var(--text-primary)]" : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
            }`}
          >
            Pieces
            {activeSettingsTab === "pieces" && <div className="absolute bottom-[-1px] left-0 w-full h-[2px] bg-[var(--border-hover)]" />}
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto md:pr-2 custom-scrollbar pb-4 md:pb-0">
          {activeSettingsTab === "boards" && (
            <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-4 gap-2 md:gap-4 px-1 md:px-2 py-2 md:py-3 md:pb-6">
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
                    <div className={`relative aspect-square rounded-lg border-2 overflow-hidden transition-all ${isSelected ? "border-[var(--border-hover)] scale-[1.05] shadow-[0_0_15px_rgba(0,0,0,0.25)]" : "border-transparent group-hover:border-[var(--border-hover)]"}`}>
                      <BoardThumbnail src={bgImage} className="w-full h-full" />
                      {isSelected && (
                        <div className="absolute top-1 right-1 w-4 h-4 bg-[var(--text-primary)] rounded-full flex items-center justify-center z-20">
                          <svg className="w-2.5 h-2.5 text-[var(--surface)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                        </div>
                      )}
                    </div>
                    <span className={`w-full text-center text-[10px] uppercase tracking-wider font-bold truncate px-1 transition-colors ${isSelected ? "text-[var(--text-primary)]" : "text-[var(--text-muted)] group-hover:text-[var(--text-primary)]"}`}>
                      {theme.replace(/_/g, " ")}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {activeSettingsTab === "pieces" && (
            <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-4 gap-2 md:gap-4 px-1 md:px-2 py-2 md:py-3 md:pb-6">
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
                    <div className={`relative aspect-square rounded-lg border-2 bg-[var(--skeleton)] flex items-center justify-center transition-all p-2 ${isSelected ? "border-[var(--border-hover)] scale-[1.05] shadow-[0_0_15px_rgba(0,0,0,0.25)]" : "border-transparent group-hover:border-[var(--border-hover)] group-hover:bg-[var(--skeleton-soft)]"}`}>
                      <PieceThumbnail src={knightSrc} alt={theme} />
                      {isSelected && (
                        <div className="absolute top-1 right-1 w-4 h-4 bg-[var(--text-primary)] rounded-full flex items-center justify-center z-10">
                          <svg className="w-2.5 h-2.5 text-[var(--surface)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                        </div>
                      )}
                    </div>
                    <span className={`w-full text-center text-[10px] uppercase tracking-wider font-bold truncate px-1 transition-colors ${isSelected ? "text-[var(--text-primary)]" : "text-[var(--text-muted)] group-hover:text-[var(--text-primary)]"}`}>
                      {theme.replace(/_/g, " ")}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className="w-[70%] sm:w-[50%] md:w-[45%] flex flex-col items-center justify-start rounded-xl p-0 relative shrink-0 order-first md:order-last mt-2 md:mt-0 mx-auto md:mx-0">
        {boardPreviewNode}

        {onSoundEnabledChange && soundEnabled !== undefined && (
          <div className="mt-4 md:mt-8 w-full flex items-center justify-center md:justify-start gap-4">
            <label className="relative inline-flex items-center cursor-pointer group">
              <input
                type="checkbox"
                checked={soundEnabled}
                onChange={(event) => {
                  onSoundEnabledChange(event.target.checked);
                  if (event.target.checked) onPreviewSound?.();
                }}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-[var(--skeleton)] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-[var(--border)] after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-[var(--text-muted)] after:border border-[var(--border)] after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[var(--border-hover)] peer-checked:after:bg-[var(--surface)] group-hover:after:scale-[1.05]" />
              <span className="ml-3 text-[14px] text-[var(--text-secondary)] font-medium group-hover:text-[var(--text-primary)] transition-colors">
                Enable Sounds
              </span>
            </label>
          </div>
        )}
      </div>
    </div>
  );
}
