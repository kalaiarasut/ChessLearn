import { AuthMenu } from "@/components/auth-menu";

export default function PuzzlesLoading() {
  return (
    <div className="min-h-screen flex flex-col items-center overflow-x-hidden bg-[var(--bg)] animate-pulse">
      {/* Navbar Skeleton */}
      <header className="w-full max-w-[1400px] px-6 py-8 flex items-center justify-between">
        <div className="w-[100px] h-[30px] bg-[var(--skeleton)] rounded-md" />
        <nav className="hidden lg:flex items-center space-x-10">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="w-[60px] h-[20px] bg-[var(--skeleton)] rounded-md" />
          ))}
        </nav>
        <div className="flex items-center space-x-5">
          <div className="w-[38px] h-[38px] bg-[var(--skeleton)] rounded-full" />
          <AuthMenu />
        </div>
      </header>

      <main className="flex-1 w-full max-w-[1200px] px-6 py-12 md:py-16">
        {/* Title Section Skeleton */}
        <div className="mb-14 md:mb-18">
          <div className="w-[120px] h-[16px] bg-[var(--skeleton)] rounded mb-6" />
          <div className="w-[180px] md:w-[250px] h-[48px] md:h-[70px] bg-[var(--skeleton)] rounded-md mb-6" />
          <div className="w-full max-w-[600px] h-[48px] md:h-[60px] bg-[var(--skeleton)] rounded-md" />
        </div>

        {/* Daily Puzzle Card Skeleton */}
        <div className="mb-14 rounded-2xl border border-[var(--border)] bg-[var(--surface-alt)] p-8 md:p-10 shadow-sm flex flex-col md:flex-row md:items-center gap-8">
          <div className="w-[220px] h-[220px] bg-[var(--skeleton)] rounded-xl flex-shrink-0 mx-auto md:mx-0" />
          <div className="flex-1 min-w-0 w-full flex flex-col items-start md:pt-2">
            <div className="w-[200px] h-[20px] bg-[var(--skeleton)] rounded-md mb-3" />
            <div className="w-[80%] max-w-[400px] h-[36px] md:h-[48px] bg-[var(--skeleton)] rounded-md mb-4" />
            <div className="flex flex-wrap gap-2 mb-6 w-full">
              <div className="w-[80px] h-[28px] bg-[var(--skeleton)] rounded-full" />
              <div className="w-[100px] h-[28px] bg-[var(--skeleton)] rounded-full" />
              <div className="w-[90px] h-[28px] bg-[var(--skeleton)] rounded-full" />
            </div>
            <div className="w-[120px] h-[20px] bg-[var(--skeleton)] rounded-md" />
          </div>
        </div>

        {/* Training Modes Grid Skeleton */}
        <div className="mb-14">
          <div className="w-[150px] h-[14px] bg-[var(--skeleton)] rounded-md mb-6" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="rounded-2xl border border-[var(--border)] bg-[var(--surface-alt)] p-7 h-[260px] flex flex-col justify-start">
                <div className="flex justify-between items-center w-full mb-4">
                  <div className="w-12 h-12 bg-[var(--skeleton)] rounded-xl" />
                </div>
                <div className="w-[140px] h-[28px] bg-[var(--skeleton)] rounded-md mb-2" />
                <div className="w-[100px] h-[14px] bg-[var(--skeleton)] rounded-md mb-4" />
                <div className="w-full h-[60px] bg-[var(--skeleton)] rounded-md" />
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
