export default function OpeningLoading() {
  return (
    <div className="min-h-screen flex flex-col overflow-x-hidden bg-[#0f0f0f] animate-pulse">
      {/* Header Skeleton */}
      <header className="w-full px-8 py-5 flex items-center justify-between border-b border-white/5">
        <div className="text-[22px] font-serif font-[800] text-gray-500 tracking-wider">CHESS</div>
        <div className="w-[120px] h-[20px] bg-white/10 rounded-md"></div>
      </header>

      <main className="flex-[1_0_auto] w-full flex flex-col lg:flex-row min-h-[calc(100vh-73px)]">
        {/* Left Panel Skeleton */}
        <div className="w-full lg:w-[35%] flex flex-col items-center justify-center p-10 bg-[#0f0f0f] relative z-10 shrink-0">
          <div className="w-full max-w-[420px] bg-[#161616] border border-[#2a2a2a] rounded-2xl p-8 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-[4px] bg-gradient-to-r from-blue-500/20 to-emerald-400/20" />
            
            {/* Title Skeleton */}
            <div className="w-[200px] h-[38px] bg-white/10 rounded-md mb-2"></div>
            
            {/* Badge Skeleton */}
            <div className="w-[150px] h-[34px] bg-white/5 rounded-md mb-6"></div>

            {/* Description Skeleton */}
            <div className="w-full h-[80px] bg-white/5 rounded-md mb-8"></div>

            {/* Turn & Moves Skeleton */}
            <div className="grid grid-cols-2 gap-3 mb-6 text-sm">
              <div className="rounded-xl border border-white/8 bg-black/30 px-4 py-3">
                 <div className="w-[40px] h-[14px] bg-white/10 mb-2 rounded"></div>
                 <div className="w-[60px] h-[20px] bg-white/20 rounded"></div>
              </div>
              <div className="rounded-xl border border-white/8 bg-black/30 px-4 py-3">
                 <div className="w-[40px] h-[14px] bg-white/10 mb-2 rounded"></div>
                 <div className="w-[30px] h-[20px] bg-white/20 rounded"></div>
              </div>
            </div>

            {/* Position Skeleton */}
            <div className="rounded-xl border border-white/8 bg-black/30 px-4 py-4 mb-8">
              <div className="w-[60px] h-[14px] bg-white/10 mb-3 rounded"></div>
              <div className="w-[180px] h-[20px] bg-white/10 rounded"></div>
            </div>

            {/* Stockfish Skeleton */}
            <div className="rounded-xl border border-white/8 bg-black/30 px-4 py-4 mb-8">
              <div className="flex items-center justify-between mb-4">
                <div className="w-[80px] h-[14px] bg-white/10 rounded"></div>
                <div className="w-[60px] h-[14px] bg-white/10 rounded"></div>
              </div>

              {/* Analysis Lines Skeleton */}
              <div className="space-y-2">
                <div className="rounded-lg bg-white/[0.03] px-3 py-6"></div>
                <div className="rounded-lg bg-white/[0.03] px-3 py-6"></div>
                <div className="rounded-lg bg-white/[0.03] px-3 py-6"></div>
              </div>
            </div>

            {/* Reset Button Skeleton */}
            <div className="w-full h-[58px] bg-white/10 rounded-lg"></div>
          </div>
        </div>

        {/* Right Panel (Board) Skeleton */}
        <div className="w-full lg:w-[65%] flex-1 flex flex-row items-center justify-center bg-[#131212] p-8 lg:p-0 relative shadow-[-30px_0_50px_rgba(0,0,0,0.4)] border-l border-[#222]">
          
          {/* Settings Button Skeleton */}
          <div className="absolute top-6 right-6 w-[42px] h-[42px] rounded-full bg-[#202020] border border-white/10 shadow-lg"></div>

          <div className="flex items-stretch h-[95vh] max-h-[1000px] aspect-[1/0.95] max-w-[95%] justify-center">
            {/* Eval Bar Skeleton */}
            <div className="w-[30px] md:w-[45px] mr-[20px] md:mr-[40px] bg-[#333] rounded overflow-hidden flex flex-col relative h-[100%]">
              <div className="w-full h-[50%] bg-[#202020]"></div>
              <div className="w-full h-[50%] bg-white/10"></div>
            </div>

            {/* Board Grid Skeleton */}
            <div className="h-full aspect-square relative bg-[#2a2a2a] rounded-sm overflow-hidden border border-[#111]">
              <div className="w-full h-full grid grid-cols-8 grid-rows-8 relative">
                {Array.from({ length: 64 }).map((_, i) => {
                  const row = Math.floor(i / 8);
                  const col = i % 8;
                  const isLightSquare = (row + col) % 2 === 0;
                  return (
                    <div 
                      key={i} 
                      className={`${isLightSquare ? "bg-[#e8edeb]/5" : "bg-[#71828f]/5"}`}
                    ></div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}