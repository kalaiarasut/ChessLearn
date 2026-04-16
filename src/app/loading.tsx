export default function Loading() {
  return (
    <div className="min-h-screen flex flex-col items-center overflow-x-hidden animate-pulse bg-[var(--bg)]">
      {/* Navbar Skeleton */}
      <header className="w-full max-w-[1400px] px-6 py-8 flex items-center justify-between">
        {/* Logo */}
        <div className="w-[100px] h-[30px] bg-[var(--skeleton)] rounded-md"></div>

        {/* Navigation Links Skeleton */}
        <nav className="hidden lg:flex items-center space-x-10">
          <div className="w-[60px] h-[20px] bg-[var(--skeleton)] rounded-md"></div>
          <div className="w-[60px] h-[20px] bg-[var(--skeleton)] rounded-md"></div>
          <div className="w-[60px] h-[20px] bg-[var(--skeleton)] rounded-md"></div>
          <div className="w-[60px] h-[20px] bg-[var(--skeleton)] rounded-md"></div>
          <div className="w-[60px] h-[20px] bg-[var(--skeleton)] rounded-md"></div>
          <div className="w-[60px] h-[20px] bg-[var(--skeleton)] rounded-md"></div>
        </nav>

        {/* Auth Buttons Skeleton */}
        <div className="flex items-center space-x-6">
          <div className="w-[50px] h-[20px] bg-[var(--skeleton)] rounded-md hidden sm:block"></div>
          <div className="w-[90px] h-[40px] bg-[var(--skeleton)] rounded-full"></div>
        </div>
      </header>

      {/* Main Hero Content Skeleton */}
      <main className="flex-1 flex flex-col items-center text-center w-full px-4 mt-6 md:mt-16">
        <div className="w-[80%] max-w-[600px] h-[60px] md:h-[100px] bg-[var(--skeleton)] rounded-xl mb-4"></div>
        <div className="w-[60%] max-w-[400px] h-[60px] md:h-[100px] bg-[var(--skeleton)] rounded-xl"></div>
        
        <div className="flex flex-col sm:flex-row items-center justify-center space-y-2 sm:space-y-0 sm:space-x-6 mt-12 w-full max-w-md sm:max-w-none">
           <div className="w-[150px] h-[24px] bg-[var(--skeleton)] rounded-md"></div>
           <div className="w-[150px] h-[24px] bg-[var(--skeleton)] rounded-md"></div>
        </div>

        <div className="flex flex-col sm:flex-row items-center space-y-4 sm:space-y-0 sm:space-x-5 mt-12 w-full justify-center">
            <div className="w-full sm:w-[220px] py-8 bg-[var(--skeleton)] rounded-full"></div>
            <div className="w-full sm:w-[220px] py-8 bg-[var(--skeleton-soft)] rounded-full"></div>
        </div>

        {/* Video / 3D Chessboard Skeleton */}
        <div className="w-full max-w-[1000px] mt-24 mb-24 aspect-[16/10] bg-[var(--skeleton-soft)] rounded-xl"></div>
      </main>
    </div>
  );
}