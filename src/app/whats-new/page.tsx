"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { ChevronDown, Sun, Moon, Menu, X, Sparkles, Zap, Shield, Bug, Rocket } from "lucide-react";
import { useTheme } from "@/lib/theme-context";
import { AuthMenu } from "@/components/auth-menu";

const PixelBlast = dynamic(() => import("@/components/PixelBlast"), { ssr: false });

const CHANGELOG_ENTRIES = [
  {
    version: "2026.04.30",
    date: "April 30, 2026",
    tag: "Latest",
    tagColor: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    icon: Rocket,
    iconColor: "text-emerald-400",
    title: "Mobile, Settings, And Build Polish",
    description: "The latest commits focused on smaller-screen layouts, unified settings UI, skeleton loading, and a TypeScript build fix.",
    items: [
      { type: "improvement", text: "Optimized the home page and auth menu for smaller screens" },
      { type: "improvement", text: "Tuned Learn and opening-page navbars, loading states, and skeleton screens" },
      { type: "improvement", text: "Unified settings layout across Learn, Play Bot, Puzzles, and shared settings components" },
      { type: "fix", text: "Fixed settings scrolling and a TypeScript build error in the bot page" },
    ],
  },
  {
    version: "2026.04.29",
    date: "April 29, 2026",
    tag: "Stable",
    tagColor: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    icon: Zap,
    iconColor: "text-blue-400",
    title: "Puzzle Progress And Daily Puzzle Pipeline",
    description: "Puzzle work moved toward server-backed progress, faster puzzle delivery, and clearer signed-in sync states.",
    items: [
      { type: "feature", text: "Added puzzle login overlays and frontend sync progress states" },
      { type: "feature", text: "Added puzzle progress API routes for attempts, reviews, import, and progress reads" },
      { type: "improvement", text: "Optimized the puzzle data pipeline and server-rendered the daily puzzle" },
      { type: "improvement", text: "Added right-click board arrows and victory confetti to puzzle solving" },
    ],
  },
  {
    version: "2026.04.28",
    date: "April 28, 2026",
    tag: "Stable",
    tagColor: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    icon: Shield,
    iconColor: "text-violet-400",
    title: "Bot Engine Reliability",
    description: "Play Bot changes targeted Stockfish loading, engine selection, reset behavior, and cleaner opening playback.",
    items: [
      { type: "feature", text: "Added engine download progress and first-visit Stockfish variant auto-selection" },
      { type: "improvement", text: "Improved bot timing, reset behavior, board orientation handling, and engine readiness" },
      { type: "fix", text: "Made the eval bar color dynamic and stopped unnecessary duplicate Stockfish instances" },
      { type: "fix", text: "Removed the next-on-page dependency conflict" },
    ],
  },
  {
    version: "2026.04.27",
    date: "April 27, 2026",
    tag: "Stable",
    tagColor: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    icon: Sparkles,
    iconColor: "text-amber-400",
    title: "Puzzles And Opening Catalog Expansion",
    description: "This set introduced the puzzle surfaces and connected bot/opening work to catalog-backed data.",
    items: [
      { type: "feature", text: "Added the puzzle page, puzzle solve page, and dashboard sections for strengths and improvement areas" },
      { type: "feature", text: "Added puzzle API/data build scripts and started Lichess puzzle database integration" },
      { type: "feature", text: "Added popularity stats to opening pages" },
      { type: "improvement", text: "Connected bot openings to the shared opening catalog API" },
    ],
  },
  {
    version: "2026.04.20-26",
    date: "April 20-26, 2026",
    tag: "Major",
    tagColor: "bg-rose-500/10 text-rose-400 border-rose-500/20",
    icon: Bug,
    iconColor: "text-rose-400",
    title: "Catalog, Transitions, And Full Stockfish",
    description: "Home-page transition work landed alongside opening catalog wiring and full Stockfish accessibility fixes.",
    items: [
      { type: "feature", text: "Moved openings to the combined catalog data source" },
      { type: "feature", text: "Unleashed the full Stockfish path for stronger bot play" },
      { type: "improvement", text: "Added and refined home-page image/video transition work" },
      { type: "fix", text: "Made the full Stockfish version accessible and fixed the engine CORS route" },
    ],
  },
  {
    version: "2026.04.14-19",
    date: "April 14-19, 2026",
    tag: "Launch",
    tagColor: "bg-rose-500/10 text-rose-400 border-rose-500/20",
    icon: Bug,
    iconColor: "text-rose-400",
    title: "Initial Frontend, Learning, And Settings",
    description: "The project started with the main frontend, board assets, learning pages, bot play, auth, settings, and opening search.",
    items: [
      { type: "feature", text: "Created the initial frontend with home, Learn, opening detail pages, board themes, piece sets, and sounds" },
      { type: "feature", text: "Added light mode, login/signup/auth plumbing, preferences, settings, and the account auth menu" },
      { type: "feature", text: "Added Play Bot with Stockfish scoring and analysis" },
      { type: "feature", text: "Implemented learning-page variations, variation completion tracking, and opening-page search" },
    ],
  },
];


