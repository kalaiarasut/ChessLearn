"use client";

import React, { useState } from "react";
import Navbar from "@/components/ui/Navbar";
import { Tooltip } from "@/components/ui/Tooltip";
import { 
  Clock, 
  Timer, 
  Zap, 
  Rocket, 
  Flame,
  Shuffle,
  RefreshCw,
  Users,
  LayoutGrid,
  Bomb,
  ChevronDown,
  Play,
  Settings,
  Handshake,
  Trophy,
  Check
} from "lucide-react";

interface GameMode {
  id: string;
  name: string;
  description: string;
  icon: React.ElementType;
  category: "Traditional" | "Variant";
}

const allModes: GameMode[] = [
  {
    id: "rapid",
    name: "10 min (Rapid)",
    description: "Games where each player has between 10 and 60 minutes. It offers a balance between deep calculation and game speed.",
    icon: Timer,
    category: "Traditional",
  },
  {
    id: "blitz",
    name: "3 min (Blitz)",
    description: "Fast-paced games where each player has 10 minutes or less for the entire game.",
    icon: Zap,
    category: "Traditional",
  },
  {
    id: "bullet",
    name: "1 min (Bullet)",
    description: "The fastest format, usually featuring one to two minutes per player. Relies on speed and intuition.",
    icon: Rocket,
    category: "Traditional",
  },
  {
    id: "classical",
    name: "Classical",
    description: "The slowest format, giving each player 90 minutes or more for the first 40 moves.",
    icon: Clock,
    category: "Traditional",
  },
  {
    id: "armageddon",
    name: "Armageddon",
    description: "A tie-break game where White gets slightly more time than Black but must win to advance.",
    icon: Flame,
    category: "Traditional",
  },
  {
    id: "chess960",
    name: "Chess960",
    description: "Pieces are randomized on the back rank, requiring players to think on their feet.",
    icon: Shuffle,
    category: "Variant",
  },
  {
    id: "crazyhouse",
    name: "Crazyhouse",
    description: "Captured pieces can be dropped back onto the board as your own.",
    icon: RefreshCw,
    category: "Variant",
  },
  {
    id: "bughouse",
    name: "Bughouse",
    description: "A chaotic team variant (2 vs. 2) where captured pieces are passed to your partner.",
    icon: Users,
    category: "Variant",
  },
  {
    id: "four-player",
    name: "4-Player Chess",
    description: "An adapted, larger board allows four individuals or two teams to play simultaneously.",
    icon: LayoutGrid,
    category: "Variant",
  },
  {
    id: "atomic",
    name: "Atomic",
    description: "Captured pieces cause an explosive blast, removing all adjacent pieces except pawns.",
    icon: Bomb,
    category: "Variant",
  },
];

