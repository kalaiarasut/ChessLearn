export default function OpeningLoading() {
  return (
    <div className="min-h-screen flex flex-col overflow-x-hidden bg-[var(--bg)] animate-pulse">
      {/* Header Skeleton */}
      <header className="w-full px-8 py-5 flex items-center justify-between border-b border-[var(--border)]">
        <div className="text-[22px] font-serif font-[800] text-[var(--text-primary)]">CHESS</div>
        <div className="w-[124px] h-[20px] bg-[var(--skeleton)] rounded-md"></div>
      </header>

      <main className="flex-[1_0_auto] w-full flex flex-col lg:flex-row min-h-[calc(100vh-73px)]">
        {/* Left Panel Skeleton */}
        <div className="w-full lg:w-[35%] p-6 lg:p-5 bg-[var(--bg)] relative z-10 shrink-0 border-r border-[var(--border)]">
          <div className="w-full h-full bg-[#1e1e1f] border border-[#2d2d2f] rounded-xl shadow-2xl flex flex-col">
            {/* Toolbar Header */}
            <div className="h-12 px-3 border-b border-[#2c2c2d] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full bg-[#3a3a3a]"></div>
                <div className="w-16 h-4 bg-[#2d2d2f] rounded"></div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-12 h-4 bg-[#2d2d2f] rounded"></div>
                <div className="w-4 h-4 bg-[#2d2d2f] rounded"></div>
              </div>
            </div>
            {/* Content Area */}
            <div className="flex-1 p-4 flex flex-col gap-4">
              <div className="w-full h-12 bg-[#2a2a2c] rounded-md"></div>
              <div className="w-full h-8 bg-[#2a2a2c] rounded-md"></div>
              <div className="w-full h-8 bg-[#2a2a2c] rounded-md"></div>
              <div className="w-full h-24 bg-[#2a2a2c] rounded-md mt-auto"></div>
            </div>
          </div>
        </div>

        {/* Right Panel (Board) Skeleton */}
        <div className="w-full lg:w-[65%] flex-1 flex flex-row items-center justify-center bg-[var(--bg-alt)] p-8 lg:p-0 relative shadow-[-30px_0_50px_rgba(0,0,0,0.4)] border-l border-[var(--border)]">
          
          {/* Settings Button Skeleton */}
          <div className="absolute top-6 right-6 w-[42px] h-[42px] rounded-full bg-[var(--surface-alt)] border border-[var(--border)] shadow-lg"></div>

          <div className="flex items-stretch h-[95vh] max-h-[1000px] aspect-[1/0.95] max-w-[95%] justify-center">
            {/* Eval Bar Skeleton */}
            <div className="w-[30px] md:w-[45px] mr-[20px] md:mr-[40px] bg-[var(--border)] rounded overflow-hidden flex flex-col relative h-[100%]">
              <div className="w-full h-[50%] bg-[var(--surface-alt)]"></div>
              <div className="w-full h-[50%] bg-[var(--skeleton)]"></div>
            </div>

            {/* Board Grid Skeleton */}
            <div className="h-full aspect-square relative bg-[var(--border)] rounded-sm overflow-hidden border border-[var(--border)]">
              <div className="w-full h-full grid grid-cols-8 grid-rows-8 relative">
                {Array.from({ length: 64 }).map((_, i) => {
                  const row = Math.floor(i / 8);
                  const col = i % 8;
                  const isLightSquare = (row + col) % 2 === 0;
                  return (
                    <div 
                      key={i} 
                      className={`${isLightSquare ? "bg-black/5 dark:bg-white/5" : "bg-black/10 dark:bg-white/10"}`}
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