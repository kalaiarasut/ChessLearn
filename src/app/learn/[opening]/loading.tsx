import { ArrowLeft, MoreHorizontal, Settings } from "lucide-react";

export default function OpeningLoading() {
  return (
    <div className="min-h-screen flex flex-col overflow-x-hidden bg-[var(--bg)] animate-pulse">
      {/* Header Skeleton */}
      <header className="w-full px-4 sm:px-8 py-4 sm:py-5 flex items-center justify-between border-b border-[var(--border)]">
        <div className="text-[20px] sm:text-[22px] font-serif font-[800] text-[var(--text-primary)]">CHESS</div>
        <div className="inline-flex items-center text-[var(--text-secondary)] text-[13px] sm:text-[14px] font-medium">
          <ArrowLeft className="w-4 h-4 mr-1.5 sm:mr-2" />
          <span className="hidden sm:inline">Back to Learn</span>
          <span className="sm:hidden">Back</span>
        </div>
      </header>

      <main className="flex-1 w-full flex flex-col-reverse lg:flex-row h-auto lg:h-[calc(100vh-73px)]">
        {/* Left Panel Skeleton */}
        <div className="w-full lg:w-[35%] h-[550px] lg:h-full p-4 lg:p-5 bg-[var(--bg)] relative z-10 shrink-0 border-t lg:border-t-0 lg:border-r border-[var(--border)]">
          <div className="w-full h-full bg-[var(--surface)] border border-[var(--border)] rounded-xl shadow-2xl overflow-hidden flex flex-col">
            
            {/* 1. Header (Title & Status) */}
            <div className="border-b border-[var(--border)] px-3 py-2 bg-[var(--surface-alt)]">
              <div className="h-[18px] w-[50%] bg-[var(--skeleton)] rounded"></div>
            </div>

            {/* 2. Opening Trainer / Base Line / Stats / Variations */}
            <div className="border-b border-[var(--border)] px-3 py-2 bg-[var(--surface)] flex flex-col shrink-0">
              <div className="text-[14px] font-semibold tracking-wide text-[var(--text-primary)] mb-1 shrink-0">Opening Trainer</div>
              
              <div className="flex flex-col shrink-0">
                {/* Base line progress */}
                <div className="flex items-center justify-between gap-3 mb-1 shrink-0">
                  <div className="h-[14px] w-[150px] bg-[var(--skeleton-soft)] rounded"></div>
                  <div className="h-[26px] w-[80px] rounded border border-[var(--border)] bg-[var(--surface-alt)]"></div>
                </div>
                {/* Required move */}
                <div className="h-[14px] w-[120px] bg-[var(--skeleton)] rounded mb-2 shrink-0"></div>
                
                {/* Popularity Box */}
                <div className="mb-2 rounded-md border border-[var(--border)] bg-[var(--surface-alt)] px-2 py-2">
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-primary)] mb-[4px]">
                    Main Line Move Popularity (Global)
                  </div>
                  <div className="space-y-1">
                    <div className="border-b border-[var(--border-subtle)] pb-1">
                      <div className="h-[14px] w-[60%] bg-[var(--skeleton-soft)] rounded mb-[2px]"></div>
                      <div className="h-[12px] w-[40%] bg-[var(--skeleton-soft)] rounded"></div>
                    </div>
                    <div className="border-b border-[var(--border-subtle)] pb-1">
                      <div className="h-[14px] w-[50%] bg-[var(--skeleton-soft)] rounded mb-[2px]"></div>
                      <div className="h-[12px] w-[40%] bg-[var(--skeleton-soft)] rounded"></div>
                    </div>
                    <div className="pb-1">
                      <div className="h-[14px] w-[55%] bg-[var(--skeleton-soft)] rounded mb-[2px]"></div>
                      <div className="h-[12px] w-[40%] bg-[var(--skeleton-soft)] rounded"></div>
                    </div>
                  </div>
                </div>

                {/* Variations Box */}
                <div className="mt-1 flex flex-col shrink-0" style={{ height: "180px", overflow: "hidden" }}>
                  <div className="rounded-md border border-[var(--border)] bg-[var(--surface-alt)] flex flex-col h-full overflow-hidden">
                    <div className="px-2 py-1 border-b border-[var(--border)] text-[11px] font-semibold uppercase tracking-wide text-[var(--text-primary)] shrink-0">
                      Variations
                    </div>
                    <div className="px-2 py-2">
                      <div className="h-[14px] w-[80%] bg-[var(--skeleton-soft)] rounded"></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* 3. Analysis Header */}
            <div className="h-12 px-3 border-b border-[var(--border)] flex items-center justify-between relative shrink-0">
              <div className="flex items-center gap-2">
                <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-[var(--surface-hover)] text-[var(--text-primary)] text-[10px]">v</span>
                <span className="text-[var(--text-primary)] text-[15px] font-[500] leading-none">Analysis</span>
                <MoreHorizontal className="w-4 h-4 text-[var(--text-muted)]" />
              </div>
              <div className="flex items-center gap-3">
                <span className="inline-flex items-center rounded border border-[var(--border-subtle)] bg-[var(--surface-alt)] px-2 py-0.5 text-[11px] text-[var(--text-secondary)]">
                  <div className="w-16 h-3 bg-[var(--skeleton-soft)] rounded"></div>
                </span>
                <div className="w-12 h-3 bg-[var(--skeleton-soft)] rounded"></div>
                <Settings className="w-4 h-4 text-[var(--text-muted)]" />
              </div>
            </div>

            {/* 3b. Analysis Content Skeleton */}
            <div className="flex-1 min-h-0 flex flex-col">
              <div className="max-h-[255px] overflow-y-auto custom-scrollbar border-b border-[var(--border)]">
                <div className="flex flex-col border-b border-[var(--border)]">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="min-h-[44px] px-2 py-2 border-b border-[var(--border)] flex items-start gap-2 last:border-0">
                      <div className="w-[52px] h-6 rounded bg-[var(--skeleton)]"></div>
                      <div className="flex-1 flex flex-wrap gap-2 pt-[2px]">
                        <div className="w-8 h-4 rounded bg-[var(--skeleton-soft)]"></div>
                        <div className="w-10 h-4 rounded bg-[var(--skeleton-soft)]"></div>
                        <div className="w-6 h-4 rounded bg-[var(--skeleton-soft)]"></div>
                        <div className="w-12 h-4 rounded bg-[var(--skeleton-soft)]"></div>
                        <div className="w-8 h-4 rounded bg-[var(--skeleton-soft)]"></div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* 4. White - Black / Move History */}
            <div className="flex-1 min-h-0 flex flex-col bg-[var(--surface)]">
              <div className="px-3 py-2 border-b border-[var(--border)] text-[13px] font-semibold text-[var(--text-primary)]">
                White - Black
              </div>
              <div className="flex-1 p-3">
                <div className="h-[14px] w-20 bg-[var(--skeleton-soft)] rounded"></div>
              </div>
            </div>

            {/* 5. Playback Controls */}
            <div className="px-3 py-3 border-t border-[var(--border)] flex flex-col items-center gap-3 shrink-0">
              <div className="w-[180px] h-8 bg-[var(--skeleton-soft)] rounded"></div>
              <div className="w-full h-10 bg-[var(--skeleton)] rounded"></div>
            </div>
          </div>
        </div>

        {/* Right Panel (Board) Skeleton */}
        <div className="w-full lg:w-[65%] flex-1 flex flex-col lg:flex-row items-center lg:items-start justify-center lg:justify-end bg-[var(--bg-alt)] p-4 lg:p-0 lg:pt-6 lg:pr-[70px] relative shadow-none lg:shadow-[-30px_0_50px_rgba(0,0,0,0.15)] border-l-0 lg:border-l border-[var(--border)]">
          
          {/* Floating Buttons Skeleton */}
          <div className="w-full lg:w-auto flex justify-end lg:absolute lg:top-6 lg:right-6 flex-row lg:flex-col gap-1.5 lg:gap-3 z-50 mb-1 lg:mb-0">
             <div className="w-8 h-8 lg:w-10 lg:h-10 rounded-full bg-[var(--skeleton)] border border-[var(--border)]"></div>
             <div className="w-8 h-8 lg:w-10 lg:h-10 rounded-full bg-[var(--skeleton)] border border-[var(--border)]"></div>
             <div className="w-8 h-8 lg:w-10 lg:h-10 rounded-full bg-[var(--skeleton)] border border-[var(--border)]"></div>
          </div>

          <div className="flex items-stretch w-full lg:w-auto h-auto lg:h-[85vh] max-h-[820px] lg:aspect-[1/0.95] max-w-[100%] lg:max-w-[85%] justify-center lg:justify-end">
            
            {/* Eval Bar Skeleton */}
            <div className="w-[16px] md:w-[30px] mr-[8px] md:mr-[24px] bg-[var(--skeleton-soft)] rounded overflow-hidden flex flex-col relative shrink-0 border border-[var(--border)] shadow-[0_2px_10px_rgba(0,0,0,0.1)]">
               <div className="w-full h-[50%] bg-[var(--skeleton)]"></div>
            </div>

            {/* Board Grid Skeleton */}
            <div className="flex-1 lg:flex-none h-auto lg:h-full aspect-square relative overflow-hidden bg-[var(--surface-alt)] border border-[var(--border)] rounded-sm">
               <div className="w-full h-full grid grid-cols-8 grid-rows-8">
                  {Array.from({ length: 64 }).map((_, i) => (
                    <div 
                      key={i} 
                      className={(Math.floor(i / 8) + (i % 8)) % 2 === 0 ? "bg-[var(--skeleton-soft)]" : "bg-[var(--skeleton)]"}
                    ></div>
                  ))}
               </div>
            </div>

          </div>
        </div>
      </main>
    </div>
  );
}