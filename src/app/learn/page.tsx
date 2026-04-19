"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ChevronDown, ArrowLeft, Sun, Moon } from "lucide-react";
import { useTheme } from "@/lib/theme-context";
import { AuthMenu } from "@/components/auth-menu";
import { loadClientPreferences, saveClientPreferences, type LearnOpeningProgress, type LearnSortMode } from "@/lib/client-preferences";
import openingDescriptions from "@/data/openingDescriptions.json";

type OpeningCard = {
  slug: string;
  name: string;
  eco?: string;
  moves: string;
  description: string;
  variationCount?: number;
};

type OpeningProgressSummary = {
  practicedVariations: number;
  completedVariations: number;
  totalAttempts: number;
  bestAccuracy: number;
  lastPracticedAt: string;
};

const humanizeOpeningSlug = (slug: string) =>
  slug
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

const toOpeningProgressSummary = (progress: LearnOpeningProgress | null): OpeningProgressSummary => {
  if (!progress) {
    return {
      practicedVariations: 0,
      completedVariations: 0,
      totalAttempts: 0,
      bestAccuracy: 0,
      lastPracticedAt: "",
    };
  }

  const variationProgress = Object.values(progress.variations);
  const practicedVariations = variationProgress.filter((entry) => entry.attempts > 0).length;
  const completedVariations = variationProgress.filter((entry) => entry.completions > 0).length;
  const totalAttempts = variationProgress.reduce((sum, entry) => sum + entry.attempts, 0);
  const bestAccuracy = variationProgress.reduce((max, entry) => Math.max(max, entry.bestAccuracy), 0);

  return {
    practicedVariations,
    completedVariations,
    totalAttempts,
    bestAccuracy,
    lastPracticedAt: progress.lastPracticedAt,
  };
};

const formatLastPracticed = (iso: string) => {
  if (!iso) {
    return "";
  }

  const timestamp = Date.parse(iso);
  if (Number.isNaN(timestamp)) {
    return "";
  }

  const diffMs = Date.now() - timestamp;
  if (diffMs < 60_000) {
    return "just now";
  }

  if (diffMs < 3_600_000) {
    return `${Math.max(1, Math.floor(diffMs / 60_000))}m ago`;
  }

  if (diffMs < 86_400_000) {
    return `${Math.floor(diffMs / 3_600_000)}h ago`;
  }

  return `${Math.floor(diffMs / 86_400_000)}d ago`;
};

const normalizeSlug = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const toBaseOpeningName = (name: string) => {
  const colonRoot = name.split(":")[0]?.trim() ?? name;
  const commaRoot = colonRoot.split(",")[0]?.trim() ?? colonRoot;
  return commaRoot.replace(/\s+(variation|line|system|accepted|declined)\b.*$/i, "").trim() || name;
};

const toOpeningCoreKey = (name: string) => {
  const baseName = toBaseOpeningName(name);
  const normalizedBaseName = normalizeSlug(baseName);

  if (normalizedBaseName.startsWith("caro-kann")) return "caro-kann";
  if (normalizedBaseName.startsWith("sicilian")) return "sicilian";
  if (normalizedBaseName.startsWith("french")) return "french";
  if (normalizedBaseName.startsWith("queen-s-gambit")) return "queen-s-gambit";
  if (normalizedBaseName.startsWith("ruy-lopez")) return "ruy-lopez";
  if (normalizedBaseName.startsWith("king-s-indian")) return "king-s-indian";
  if (normalizedBaseName.startsWith("italian")) return "italian";
  if (normalizedBaseName.startsWith("english")) return "english";
  if (normalizedBaseName.startsWith("scandinavian")) return "scandinavian";

  const withoutTrailingLabel = baseName.replace(/\s+(defense|defence|opening|game)\b$/i, "").trim();
  return normalizeSlug(withoutTrailingLabel || baseName);
};

const looksLikeVariationName = (name: string) => /:|,|\bvariation\b|\bline\b|\bsystem\b|\baccepted\b|\bdeclined\b/i.test(name);

const openingSide = (opening: OpeningCard): "white" | "black" => {
  const loweredName = opening.name.toLowerCase();
  if (loweredName.includes("defense") || loweredName.includes("defence") || loweredName.includes("counter")) {
    return "black";
  }
  return "white";
};

