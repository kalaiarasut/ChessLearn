"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { useState } from "react";
import { ArrowLeft, ChevronDown, BookOpen, Settings } from "lucide-react";

// Full scraped themes lists
const AVAILABLE_BOARD_THEMES = [
  "8_bit", "blue", "brown", "bubblegum", "burled_wood", "dark_wood", "dash", 
  "game_room", "glass", "graffiti", "green", "icy_sea", "light", "lolz", "marble", 
  "nature", "neo", "neon", "newspaper", "ocean", "osfa", "overlay", "parchment", 
  "purple", "red", "sand", "sky", "stone", "tigers", "tournament", "translucent", 
  "walnut", "wood"
];

const AVAILABLE_PIECE_THEMES = [
  "8_bit", "alpha", "bases", "book", "bubblegum", "cases", "chessnut", "classic", 
  "club", "condal", "dash", "game_room", "glass", "gothic", "graffiti", "icy_sea", 
  "light", "lolz", "lucida", "marble", "nature", "neo", "neo_wood", "neon", "ocean", 
  "osfa", "sky", "space", "tigers", "tournament", "vintage", "wood", "3d-plastic", 
  "3d-staunton", "3d-wood"
];

// Standard starting position after 1. e4
const boardRow8 = ["br", "bn", "bb", "bq", "bk", "bb", "bn", "br"];
const boardRow7 = ["bp", "bp", "bp", "bp", "bp", "bp", "bp", "bp"];
const boardRow6 = [null, null, null, null, null, null, null, null];
const boardRow5 = [null, null, null, null, null, null, null, null];
const boardRow4 = [null, null, null, null, "wp", null, null, null];
const boardRow3 = [null, null, null, null, null, null, null, null];
const boardRow2 = ["wp", "wp", "wp", "wp", null, "wp", "wp", "wp"];
const boardRow1 = ["wr", "wn", "wb", "wq", "wk", "wb", "wn", "wr"];
const boardState = [boardRow8, boardRow7, boardRow6, boardRow5, boardRow4, boardRow3, boardRow2, boardRow1];

// Minimal realistic images loaded via standard paths.
const getPieceIcon = (code: string | null, pieceTheme: string) => {
  if (!code) return null;
  const isWhite = code[0] === "w";
  const type = code[1];
  
  // Use dynamically selected piece theme
  const url = `/pieces/${pieceTheme}/150/${code}.png`;

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img 
      src={url} 
      alt={code} 
      className="w-full h-full select-none pointer-events-none transform transition-transform duration-200 drop-shadow-[0_4px_6px_rgba(0,0,0,0.5)]" 
    />
  );
};

