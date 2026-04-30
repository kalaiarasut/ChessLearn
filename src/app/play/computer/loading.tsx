import { ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function PlayComputerLoading() {
  return (
    <div className="min-h-screen flex flex-col overflow-x-hidden overflow-y-scroll bg-[var(--bg)] animate-pulse">
      {/* Header */}
      <header className="w-full px-4 py-3 md:px-8 md:py-5 flex items-center justify-between border-b border-[var(--border)]">
        <Link href="/" className="text-[22px] font-serif font-[800] text-[var(--text-primary)]">
          CHESS
        </Link>
        <div className="flex items-center gap-3">
          <div className="w-[120px] h-[30px] rounded-full border border-[var(--border-subtle)] bg-[var(--surface-alt)]" />
          <div className="inline-flex items-center text-[var(--text-secondary)] text-[14px] font-medium">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Play
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 w-full flex flex-col lg:flex-row relative z-10">
        
        {/* Left Side: Controls Skeleton */}
        <div className="w-full lg:w-[35%] flex flex-col bg-[var(--surface)] relative z-20 shadow-[10px_0_30px_rgba(0,0,0,0.05)] border-r border-[var(--border)] p-6 md:p-10 lg:p-12">
          
          <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
            {/* Title Section */}
            <div className="flex items-center gap-4 mb-8">
              <div className="w-12 h-12 rounded-2xl bg-[var(--skeleton)] border border-[var(--border)]" />
              <div>
                <div className="w-[200px] h-[28px] bg-[var(--skeleton)] rounded mb-2" />
                <div className="w-[180px] h-[14px] bg-[var(--skeleton)] rounded" />
              </div>
            </div>

            {/* Strength Mode */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-3 px-1">
                <div className="w-[120px] h-[14px] bg-[var(--skeleton)] rounded" />
                <div className="w-[60px] h-[24px] bg-[var(--skeleton)] rounded-md" />
              </div>
              <div className="grid grid-cols-3 gap-2 mb-5">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="h-[40px] rounded-lg bg-[var(--skeleton)] border border-[var(--border)]" />
                ))}
              </div>

              {/* Slider Area */}
              <div className="w-full mt-4 mb-2 space-y-3 px-1">
                <div className="flex items-center justify-between">
                  <div className="w-[100px] h-[14px] bg-[var(--skeleton)] rounded" />
                  <div className="w-[40px] h-[24px] bg-[var(--skeleton)] rounded-md" />
                </div>
                <div className="w-full h-[10px] bg-[var(--skeleton)] rounded-full my-4" />
                <div className="flex justify-between">
                  <div className="w-[80px] h-[12px] bg-[var(--skeleton)] rounded" />
                  <div className="w-[80px] h-[12px] bg-[var(--skeleton)] rounded" />
                </div>
              </div>
            </div>

            {/* Time Limit */}
            <div className="mb-8 mt-10">
              <div className="w-[100px] h-[14px] bg-[var(--skeleton)] rounded mb-4 px-1" />
              <div className="grid grid-cols-4 gap-3">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="h-[46px] rounded-xl bg-[var(--skeleton)] border border-[var(--border)]" />
                ))}
              </div>
            </div>

            {/* Play As */}
            <div className="mb-4">
              <div className="w-[80px] h-[14px] bg-[var(--skeleton)] rounded mb-4 px-1" />
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="h-[104px] rounded-2xl bg-[var(--skeleton)] border border-[var(--border)]" />
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Right Side: The Board Skeleton */}
        <div className="w-full lg:w-[65%] flex-1 flex flex-row items-center lg:items-start justify-center lg:justify-end bg-[var(--bg-alt)] p-2 sm:p-4 lg:p-0 lg:pr-[70px] relative shadow-[-30px_0_50px_rgba(0,0,0,0.15)] border-l border-[var(--border)]">
          <div className="flex flex-col items-center justify-start h-[75vh] max-h-[720px] max-w-[100%] px-1 sm:px-0 sm:max-w-[95%] lg:max-w-[70%] lg:min-w-[500px] w-full relative shrink-0 lg:ml-auto lg:mr-8 lg:mt-4">
            
            <div className="w-full lg:w-auto flex justify-end lg:absolute lg:-top-2 lg:-right-[52px] flex-row lg:flex-col gap-2 sm:gap-3 z-50 mb-2 lg:mb-0 px-1 lg:px-0 items-center">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="w-[42px] h-[42px] rounded-full bg-[var(--skeleton)] border border-[var(--border)]" />
              ))}
            </div>

            <div className="w-full flex items-stretch gap-1 md:gap-3">
              {/* Board Skeleton (No eval bar or panels in setup state) */}
              <div className="flex-1 aspect-square bg-[var(--skeleton)] rounded-sm shadow-2xl relative opacity-90 grayscale-[0.3]">
                <div className="absolute inset-0 grid grid-cols-8 grid-rows-8">
                  {Array.from({ length: 64 }).map((_, i) => {
                    const row = Math.floor(i / 8);
                    const col = i % 8;
                    return (
                      <div
                        key={i}
                        className={(row + col) % 2 === 0 ? 'bg-[var(--surface-alt)] opacity-40' : 'bg-[var(--border)] opacity-20'}
                      />
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>

      </main>
    </div>
  );
}
