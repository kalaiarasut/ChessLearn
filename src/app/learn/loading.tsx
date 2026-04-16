export default function LearnLoading() {
  return (
    <div className="min-h-screen flex flex-col items-center overflow-x-hidden animate-pulse bg-[var(--bg)]">
      {/* Navbar Skeleton */}
      <header className="w-full max-w-[1400px] px-6 py-8 flex items-center justify-between border-[var(--border)]">
        <div className="w-[100px] h-[30px] bg-[var(--skeleton)] rounded-md"></div>
        <nav className="hidden lg:flex items-center space-x-10">
          <div className="w-[60px] h-[20px] bg-[var(--skeleton)] rounded-md"></div>
          <div className="w-[60px] h-[20px] bg-[var(--skeleton)] rounded-md"></div>
          <div className="w-[60px] h-[20px] bg-[var(--skeleton)] rounded-md"></div>
          <div className="w-[60px] h-[20px] bg-[var(--skeleton)] rounded-md"></div>
          <div className="w-[60px] h-[20px] bg-[var(--skeleton)] rounded-md"></div>
        </nav>
        <div className="flex items-center space-x-6">
          <div className="w-[50px] h-[20px] bg-[var(--skeleton)] rounded-md hidden sm:block"></div>
          <div className="w-[90px] h-[40px] bg-[var(--skeleton)] rounded-full"></div>
        </div>
      </header>

      {/* Main Content Skeleton */}
      <main className="flex-1 w-full max-w-[1200px] px-6 py-12 mb-20 md:py-20 mt-16">
        <div className="mb-12 md:mb-16">
          <div className="w-[120px] h-[20px] bg-[var(--skeleton)] mb-6 rounded-md"></div>
          <div className="w-[350px] h-[60px] md:h-[80px] bg-[var(--skeleton)] mb-6 rounded-xl"></div>
          <div className="w-full max-w-2xl h-[40px] md:h-[60px] bg-[var(--skeleton)] rounded-xl"></div>
        </div>

        {/* Cards Grid Skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
          {Array.from({ length: 9 }).map((_, idx) => (
            <div 
              key={idx} 
              className="bg-gradient-to-b from-[var(--card-from)] to-[var(--card-to)] border border-[var(--border)] rounded-2xl p-8 shadow-lg flex flex-col justify-between"
            >
              <div>
                <div className="w-[180px] h-[30px] bg-[var(--skeleton)] mb-4 rounded-md"></div>
                <div className="w-[120px] h-[35px] bg-[var(--skeleton-soft)] mb-5 rounded-lg"></div>
                <div className="w-full h-[60px] bg-[var(--skeleton-soft)] rounded-md"></div>
              </div>
              <div className="mt-8 flex items-center">
                <div className="w-[110px] h-[25px] bg-[var(--skeleton)] rounded-md"></div>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}