export default function OpeningPage() {
  const pathname = usePathname();
  const title = pathname.split("/").pop()?.replace(/-/g, " ") || "Opening";
  const formattedTitle = title.charAt(0).toUpperCase() + title.slice(1);

  const [boardTheme, setBoardTheme] = useState("burled_wood");
  const [pieceTheme, setPieceTheme] = useState("glass");
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);

  return (
    <div className="min-h-screen flex flex-col overflow-x-hidden bg-[#0f0f0f]">
      {/* Navbar Minimal */}
      <header className="w-full px-8 py-5 flex items-center justify-between border-b border-white/5">
        <Link href="/" className="text-[22px] font-serif font-[800] text-white">CHESS</Link>
        <Link href="/learn" className="inline-flex items-center text-[#aaaaaa] hover:text-white transition-colors text-[14px] font-medium group">
          <ArrowLeft className="w-4 h-4 mr-2 transform group-hover:-translate-x-1 transition-transform" /> Back to Learn
        </Link>
      </header>

      {/* Split Layout */}
      <main className="flex-1 w-full flex flex-col lg:flex-row h-[calc(100vh-73px)]">
        
        {/* Left Side: Guidance Card */}
        <div className="w-full lg:w-[35%] flex flex-col items-center justify-center p-10 bg-[#0f0f0f] relative z-10 shrink-0">
          <div className="w-full max-w-[420px] bg-[#161616] border border-[#2a2a2a] rounded-2xl p-8 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-[4px] bg-gradient-to-r from-blue-500 to-emerald-400" />
            <h1 className="text-[32px] font-serif text-white font-[500] leading-tight mb-2 tracking-tight">
              {formattedTitle}
            </h1>
            <div className="bg-black/60 rounded-md py-2 px-3 mb-6 font-mono text-[13px] font-bold text-[#d0d0d0] border border-white/5 inline-flex shadow-inner">
              Move 1. e4
            </div>
            
            <p className="text-[#999999] text-[15px] leading-relaxed mb-8">
              You play <strong className="text-white">e4</strong> to seize control of the center and open lines for your Queen and King's Bishop. This is the most popular and assertive first move in chess history. Wait to see how Black responds to determine your specific opening strategy.
            </p>

            <button className="w-full flex items-center justify-center px-6 py-4 bg-white text-black rounded-lg font-bold text-[15px] hover:bg-gray-200 transition-colors shadow-lg">
              Continue Lesson <span className="ml-2">&rarr;</span>
            </button>
          </div>
        </div>

        {/* Right Side: Chessboard & Eval Bar */}
        <div className="w-full lg:w-[65%] flex-1 flex flex-row items-center justify-center bg-[#131212] p-8 lg:p-0 relative shadow-[-30px_0_50px_rgba(0,0,0,0.4)] border-l border-[#222]">
          
          {/* Settings Toggle button */}
          <button 
            onClick={() => setIsSettingsOpen(!isSettingsOpen)} 
            className="absolute top-6 right-6 p-2.5 rounded-full bg-[#202020] text-gray-400 hover:text-white hover:bg-gray-800 transition-all z-50 border border-white/10 shadow-lg"
          >
            <Settings className="w-5 h-5" />
          </button>

          {/* Settings Modal/Dropdown */}
          {isSettingsOpen && (
            <div className="absolute top-20 right-6 w-[280px] bg-[#1a1a1a] rounded-xl border border-white/10 shadow-2xl p-5 z-50 animate-in fade-in slide-in-from-top-4 duration-200">
              <h3 className="text-white font-serif text-[18px] font-bold mb-4 border-b border-white/10 pb-2">Appearance</h3>
              
              <div className="mb-4">
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Board Theme</label>
                <div className="relative">
                  <select 
                    value={boardTheme} 
                    onChange={(e) => setBoardTheme(e.target.value)} 
                    className="w-full appearance-none bg-[#262626] border border-white/10 text-white rounded-lg py-2.5 pl-3 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
                  >
                    {AVAILABLE_BOARD_THEMES.map(t => (
                      <option key={t} value={t}>{t.replace('_', ' ')}</option>
                    ))}
                  </select>
                  <ChevronDown className="w-4 h-4 text-gray-400 absolute right-3 top-3 pointer-events-none" />
                </div>
              </div>

              <div className="mb-4">
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Piece Theme</label>
                <div className="relative">
                  <select 
                    value={pieceTheme} 
                    onChange={(e) => setPieceTheme(e.target.value)} 
                    className="w-full appearance-none bg-[#262626] border border-white/10 text-white rounded-lg py-2.5 pl-3 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
                  >
                    {AVAILABLE_PIECE_THEMES.map(t => (
                      <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>
                    ))}
                  </select>
                  <ChevronDown className="w-4 h-4 text-gray-400 absolute right-3 top-3 pointer-events-none" />
                </div>
              </div>

              <div className="pt-4 border-t border-white/10">
                <label className="flex items-center justify-between cursor-pointer group">
                  <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider group-hover:text-white transition-colors">Play Sounds</span>
                  <div className="relative">
                    <input 
                      type="checkbox" 
                      className="sr-only" 
                      checked={soundEnabled}
                      onChange={() => {
                        setSoundEnabled(!soundEnabled);
                        if (!soundEnabled) {
                          const audio = new Audio('/sounds/move-self.mp3');
                          audio.play().catch(() => {});
                        }
                      }}
                    />
                    <div className={`block w-10 h-6 rounded-full transition-colors ${soundEnabled ? 'bg-emerald-500' : 'bg-[#333]'}`}></div>
                    <div className={`dot absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${soundEnabled ? 'translate-x-4' : ''}`}></div>
                  </div>
                </label>
              </div>
            </div>
          )}

          <div className="flex items-stretch h-[95vh] max-h-[1000px] aspect-[1/0.95] max-w-[95%] justify-center">
            
            {/* Evaluation Bar */}
            <div className="w-[30px] md:w-[45px] mr-[20px] md:mr-[40px] bg-[#333333] rounded overflow-hidden flex flex-col relative h-[100%] shadow-[0_2px_10px_rgba(0,0,0,0.5)]">
               {/* Black Advantage Area (Top) */}
               <div className="w-full bg-[#202020] flex-1"></div>
               {/* White Advantage Area (Bottom) */}
               <div className="w-full bg-white h-[55%] relative shadow-[0_-2px_10px_rgba(255,255,255,0.6)] flex flex-col justify-end pb-1.5 border-t border-[#666]">
                 <span className="text-center text-[11px] md:text-[13px] font-[700] text-black">0.2</span>
               </div>
            </div>

            {/* Chessboard */}
            <div 
              className="h-full aspect-square rounded-[3px] shadow-2xl relative overflow-hidden"
              style={{
                // Chess.com standard piece boards are solid images. 
                backgroundImage: `url("/boards/${boardTheme}.png")`,
                backgroundSize: "100% 100%"
              }}
            >
              {/* Outer Board Frame/Border */}
              <div 
                className="w-full h-full grid grid-cols-8 grid-rows-8 relative"
              >
                {boardState.map((row, rIndex) => (
                  row.map((piece, cIndex) => {
                    const isLightSquare = (rIndex + cIndex) % 2 === 0;

                    return (
                      <div 
                        key={`${rIndex}-${cIndex}`}
                        className="relative flex items-center justify-center"
                        style={{
                          // Fully transparent, relying entirely on the background image
                          backgroundColor: "transparent",
                        }}
                      >
                        {/* Rank numbers (8 to 1) on the left-most squares */}
                        {cIndex === 0 && (
                          <span className={`absolute top-0.5 left-1 text-[13px] font-[700] ${isLightSquare ? 'text-[#b07b46]' : 'text-[#e6ca9a]'} select-none`}>
                            {8 - rIndex}
                          </span>
                        )}
                        {/* File letters (a to h) on the bottom-most squares */}
                        {rIndex === 7 && (
                          <span className={`absolute bottom-0 right-1 text-[13px] font-[700] ${isLightSquare ? 'text-[#b07b46]' : 'text-[#e6ca9a]'} select-none`}>
                            {String.fromCharCode(97 + cIndex)}
                          </span>
                        )}

                        {/* Render the specific piece using the pieceTheme */}
                        {piece && getPieceIcon(piece, pieceTheme)}

                        {/* Rendering the specific book notification icon if it's the e4 pawn */}
                        {rIndex === 4 && cIndex === 4 && piece === "wp" && (
                          <div className="absolute -top-3 -right-2 w-[22px] h-[22px] bg-[#d3957a] border-[2px] border-white rounded-[8px] shadow-sm flex items-center justify-center z-10">
                            <BookOpen className="w-[12px] h-[12px] text-white" strokeWidth={3} />
                          </div>
                        )}
                      </div>
                    );
                  })
                ))}
              </div>
            </div>
          <