const sanitizeDescription = (value: string) =>
  value
    .replace(/\b\d+\.(\.\.)?/g, "")
    .replace(/\b(?:O-O(?:-O)?|[KQRBN]?[a-h]?[1-8]?x?[a-h][1-8](?:=[QRBN])?[+#]?)(?:[!?+#]+)?\b/g, "")
    .replace(/\b[a-h][1-8]\b/g, "")
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([,.;:!?])/g, "$1")
    .trim();

const fallbackOpenings: OpeningCard[] = [
  {
    slug: "italian-game",
    name: "Italian Game",
    moves: "1. e4 e5 2. Nf3 Nc6 3. Bc4",
    description: "A classical opening that develops pieces quickly and controls the center. Perfect for beginners and masters alike."
  },
  {
    slug: "sicilian-defense",
    name: "Sicilian Defense",
    moves: "1. e4 c5",
    description: "The most popular and best-scoring response to White's first move 1.e4. Highly tactical and aggressive."
  },
  {
    slug: "queens-gambit",
    name: "Queen's Gambit",
    moves: "1. d4 d5 2. c4",
    description: "White offers a pawn to gain control of the center. A staple of positional and strategic chess."
  },
  {
    slug: "ruy-lopez",
    name: "Ruy Lopez",
    moves: "1. e4 e5 2. Nf3 Nc6 3. Bb5",
    description: "Named after a Spanish bishop, this opening aims to apply pressure on the knight defending the e5 pawn."
  },
  {
    slug: "french-defense",
    name: "French Defense",
    moves: "1. e4 e6",
    description: "A solid and resilient opening for Black that immediately challenges White's central pawn on e4."
  },
  {
    slug: "caro-kann-defense",
    name: "Caro-Kann Defense",
    moves: "1. e4 c6",
    description: "Known for its extreme solidity, Black prepares to challenge the center with d5 on the next move."
  },
  {
    slug: "kings-indian-defense",
    name: "King's Indian Defense",
    moves: "1. d4 Nf6 2. c4 g6 3. Nc3 Bg7",
    description: "A hypermodern opening where Black allows White to build a pawn center, aiming to attack it later."
  },
  {
    slug: "english-opening",
    name: "English Opening",
    moves: "1. c4",
    description: "A flexible and flank opening where White fights for the center using the c-pawn instead of the d or e pawns."
  },
  {
    slug: "scandinavian-defense",
    name: "Scandinavian Defense",
    moves: "1. e4 d5",
    description: "Directly challenging White's central e4 pawn. It leads to open and complex positions."
  }
];

const fallbackOpeningByCoreKey = new Map(fallbackOpenings.map((opening) => [toOpeningCoreKey(opening.name), opening]));
const openingDescriptionByCoreKey = openingDescriptions as Record<string, string>;

const getOpeningPreferenceScore = (opening: OpeningCard) => {
  const variationPenalty = looksLikeVariationName(opening.name) ? 1000 : 0;
  return variationPenalty + opening.name.length;
};

const normalizeOpeningCards = (openings: OpeningCard[]) => {
  const grouped = new Map<string, OpeningCard>();

  for (const opening of openings) {
    const baseName = toBaseOpeningName(opening.name);
    const groupKey = toOpeningCoreKey(baseName);
    const fallbackOpening = fallbackOpeningByCoreKey.get(groupKey);
    const normalizedCandidate: OpeningCard = {
      ...opening,
      name: fallbackOpening?.name ?? baseName,
      description: sanitizeDescription(
        openingDescriptionByCoreKey[groupKey] ??
          fallbackOpening?.description ??
          "A practical opening with clear development ideas, central control goals, and typical middlegame plans.",
      ),
      moves: fallbackOpening?.moves ?? opening.moves,
    };

    const existing = grouped.get(groupKey);
    if (!existing) {
      grouped.set(groupKey, normalizedCandidate);
      continue;
    }

    const candidateScore = getOpeningPreferenceScore(normalizedCandidate);
    const existingScore = getOpeningPreferenceScore(existing);
    const candidateVariationCount = normalizedCandidate.variationCount ?? 0;
    const existingVariationCount = existing.variationCount ?? 0;

    if (
      candidateScore < existingScore ||
      (candidateScore === existingScore && candidateVariationCount > existingVariationCount)
    ) {
      grouped.set(groupKey, normalizedCandidate);
    }
  }

  return Array.from(grouped.values()).sort((left, right) => left.name.localeCompare(right.name));
};

export default function LearnPage() {
  const { toggleTheme, isDark } = useTheme();
  const [openingCards, setOpeningCards] = useState<OpeningCard[]>(fallbackOpenings);
  const [openingProgressBySlug, setOpeningProgressBySlug] = useState<Record<string, LearnOpeningProgress>>({});
  const [sortMode, setSortMode] = useState<LearnSortMode>("recommended");

  useEffect(() => {
    const loaded = loadClientPreferences();
    setOpeningProgressBySlug(loaded.learn.openingProgressBySlug);
    setSortMode(loaded.learn.learnSortMode);
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadOpenings = async () => {
      try {
        const response = await fetch("/api/openings?limit=200", { method: "GET" });
        if (!response.ok) {
          return;
        }

        const payload = (await response.json()) as { openings?: OpeningCard[] };
        if (!cancelled && Array.isArray(payload.openings) && payload.openings.length > 0) {
          const normalized = normalizeOpeningCards(payload.openings);
          setOpeningCards(normalized.length > 0 ? normalized : fallbackOpenings);
        }
      } catch {
        // Keep fallback cards when API is unavailable.
      }
    };

    loadOpenings().catch(() => {});

    return () => {
      cancelled = true;
    };
  }, []);

  const handleSortModeChange = (nextSortMode: LearnSortMode) => {
    setSortMode(nextSortMode);

    const loaded = loadClientPreferences();
    saveClientPreferences({
      ...loaded,
      learn: {
        ...loaded.learn,
        learnSortMode: nextSortMode,
      },
    });
  };

  const openingsWithProgress = useMemo(
    () =>
      openingCards.map((opening) => ({
        ...opening,
        progress: toOpeningProgressSummary(openingProgressBySlug[opening.slug] ?? null),
      })),
    [openingCards, openingProgressBySlug],
  );

  const continueLearning = useMemo(() => {
    let latest: { slug: string; progress: LearnOpeningProgress } | null = null;

    for (const [slug, progress] of Object.entries(openingProgressBySlug)) {
      if (!progress.lastPracticedAt) {
        continue;
      }

      const current = Date.parse(progress.lastPracticedAt);
      const best = latest ? Date.parse(latest.progress.lastPracticedAt) : Number.NEGATIVE_INFINITY;
      if (!Number.isNaN(current) && current > best) {
        latest = { slug, progress };
      }
    }

    if (!latest) {
      return null;
    }

    const summary = toOpeningProgressSummary(latest.progress);
    const knownOpening = openingCards.find((opening) => opening.slug === latest.slug);

    return {
      slug: latest.slug,
      name: knownOpening?.name ?? humanizeOpeningSlug(latest.slug),
      summary,
      lastPracticedLabel: formatLastPracticed(latest.progress.lastPracticedAt),
    };
  }, [openingCards, openingProgressBySlug]);

  const sortedOpenings = useMemo(() => {
    const openings = [...openingsWithProgress];

    if (sortMode === "recommended") {
      return openings;
    }

    if (sortMode === "recent") {
      return openings.sort((left, right) => {
        const leftTime = left.progress.lastPracticedAt ? Date.parse(left.progress.lastPracticedAt) : 0;
        const rightTime = right.progress.lastPracticedAt ? Date.parse(right.progress.lastPracticedAt) : 0;
        return rightTime - leftTime;
      });
    }

    if (sortMode === "mastery") {
      return openings.sort((left, right) => {
        if (left.progress.bestAccuracy !== right.progress.bestAccuracy) {
          return right.progress.bestAccuracy - left.progress.bestAccuracy;
        }
        return right.progress.completedVariations - left.progress.completedVariations;
      });
    }

    if (sortMode === "popularity") {
      return openings.sort((left, right) => {
        const leftPopularity = left.variationCount ?? 0;
        const rightPopularity = right.variationCount ?? 0;
        if (leftPopularity !== rightPopularity) {
          return rightPopularity - leftPopularity;
        }
        return left.name.localeCompare(right.name);
      });
    }

    if (sortMode === "white" || sortMode === "black") {
      const primary = sortMode;
      return openings.sort((left, right) => {
        const leftRank = openingSide(left) === primary ? 0 : 1;
        const rightRank = openingSide(right) === primary ? 0 : 1;
        if (leftRank !== rightRank) {
          return leftRank - rightRank;
        }
        return left.name.localeCompare(right.name);
      });
    }

    return openings.sort((left, right) => {
      const leftNew = left.progress.totalAttempts === 0 ? 0 : 1;
      const rightNew = right.progress.totalAttempts === 0 ? 0 : 1;
      if (leftNew !== rightNew) {
        return leftNew - rightNew;
      }
      return left.name.localeCompare(right.name);
    });
  }, [openingsWithProgress, sortMode]);

  return (
    <div className="min-h-screen flex flex-col items-center overflow-x-hidden bg-[var(--bg)]">
      {/* Navbar (matching home) */}
      <header className="w-full max-w-[1400px] px-6 py-8 flex items-center justify-between">
        <Link href="/" className="text-[26px] font-serif tracking-normal font-[800] text-[var(--text-primary)] cursor-pointer select-none">
          CHESS
        </Link>

        {/* Navigation Links */}
        <nav className="hidden lg:flex items-center space-x-10 text-[14px] font-medium text-[var(--text-secondary)]">
          <a href="#" className="hover:text-[var(--text-primary)] transition-colors">Puzzles</a>
          <Link href="/learn" className="text-[var(--text-primary)] transition-colors">Learn</Link>
          <Link href="/play/computer" className="hover:text-[var(--text-primary)] transition-colors">Play Bot</Link>
          <a href="#" className="hover:text-[var(--text-primary)] transition-colors">News</a>
          <a href="#" className="hover:text-[var(--text-primary)] transition-colors">Social</a>
          <div className="flex items-center space-x-1 cursor-pointer hover:text-[var(--text-primary)] transition-colors">
            <span>More</span>
            <ChevronDown className="w-4 h-4 ml-[2px]" strokeWidth={2.5} />
          </div>
        </nav>

        {/* Auth Buttons + Theme Toggle */}
        <div className="flex items-center space-x-5 text-[14px] font-medium">
          <button
            onClick={toggleTheme}
            data-theme-toggle
            className="p-2.5 rounded-full bg-[var(--surface-alt)] border border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:border-[var(--border-hover)] transition-all duration-300 shadow-sm"
            title={isDark ? "Switch to light mode" : "Switch to dark mode"}
          >
            {isDark ? <Sun className="w-[18px] h-[18px]" /> : <Moon className="w-[18px] h-[18px]" />}
          </button>
          <AuthMenu />
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 w-full max-w-[1200px] px-6 py-12 mb-20 md:py-20">
        <div className="mb-12 md:mb-16">
          <Link href="/" className="inline-flex items-center text-[var(--text-dimmed)] hover:text-[var(--text-primary)] transition-colors mb-6 text-[14px] font-medium group">
            <ArrowLeft className="w-4 h-4 mr-2 transform group-hover:-translate-x-1 transition-transform" />
            Back to Home
          </Link>
          <h1 className="text-[44px] md:text-[64px] font-serif text-[var(--text-primary)] font-[500] leading-[1.1] tracking-[-0.02em]">
            Master the Openings
          </h1>
          <p className="mt-6 text-[var(--text-muted)] text-xl font-medium max-w-2xl leading-relaxed">
            Explore the most popular chess openings used by Grandmasters. Learn the core moves, understand the tactical ideas, and improve your early game strategy.
          </p>
        </div>

        {continueLearning ? (
          <div className="mb-10 rounded-2xl border border-[var(--border)] bg-[var(--surface-alt)] p-6 shadow-[var(--shadow-card)]">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="text-[11px] uppercase tracking-[0.18em] font-bold text-[var(--text-dimmed)]">Continue Learning</div>
                <h2 className="mt-1 text-[28px] md:text-[34px] font-serif text-[var(--text-primary)] leading-tight">
                  {continueLearning.name}
                </h2>
                <div className="mt-3 flex flex-wrap gap-2 text-[12px]">
                  <span className="inline-flex items-center rounded-full border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1 font-semibold text-[var(--text-secondary)]">
                    {continueLearning.summary.completedVariations} completed
                  </span>
                  <span className="inline-flex items-center rounded-full border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1 font-semibold text-[var(--text-secondary)]">
                    Best {continueLearning.summary.bestAccuracy}%
                  </span>
                  <span className="inline-flex items-center rounded-full border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1 font-semibold text-[var(--text-secondary)]">
                    Last {continueLearning.lastPracticedLabel || "recently"}
                  </span>
                </div>
              </div>
              <Link
                href={`/learn/${continueLearning.slug}`}
                className="inline-flex items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--surface)] px-5 py-3 text-[14px] font-bold text-[var(--text-primary)] hover:bg-[var(--surface-hover)] transition-colors"
              >
                Resume Opening
              </Link>
            </div>
          </div>
        ) : null}

        <div className="mb-8 grid gap-3 md:grid-cols-[1fr_auto] md:items-center">
          <div className="inline-flex h-10 items-center text-[13px] font-semibold uppercase tracking-[0.12em] text-[var(--text-dimmed)]">Opening Library</div>
          <div className="grid h-10 w-full grid-cols-[auto_1fr] items-center gap-2 md:w-auto md:grid-cols-[auto_220px]">
            <span className="text-[12px] font-semibold text-[var(--text-secondary)]">Sort</span>
            <select
              value={sortMode}
              onChange={(event) => handleSortModeChange(event.target.value as LearnSortMode)}
              className="h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 text-[12px] font-medium text-[var(--text-primary)] outline-none hover:border-[var(--border-hover)]"
            >
              <option value="recommended">Recommended</option>
              <option value="recent">Recently Practiced</option>
              <option value="mastery">Highest Mastery</option>
              <option value="popularity">Most Popular</option>
              <option value="new">New First</option>
              <option value="white">White Openings First</option>
              <option value="black">Black Openings First</option>
            </select>
          </div>
        </div>

        {/* Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
          {sortedOpenings.map((opening, idx) => (
            <div 
              key={idx} 
              className="relative bg-gradient-to-b from-[var(--card-from)] to-[var(--card-to)] border border-[var(--border)] hover:border-[var(--border-hover)] rounded-2xl p-8 hover:bg-[var(--surface-hover)] transition-all cursor-pointer group shadow-lg hover:shadow-2xl hover:-translate-y-1 duration-300"
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-[26px] font-serif text-[var(--text-primary)] font-[500]">{opening.name}</h2>
                <span className={`text-[10px] font-bold uppercase tracking-[0.16em] px-2 py-1 rounded-full border ${opening.progress.completedVariations > 0 ? "text-[var(--text-primary)] border-[var(--border-hover)] bg-[var(--surface-alt)]" : "text-[var(--text-muted)] border-[var(--border)] bg-[var(--surface)]"}`}>
                  {opening.progress.completedVariations > 0 ? `${opening.progress.bestAccuracy}%` : "new"}
                </span>
              </div>
              <div className="bg-[var(--badge-bg)] ring-1 ring-[var(--badge-ring)] rounded-lg py-2.5 px-4 mb-5 font-mono text-[14px] font-bold text-[var(--text-primary)] inline-block shadow-inner">
                {opening.moves}
              </div>
              <p className="text-[var(--text-muted)] text-[15px] leading-relaxed font-medium">
                {opening.description}
              </p>
              <p className="mt-4 text-[12px] text-[var(--text-dimmed)] font-medium">
                {opening.progress.totalAttempts > 0
                  ? `${opening.progress.practicedVariations} practiced • ${opening.progress.completedVariations} completed • last ${formatLastPracticed(opening.progress.lastPracticedAt) || "recently"}`
                  : "No training progress yet"}
              </p>
              <div className="mt-8 flex items-center text-[14px] font-bold text-[var(--text-primary)] opacity-0 group-hover:opacity-100 transition-all transform translate-y-2 group-hover:translate-y-0">
                Study Opening <span className="ml-2 bg-[var(--cta-bg)] text-[var(--cta-text)] px-2 py-1 rounded-md text-xs">&rarr;</span>
              </div>
              <Link href={`/learn/${opening.slug}`} className="absolute inset-0 z-10">
                <span className="sr-only">Study {opening.name}</span>
              </Link>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