export default function PlayOnlinePage() {
  const [selectedMode, setSelectedMode] = useState<GameMode>(allModes[0]);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"new_game" | "games" | "players">("new_game");

  const handleSelectMode = (mode: GameMode) => {
    setSelectedMode(mode);
    setDropdownOpen(false);
  };

  const SelectedIcon = selectedMode.icon;

  return (
    <main className="min-h-screen bg-[var(--bg)] transition-colors duration-300 font-sans flex flex-col items-center">
      <Navbar />
      
      <div className="flex-1 w-full flex items-center justify-center pt-24 pb-12 px-4 max-[480px]:px-2">
        {/* Main Hub Container */}
        <div className="w-full max-w-md bg-[var(--surface)] border border-[var(--border)] rounded-2xl shadow-2xl overflow-hidden flex flex-col">
          
          {/* Header Tabs */}
          <div className="flex border-b border-[var(--border)] bg-[var(--surface-alt)]">
            <button 
              onClick={() => setActiveTab("new_game")}
              className={`flex-1 py-4 flex flex-col items-center justify-center transition-colors relative ${activeTab === "new_game" ? "text-[var(--text-primary)]" : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"}`}
            >
              <div className="w-6 h-6 mb-1 rounded bg-[var(--border)] flex items-center justify-center text-[10px] font-bold">+</div>
              <span className="text-xs font-semibold">New Game</span>
              {activeTab === "new_game" && <div className="absolute bottom-0 left-0 w-full h-[2px] bg-[var(--text-primary)]"></div>}
            </button>
            <button 
              onClick={() => setActiveTab("games")}
              className={`flex-1 py-4 flex flex-col items-center justify-center transition-colors relative ${activeTab === "games" ? "text-[var(--text-primary)]" : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"}`}
            >
              <LayoutGrid className="w-6 h-6 mb-1 opacity-80" />
              <span className="text-xs font-semibold">Games</span>
              {activeTab === "games" && <div className="absolute bottom-0 left-0 w-full h-[2px] bg-[var(--text-primary)]"></div>}
            </button>
            <button 
              onClick={() => setActiveTab("players")}
              className={`flex-1 py-4 flex flex-col items-center justify-center transition-colors relative ${activeTab === "players" ? "text-[var(--text-primary)]" : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"}`}
            >
              <Users className="w-6 h-6 mb-1 opacity-80" />
              <span className="text-xs font-semibold">Players</span>
              {activeTab === "players" && <div className="absolute bottom-0 left-0 w-full h-[2px] bg-[var(--text-primary)]"></div>}
            </button>
          </div>

          {/* Body Content */}
          <div className="p-6 flex flex-col space-y-4">
            
            {/* Custom Dropdown */}
            <div className="relative">
              <Tooltip content={selectedMode.description} position="top">
                <button 
                  onClick={() => setDropdownOpen(!dropdownOpen)}
                  className="w-full bg-[var(--surface-alt)] hover:bg-[var(--surface-hover)] border border-[var(--border)] rounded-xl py-4 px-5 flex items-center justify-between transition-colors shadow-sm"
                >
                  <div className="flex items-center space-x-3">
                    <SelectedIcon className="w-6 h-6 text-[var(--cta-bg)]" />
                    <span className="text-lg font-bold text-[var(--text-primary)] tracking-wide">{selectedMode.name}</span>
                  </div>
                  <ChevronDown className={`w-5 h-5 text-[var(--text-muted)] transition-transform duration-200 ${dropdownOpen ? 'rotate-180' : ''}`} />
                </button>
              </Tooltip>

              {/* Dropdown Menu */}
              {dropdownOpen && (
                <div className="absolute top-full left-0 w-full mt-2 bg-[var(--surface-alt)] border border-[var(--border)] rounded-xl shadow-2xl z-50 max-h-[300px] overflow-y-auto">
                  <div className="px-4 py-2 text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider sticky top-0 bg-[var(--surface-alt)]">Traditional</div>
                  {allModes.filter(m => m.category === "Traditional").map((mode) => {
                    const Icon = mode.icon;
                    return (
                      <button 
                        key={mode.id}
                        onClick={() => handleSelectMode(mode)}
                        className="w-full px-4 py-3 flex items-center justify-between hover:bg-[var(--surface-hover)] transition-colors group"
                      >
                        <div className="flex items-center space-x-3">
                          <Icon className="w-5 h-5 text-[var(--text-secondary)] group-hover:text-[var(--text-primary)]" />
                          <span className={`text-[15px] font-medium ${selectedMode.id === mode.id ? 'text-[var(--text-primary)]' : 'text-[var(--text-secondary)]'}`}>{mode.name}</span>
                        </div>
                        {selectedMode.id === mode.id && <Check className="w-4 h-4 text-[var(--text-primary)]" />}
                      </button>
                    )
                  })}
                  <div className="px-4 py-2 text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider sticky top-0 bg-[var(--surface-alt)] border-t border-[var(--border)]">Variants</div>
                  {allModes.filter(m => m.category === "Variant").map((mode) => {
                    const Icon = mode.icon;
                    return (
                      <button 
                        key={mode.id}
                        onClick={() => handleSelectMode(mode)}
                        className="w-full px-4 py-3 flex items-center justify-between hover:bg-[var(--surface-hover)] transition-colors group"
                      >
                        <div className="flex items-center space-x-3">
                          <Icon className="w-5 h-5 text-[var(--text-secondary)] group-hover:text-[var(--text-primary)]" />
                          <span className={`text-[15px] font-medium ${selectedMode.id === mode.id ? 'text-[var(--text-primary)]' : 'text-[var(--text-secondary)]'}`}>{mode.name}</span>
                        </div>
                        {selectedMode.id === mode.id && <Check className="w-4 h-4 text-[var(--text-primary)]" />}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Huge Start Button */}
            <button className="w-full bg-[var(--cta-bg)] hover:bg-[var(--cta-hover)] text-[var(--cta-text)] font-extrabold text-2xl py-6 rounded-xl shadow-[0_10px_0_0_rgba(0,0,0,0.2)] hover:shadow-[0_6px_0_0_rgba(0,0,0,0.2)] hover:translate-y-1 transition-all active:shadow-[0_0px_0_0_rgba(0,0,0,0.2)] active:translate-y-[10px]">
              Start Game
            </button>

            {/* Secondary Actions */}
            <div className="pt-4 flex flex-col space-y-3">
              <button className="w-full bg-[var(--surface-alt)] hover:bg-[var(--surface-hover)] border border-[var(--border)] rounded-xl py-4 flex items-center justify-center space-x-3 transition-colors shadow-sm">
                <Settings className="w-5 h-5 text-[var(--text-muted)]" />
                <span className="text-lg font-bold text-[var(--text-primary)]">Custom Challenge</span>
              </button>
              
              <button className="w-full bg-[var(--surface-alt)] hover:bg-[var(--surface-hover)] border border-[var(--border)] rounded-xl py-4 flex items-center justify-center space-x-3 transition-colors shadow-sm">
                <Handshake className="w-5 h-5 text-[#D4A373] dark:text-[#E6B981]" />
                <span className="text-lg font-bold text-[var(--text-primary)]">Play a Friend</span>
              </button>
              
              <button className="w-full bg-[var(--surface-alt)] hover:bg-[var(--surface-hover)] border border-[var(--border)] rounded-xl py-4 flex items-center justify-center space-x-3 transition-colors shadow-sm">
                <Trophy className="w-5 h-5 text-[#FFD700]" />
                <span className="text-lg font-bold text-[var(--text-primary)]">Tournaments</span>
              </button>
            </div>

          </div>
          
        </div>
      </div>
    </main>
  );
}