export default function WhatsNewPage() {
  const { toggleTheme, isDark } = useTheme();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [spacerHeight, setSpacerHeight] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const lastCardRef = useRef<HTMLElement>(null);

  // Calculate exact spacer height so page ends when the last card is fully stacked
  useEffect(() => {
    const calculate = () => {
      if (!containerRef.current || !lastCardRef.current) return;
      const lastCard = lastCardRef.current;
      const lastIndex = CHANGELOG_ENTRIES.length - 1;
      const stickyTop = 120 + lastIndex * 32;

      // Temporarily unstick to get true natural absolute Y position
      const oldPosition = lastCard.style.position;
      const oldTop = lastCard.style.top;
      lastCard.style.position = "static";
      lastCard.style.top = "auto";

      const naturalCardAbsoluteTop = window.scrollY + lastCard.getBoundingClientRect().top;

      // Restore styles
      lastCard.style.position = oldPosition;
      lastCard.style.top = oldTop;

      // Target scroll position where the last card hits its sticky top
      const targetScrollY = naturalCardAbsoluteTop - stickyTop;

      // The total document height needed to allow scrolling exactly to targetScrollY
      const targetDocumentHeight = targetScrollY + window.innerHeight;

      setSpacerHeight(currentSpacer => {
        // Calculate the document height without the current artificial spacer
        const docHeightWithoutSpacer = document.documentElement.scrollHeight - currentSpacer;

        // The new spacer is exactly what's needed to pad the document to the target height
        const newSpacer = targetDocumentHeight - docHeightWithoutSpacer;

        // Return exactly the required spacer (can be negative to truncate document height via negative margin)
        return newSpacer;
      });
    };

    calculate();
    window.addEventListener("resize", calculate);

    const observer = new ResizeObserver(calculate);
    if (containerRef.current) observer.observe(containerRef.current);

    return () => {
      window.removeEventListener("resize", calculate);
      observer.disconnect();
    };
  }, []);

  return (
    <div className="min-h-screen flex flex-col items-center overflow-x-clip bg-[var(--bg)]">
      {/* Navbar */}
      <header className="w-full max-w-[1400px] px-6 py-8 max-[1024px]:py-5 max-[480px]:px-4 flex items-center justify-between z-50 relative">
        <Link href="/" className="text-[26px] max-[480px]:text-[22px] font-serif tracking-normal font-[800] text-[var(--text-primary)] cursor-pointer select-none">
          CHESS
        </Link>

        <nav className="hidden lg:flex items-center space-x-10 text-[14px] font-medium text-[var(--text-secondary)]">
          <Link href="/puzzles" className="hover:text-[var(--text-primary)] transition-colors">Puzzles</Link>
          <Link href="/learn" className="hover:text-[var(--text-primary)] transition-colors">Learn</Link>
          <Link href="/play/computer" className="hover:text-[var(--text-primary)] transition-colors">Play Bot</Link>
          <Link href="/whats-new" className="text-[var(--text-primary)] transition-colors">What&apos;s New</Link>
          <Link href="/leaderboard" className="hover:text-[var(--text-primary)] transition-colors">Leaderboard</Link>
          <div className="flex items-center space-x-1 cursor-pointer hover:text-[var(--text-primary)] transition-colors">
            <span>More</span>
            <ChevronDown className="w-4 h-4 ml-[2px]" strokeWidth={2.5} />
          </div>
        </nav>

        <div className="flex items-center space-x-5 text-[14px] font-medium">
          <button
            onClick={toggleTheme}
            data-theme-toggle
            className="p-2.5 rounded-full bg-[var(--surface-alt)] border border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:border-[var(--border-hover)] transition-all duration-300 shadow-sm"
            title={isDark ? "Switch to light mode" : "Switch to dark mode"}
          >
            {isDark ? <Sun className="w-[18px] h-[18px]" /> : <Moon className="w-[18px] h-[18px]" />}
          </button>
          <div className="flex items-center space-x-5 max-[1024px]:hidden">
            <AuthMenu />
          </div>
          <button
            className="hidden max-[1024px]:flex p-2.5 rounded-full bg-[var(--surface-alt)] border border-[var(--border)] text-[var(--text-primary)] hover:border-[var(--border-hover)] transition-all duration-300"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          >
            {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </header>

      {/* Mobile Menu */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-40 bg-[var(--bg)] pt-24 px-6 flex flex-col hidden max-[1024px]:flex overflow-y-auto">
          <nav className="flex flex-col space-y-6 text-xl font-medium text-[var(--text-primary)]">
            <Link href="/puzzles" onClick={() => setIsMobileMenuOpen(false)}>Puzzles</Link>
            <Link href="/learn" onClick={() => setIsMobileMenuOpen(false)}>Learn</Link>
            <Link href="/play/computer" onClick={() => setIsMobileMenuOpen(false)}>Play Bot</Link>
            <Link href="/whats-new" onClick={() => setIsMobileMenuOpen(false)}>What&apos;s New</Link>
            <Link href="/leaderboard" className="hover:text-[var(--text-primary)] transition-colors">Leaderboard</Link>
          </nav>
          <div className="mt-auto pb-10 pt-6 flex items-center space-x-6">
            <AuthMenu />
          </div>
        </div>
      )}

      {/* Hero Section with PixelBlast Background */}
      <section className="relative w-full overflow-hidden">
        {/* PixelBlast Background */}
        <div className="absolute inset-0 z-0" style={{ height: "100%" }}>
          <PixelBlast
            className=""
            style={{}}
            variant="circle"
            pixelSize={6}
            color={isDark ? "#ffffff" : "#000000"}
            patternScale={3}
            patternDensity={1.2}
            pixelSizeJitter={0.5}
            enableRipples
            rippleSpeed={0.4}
            rippleThickness={0.12}
            rippleIntensityScale={1.5}
            liquid
            liquidStrength={0.12}
            liquidRadius={1.2}
            liquidWobbleSpeed={5}
            speed={0.6}
            edgeFade={0}
            transparent
          />
        </div>

        {/* Hero Content */}
        <div className="relative z-10 flex flex-col items-center text-center px-6 pt-8 pb-10 max-[480px]:pt-6 max-[480px]:pb-8">
          <span className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full border border-[var(--border)] bg-[var(--surface-alt)]/80 backdrop-blur-sm text-[12px] font-bold uppercase tracking-[0.16em] text-[var(--text-secondary)] mb-6">
            What&apos;s New
          </span>

          <h1 className="text-[44px] md:text-[64px] max-[480px]:text-[32px] font-serif text-[var(--text-primary)] font-[500] leading-[1.08] tracking-[-0.02em] max-w-3xl">
            What&apos;s New - ChessLearn{" "}
            <span className="font-[700]">Changelog</span>
          </h1>

          <p className="mt-4 max-[480px]:mt-3 text-[var(--text-primary)] text-lg max-[480px]:text-base font-medium max-w-2xl leading-relaxed">
            See what&apos;s new at ChessLearn.<br />
            Factual updates from the project&apos;s git history, newest first.
          </p>
        </div>
      </section>

      {/* Changelog Entries */}
      <main
        className="w-full max-w-[1200px] px-6 mt-16 pb-8 max-[480px]:px-4 max-[480px]:mt-10 mx-auto"
        style={{ overflowY: 'clip' }}
      >
        <div className="relative pl-[240px] max-[640px]:pl-[80px]">
          <div ref={containerRef} className="flex flex-col gap-12 max-[640px]:gap-8">
            {CHANGELOG_ENTRIES.map((entry, index) => {
              const features = entry.items.filter(item => item.type === "feature" || item.type === "improvement");
              const bugfixes = entry.items.filter(item => item.type === "fix");
              const isLast = index === CHANGELOG_ENTRIES.length - 1;

              return (
                <article
                  key={entry.version}
                  ref={isLast ? lastCardRef : undefined}
                  className="relative sticky"
                  style={{ top: `calc(120px + ${index * 32}px)`, zIndex: index + 1 }}
                >
                  {/* Timeline Area Backdrop to hide the previous card's line */}
                  <div className="absolute left-[-300px] w-[200px] max-[640px]:left-[-100px] max-[640px]:w-[80px] top-[38px] h-[2000px] bg-[var(--bg)] -z-20 pointer-events-none" />

                  {/* Vertical Line Segment */}
                  {!isLast && (
                    <div className="absolute left-[-224px] max-[640px]:left-[-68px] top-[38px] h-[2000px] w-px border-l border-dashed border-[var(--border-hover)] -z-10" />
                  )}

                  {/* Timeline Dot */}
                  <div className="absolute left-[-236px] max-[640px]:left-[-80px] top-[34px] flex items-center justify-center w-6 h-6 bg-[var(--bg)] z-10">
                    <div className="w-[12px] h-[12px] rounded-full border-[2.5px] border-[var(--text-primary)] bg-transparent" />
                  </div>

                  {/* Date Desktop */}
                  <div className="absolute left-[-190px] top-[34px] hidden sm:block w-[110px] bg-[var(--bg)] py-1 pl-2 z-10">
                    <span className="text-[15px] text-[var(--text-primary)] font-bold whitespace-nowrap">
                      {entry.date}
                    </span>
                  </div>

                  {/* Card */}
                  <div className="w-full relative z-0 rounded-[24px] border border-[var(--border)] bg-[var(--surface)] p-8 max-[480px]:p-6 shadow-[var(--shadow-card)]">
                    {/* Backdrop to cover previous cards without expanding natural height */}
                    <div className="absolute inset-x-[-1px] top-10 h-[3000px] bg-[var(--surface)] -z-10 border-x border-[var(--border)] pointer-events-none" />

                    {/* Date Mobile */}
                    <div className="sm:hidden mb-4">
                      <span className="text-[15px] text-[var(--text-primary)] font-bold">
                        {entry.date}
                      </span>
                    </div>

                    <div className="mb-6">
                      <h3 className="text-[24px] font-sans font-bold text-[var(--text-primary)] mb-2">
                        {entry.title}
                      </h3>
                      <p className="text-[15px] text-[var(--text-secondary)] leading-relaxed">
                        {entry.description}
                      </p>
                    </div>

                    <div className="h-px w-full bg-gradient-to-r from-[var(--border)] to-transparent mb-8" />

                    <div className="flex flex-col gap-8">
                      {features.length > 0 && (
                        <div>
                          <h3 className="text-[16px] font-bold text-[var(--text-primary)] mb-4">Improvements &amp; Changes</h3>
                          <ul className="space-y-3">
                            {features.map((item, i) => (
                              <li key={i} className="flex items-start gap-4">
                                <div className="w-[5px] h-[5px] rounded-full border border-[var(--text-secondary)] mt-[9px] flex-shrink-0" />
                                <span className="text-[15px] text-[var(--text-primary)] leading-relaxed">{item.text}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {bugfixes.length > 0 && (
                        <div>
                          <h3 className="text-[16px] font-bold text-[var(--text-primary)] mb-4">Bugfixes</h3>
                          <ul className="space-y-3">
                            {bugfixes.map((item, i) => (
                              <li key={i} className="flex items-start gap-4">
                                <div className="w-[5px] h-[5px] rounded-full border border-[var(--text-secondary)] mt-[9px] flex-shrink-0" />
                                <span className="text-[15px] text-[var(--text-primary)] leading-relaxed">{item.text}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}

            {/* Dynamic spacer MUST be inside the flex container to expand it and prevent sticky elements from being pushed up prematurely */}
            <div aria-hidden="true" style={{
              height: spacerHeight > 0 ? `${spacerHeight}px` : 0,
              marginBottom: spacerHeight < 0 ? `${spacerHeight}px` : 0
            }} />
          </div>
        </div>
      </main>
    </div>
  );
}
