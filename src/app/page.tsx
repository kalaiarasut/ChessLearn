"use client";

import { useRef, useState } from "react";
import { ChevronDown, Bot, Sun, Moon, Menu, X, Puzzle } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { useTheme } from "@/lib/theme-context";
import { AuthMenu } from "@/components/auth-menu";
import { motion, useScroll, useTransform } from "framer-motion";

export default function Home() {
  const { theme, toggleTheme, isDark } = useTheme();

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);

  // Set up the scroll progress over a 250vh tall container
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"]
  });

  // Hero section animations (fade out as we scroll down)
  const heroOpacity = useTransform(scrollYProgress, [0, 0.2], [1, 0]);
  const heroY = useTransform(scrollYProgress, [0, 0.2], [0, -50]);
  const heroPointerEvents = useTransform(scrollYProgress, [0, 0.1], ["auto", "none"]);

  // Chessboard wrapper animations
  // It starts with no extra translation/scale, then moves down-left and shrinks
  const boardX = useTransform(scrollYProgress, [0, 0.5], ["0%", "-30%"]);
  const boardY = useTransform(scrollYProgress, [0, 0.5], ["0%", "30%"]);
  const boardScale = useTransform(scrollYProgress, [0, 0.5], [1, 0.65]);

  // Feature text animations (fade in on the right as chessboard moves left)
  const textOpacity = useTransform(scrollYProgress, [0.2, 0.5], [0, 1]);
  const textX = useTransform(scrollYProgress, [0.2, 0.5], [50, 0]);
  const textPointerEvents = useTransform(scrollYProgress, [0.4, 0.5], ["none", "auto"]);

  return (
    <div className="min-h-screen flex flex-col items-center overflow-x-hidden bg-[var(--bg)]">
      {/* Navbar (Fixed so it stays on top) */}
      <header className="fixed top-0 z-50 w-full max-w-[1400px] px-6 py-6 max-[1024px]:px-4 max-[480px]:py-4 flex items-center justify-between bg-[var(--bg)]/80 backdrop-blur-md border-b border-transparent transition-colors duration-300" style={{ borderColor: 'var(--border)' }}>
        {/* Logo */}
        <Link href="/" className="text-[26px] font-serif tracking-normal font-[800] text-[var(--text-primary)] cursor-pointer select-none">
          CHESS
        </Link>

        {/* Navigation Links */}
        <nav className="hidden lg:flex items-center space-x-10 text-[14px] font-medium text-[var(--text-secondary)]">
          <Link href="/puzzles" className="hover:text-[var(--text-primary)] transition-colors">Puzzles</Link>
          <Link href="/learn" className="hover:text-[var(--text-primary)] transition-colors">Learn</Link>
          <Link href="/play/computer" className="hover:text-[var(--text-primary)] transition-colors">Play Bot</Link>
          <Link href="/whats-new" className="hover:text-[var(--text-primary)] transition-colors">What&apos;s New</Link>
          <a href="#" className="hover:text-[var(--text-primary)] transition-colors">Social</a>
          <div className="flex items-center space-x-1 cursor-pointer hover:text-[var(--text-primary)] transition-colors">
            <span>More</span>
            <ChevronDown className="w-4 h-4 ml-[2px]" strokeWidth={2.5} />
          </div>
        </nav>

        {/* Auth Buttons + Theme Toggle */}
        <div className="flex items-center space-x-5 text-[14px] font-medium max-[1024px]:space-x-3">
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

      {/* Mobile Menu Overlay */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-40 bg-[var(--bg)] pt-24 px-6 flex flex-col hidden max-[1024px]:flex overflow-y-auto">
          <nav className="flex flex-col space-y-6 text-xl font-medium text-[var(--text-primary)]">
            <Link href="/puzzles" onClick={() => setIsMobileMenuOpen(false)}>Puzzles</Link>
            <Link href="/learn" onClick={() => setIsMobileMenuOpen(false)}>Learn</Link>
            <Link href="/play/computer" onClick={() => setIsMobileMenuOpen(false)}>Play Bot</Link>
            <Link href="/whats-new" onClick={() => setIsMobileMenuOpen(false)}>What&apos;s New</Link>
            <a href="#" onClick={() => setIsMobileMenuOpen(false)}>Social</a>
          </nav>
          <div className="mt-auto pb-10 pt-6 flex items-center space-x-6">
            <AuthMenu />
          </div>
        </div>
      )}

      {/* Scroll Animation Container */}
      <div ref={containerRef} className="w-full h-[250vh] max-[1024px]:h-[200vh] max-[480px]:h-[150vh] relative pt-24 max-[1024px]:pt-20">

        {/* Sticky section that holds the content on screen while scrolling */}
        {/* Removed overflow-hidden to prevent clipping of the chessboard during transition */}
        <div className="sticky top-24 max-[1024px]:top-20 h-[calc(100vh-6rem)] max-[1024px]:h-[calc(100vh-5rem)] w-full flex flex-col items-center">

          <main className="relative flex-1 flex flex-col items-center text-center w-full px-4 mt-6 md:mt-16 max-[1024px]:mt-8">

            {/* Main Hero Content (fades out) */}
            <motion.div
              style={{ opacity: heroOpacity, y: heroY, pointerEvents: heroPointerEvents as any }}
              className="relative z-20 flex flex-col items-center text-center w-full"
            >
              <h1 className="text-[52px] md:text-[80px] max-[1024px]:text-[60px] max-[480px]:text-[42px] max-[1024px]:leading-[1.1] font-serif text-[var(--text-primary)] font-[500] leading-[1.05] max-w-4xl mx-auto tracking-normal lg:tracking-[-0.02em] max-[1024px]:px-2">
                Play Chess Online<br />on the #1 Site!
              </h1>

              <div className="flex flex-col sm:flex-row items-center justify-center space-y-2 sm:space-y-0 sm:space-x-6 mt-8 max-[480px]:mt-6 max-[480px]:space-y-3 max-[480px]:space-x-0 text-[var(--text-muted)] text-[16px] max-[480px]:text-[14px] font-medium">
                <div><span className="text-[var(--text-primary)] font-[600]">18,123,165+</span> Games Today</div>
                <div><span className="text-[var(--text-primary)] font-[600]">301,512</span> Playing Now</div>
              </div>

              <div className="flex flex-col sm:flex-row items-center space-y-4 sm:space-y-0 sm:space-x-5 mt-12 max-[1024px]:mt-10 max-[480px]:mt-8 max-[480px]:space-y-4 max-[480px]:space-x-0 w-full max-w-md sm:max-w-none justify-center">
                <Link href="/puzzles" className="w-full sm:w-auto flex items-center justify-center px-10 py-5 max-[480px]:px-6 max-[480px]:py-4 bg-[var(--cta-bg)] text-[var(--cta-text)] rounded-full font-bold text-xl max-[480px]:text-lg hover:bg-[var(--cta-hover)] transition-colors shadow-[0_0_40px_rgba(0,0,0,0.1)]">
                  <Puzzle className="w-6 h-6 mr-3" />
                  Solve Puzzles
                </Link>

                <Link href="/play/computer" className="w-full sm:w-auto flex items-center justify-center px-10 py-5 max-[480px]:px-6 max-[480px]:py-4 bg-[var(--surface-alt)] border border-[var(--border)] text-[var(--text-secondary)] rounded-full font-bold text-xl max-[480px]:text-lg hover:bg-[var(--surface-hover)] transition-colors shadow-lg">
                  <Bot className="w-6 h-6 mr-3 text-[var(--text-muted)]" />
                  Play Bots
                </Link>
              </div>
            </motion.div>

            {/* Wrapper for vertical movement (keeps text and board perfectly aligned) */}
            <motion.div style={{ y: boardY }} className="relative w-full flex items-center justify-center max-[1024px]:flex-col">
              
              {/* Desktop Hero Chessboard image */}
              <motion.div
                style={{ x: boardX, scale: boardScale }}
                className="z-10 w-full flex justify-center origin-center max-[1024px]:hidden"
              >
                <div
                  className="z-0 w-full max-w-[1200px] mt-8 md:-mt-5 relative mb-24 aspect-[16/10] flex items-center justify-center translate-x-0 md:translate-x-[16%] lg:translate-x-[26%] md:scale-[1.2] lg:scale-[1.3]"
                  style={{
                    maskImage: "linear-gradient(to bottom, black 50%, transparent 100%)",
                    WebkitMaskImage: "linear-gradient(to bottom, black 50%, transparent 100%)",
                    backgroundColor: "var(--bg)",
                  }}
                >
                  <Image
                    src="/images/hero/chessboard.png"
                    alt="3D chessboard with black and white pieces"
                    fill
                    priority
                    sizes="(max-width: 768px) 100vw, 1000px"
                    className={`object-cover z-0 grayscale transition-opacity duration-500 ease-in-out ${isDark ? "opacity-100" : "opacity-0"}`}
                    style={{
                      mixBlendMode: "lighten",
                      maskImage: "radial-gradient(130% 95% at 52% 52%, black 68%, transparent 100%)",
                      WebkitMaskImage: "radial-gradient(130% 95% at 52% 52%, black 68%, transparent 100%)",
                    }}
                  />
                  <Image
                    src="/images/hero/chesslight.png"
                    alt=""
                    aria-hidden
                    fill
                    priority
                    sizes="(max-width: 768px) 100vw, 1000px"
                    className={`object-cover z-0 transition-opacity duration-500 ease-in-out ${isDark ? "opacity-0" : "opacity-100"}`}
                    style={{
                      mixBlendMode: "darken",
                      opacity: isDark ? 0 : 1,
                      maskImage: "radial-gradient(130% 95% at 52% 52%, black 68%, transparent 100%)",
                      WebkitMaskImage: "radial-gradient(130% 95% at 52% 52%, black 68%, transparent 100%)",
                    }}
                  />
                </div>
              </motion.div>

              {/* Mobile Hero Chessboard image (stays centered) */}
              <motion.div
                style={{ scale: boardScale }}
                className="z-10 w-full justify-center origin-center hidden max-[1024px]:flex"
              >
                <div
                  className="z-0 w-full max-w-[1200px] mt-4 max-[480px]:mt-0 relative aspect-[16/10] flex items-center justify-center max-[1024px]:!translate-x-0 max-[1024px]:!scale-100 max-[480px]:!scale-110"
                  style={{
                    maskImage: "linear-gradient(to bottom, black 50%, transparent 100%)",
                    WebkitMaskImage: "linear-gradient(to bottom, black 50%, transparent 100%)",
                    backgroundColor: "var(--bg)",
                  }}
                >
                  <Image
                    src="/images/hero/chessboard.png"
                    alt="3D chessboard with black and white pieces"
                    fill
                    priority
                    sizes="(max-width: 1024px) 100vw, 1000px"
                    className={`object-cover z-0 grayscale transition-opacity duration-500 ease-in-out ${isDark ? "opacity-100" : "opacity-0"}`}
                    style={{
                      mixBlendMode: "lighten",
                      maskImage: "radial-gradient(130% 95% at 52% 52%, black 68%, transparent 100%)",
                      WebkitMaskImage: "radial-gradient(130% 95% at 52% 52%, black 68%, transparent 100%)",
                    }}
                  />
                  <Image
                    src="/images/hero/chesslight.png"
                    alt=""
                    aria-hidden
                    fill
                    priority
                    sizes="(max-width: 1024px) 100vw, 1000px"
                    className={`object-cover z-0 transition-opacity duration-500 ease-in-out ${isDark ? "opacity-0" : "opacity-100"}`}
                    style={{
                      mixBlendMode: "darken",
                      opacity: isDark ? 0 : 1,
                      maskImage: "radial-gradient(130% 95% at 52% 52%, black 68%, transparent 100%)",
                      WebkitMaskImage: "radial-gradient(130% 95% at 52% 52%, black 68%, transparent 100%)",
                    }}
                  />
                </div>
              </motion.div>

              {/* Feature Text (fades in perfectly aligned to the right of the board on desktop, bottom on mobile) */}
              <motion.div
                style={{ opacity: textOpacity, x: textX, pointerEvents: textPointerEvents as any }}
                className="absolute right-[2%] lg:right-[8%] top-[25%] -translate-y-1/2 max-w-[380px] text-left z-30 px-6 max-[1024px]:relative max-[1024px]:right-auto max-[1024px]:left-auto max-[1024px]:top-[auto] max-[1024px]:translate-y-0 max-[1024px]:max-w-xl max-[1024px]:text-center max-[1024px]:mt-12 max-[480px]:mt-6 max-[1024px]:!transform-none"
              >
                <h2 className="text-[40px] md:text-[52px] max-[480px]:text-[32px] font-serif font-bold text-[var(--text-primary)] leading-[1.1] mb-6 max-[480px]:mb-4">
                  Learn like<br className="hidden max-[1024px]:block" /><span className="max-[1024px]:hidden"> </span>never before.
                </h2>
                <p className="text-[var(--text-secondary)] text-lg max-[480px]:text-base leading-relaxed max-[1024px]:mx-auto">
                  Master the game with interactive puzzles and challenge our custom AI bots designed to elevate your play from beginner to advanced.
                </p>
              </motion.div>

            </motion.div>

          </main>
        </div>
      </div>

    </div>
  );
}
