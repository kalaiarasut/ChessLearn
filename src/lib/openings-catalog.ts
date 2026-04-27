import { readFile } from "node:fs/promises";
import path from "node:path";
import { Chess } from "chess.js";

export type OpeningStats = {
  source: string;
  sampleSizeGames: number;
  whiteWinPct: number;
  drawPct: number;
  blackWinPct: number;
  avgPlayerRating: number | null;
  perfRating: number | null;
  popularitySharePct: number | null;
  lastPlayed: string | null;
  rowCount: number;
  matchType?: "exact-name" | "root-name";
};

export type MovePopularityMove = {
  san: string;
  nextFen: string;
  games: number;
  pct: number;
  openingIds: string[];
};

export type MovePopularityPosition = {
  source: string;
  totalGames: number;
  moves: MovePopularityMove[];
};

export type OpeningCatalogRow = {
  id: string;
  eco: string;
  name: string;
  pgn: string;
  fenCandidates: string[];
  sources: string[];
  metadata: {
    volumes: string[];
    srcTags: string[];
    aliases: string[];
    rootSources: string[];
    isEcoRoot: boolean;
  };
  rank: {
    scoreMean: number | null;
    scoreMin: number | null;
    scoreMax: number | null;
    scoreSamples: number;
    inDegreeMax: number;
    outDegreeMax: number;
    totalDegreeMax: number;
    priority: number;
  };
  stats: OpeningStats | null;
};

export type OpeningCard = {
  slug: string;
  name: string;
  eco: string;
  moves: string;
  description: string;
  variationCount: number;
  popularity: OpeningStats | null;
};

export type OpeningDetail = {
  slug: string;
  name: string;
  eco: string;
  openingStats: OpeningStats | null;
  mainLine: {
    id: string;
    pgn: string;
    priority: number;
    sources: string[];
    stats: OpeningStats | null;
  };
  mainLineMovePopularity: Array<{
    ply: number;
    fen: string;
    playedSan: string;
    playedPct: number | null;
    totalGames: number | null;
    topMoves: Array<{
      san: string;
      pct: number;
      games: number;
    }>;
  }>;
  variationCount: number;
  variations: Array<{
    id: string;
    eco: string;
    name: string;
    pgn: string;
    priority: number;
    sources: string[];
    triggerMoveSan: string | null;
    triggerMoveGlobalPopularity: {
      san: string;
      pct: number;
      games: number;
      totalGames: number;
    } | null;
    linePopularity: {
      sampleSizeGames: number;
      sharePct: number;
    } | null;
    stats: OpeningStats | null;
  }>;
};

type OpeningCatalogCache = {
  rows: OpeningCatalogRow[];
  bySlug: Map<string, OpeningCatalogRow[]>;
  rootNameBySlug: Map<string, string>;
  movePopularityByFen: Record<string, MovePopularityPosition>;
};

const CATALOG_PATH = path.join(process.cwd(), "src", "data", "openings_combined", "openings.catalog.json");
const MOVE_POPULARITY_INDEX_PATH = path.join(
  process.cwd(),
  "src",
  "data",
  "openings_combined",
  "openings.index.move-popularity.json"
);

let cache: OpeningCatalogCache | null = null;

const round2 = (value: number) => Math.round(value * 100) / 100;

const normalize = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

export const slugifyOpeningName = (name: string) => normalize(name);

const getRootOpeningName = (name: string) => {
  const colonRoot = name.split(":")[0]?.trim() ?? name;
  const commaRoot = colonRoot.split(",")[0]?.trim() ?? colonRoot;
  return commaRoot || name;
};

const normalizeSan = (san: string) => san.replace(/[+#?!]+/g, "").trim();

const fenToFen4 = (fen: string) => {
  const normalized = fen.trim();
  if (!normalized) {
    return "";
  }

  const parts = normalized.split(/\s+/);
  if (parts.length >= 4) {
    return parts.slice(0, 4).join(" ");
  }

  return normalized;
};

const tokenizePgnMoves = (pgn: string) =>
  pgn
    .replace(/\{[^}]*\}/g, " ")
    .replace(/\d+\.(\.\.\.)?/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .map((token) => token.trim())
    .filter((token) => token.length > 0 && token !== "1-0" && token !== "0-1" && token !== "1/2-1/2" && token !== "*");

const extractSanHistory = (pgn: string) => {
  const game = new Chess();
  const tokens = tokenizePgnMoves(pgn);
  const sanHistory: string[] = [];

  for (const token of tokens) {
    let move;
    try {
      move = game.move(token);
    } catch {
      break;
    }

    if (!move) {
      break;
    }

    sanHistory.push(move.san);
  }

  return sanHistory;
};

const isSanPrefixMatch = (left: string[], right: string[]) =>
  left.every((move, index) => normalizeSan(move) === normalizeSan(right[index] ?? ""));

const summarizeDescription = (row: OpeningCatalogRow, variationCount: number) => {
  const eco = row.eco || "N/A";
  const sourceCount = row.sources.length;
  const evalText = row.rank.scoreMean === null ? "no eval sample" : `mean eval ${row.rank.scoreMean > 0 ? "+" : ""}${row.rank.scoreMean}`;
  const gamesText = row.stats?.sampleSizeGames
    ? `${row.stats.sampleSizeGames.toLocaleString()} tracked games`
    : "no popularity sample";
  return `ECO ${eco}. ${variationCount} mapped lines, ${sourceCount} source${sourceCount === 1 ? "" : "s"}, ${evalText}, ${gamesText}.`;
};

const aggregateOpeningStats = (stats: Array<OpeningStats | null>): OpeningStats | null => {
  let totalGames = 0;
  let whiteWeighted = 0;
  let drawWeighted = 0;
  let blackWeighted = 0;
  let avgPlayerWeighted = 0;
  let avgPlayerSamples = 0;
  let perfWeighted = 0;
  let perfSamples = 0;
  let lastPlayed = "";
  let rowCount = 0;
  const source = stats.find((entry) => Boolean(entry?.source))?.source ?? "unknown";

  for (const entry of stats) {
    if (!entry || !Number.isFinite(entry.sampleSizeGames) || entry.sampleSizeGames <= 0) {
      continue;
    }

    const games = entry.sampleSizeGames;
    totalGames += games;
    whiteWeighted += entry.whiteWinPct * games;
    drawWeighted += entry.drawPct * games;
    blackWeighted += entry.blackWinPct * games;

    if (Number.isFinite(entry.avgPlayerRating)) {
      avgPlayerWeighted += (entry.avgPlayerRating ?? 0) * games;
      avgPlayerSamples += games;
    }

    if (Number.isFinite(entry.perfRating)) {
      perfWeighted += (entry.perfRating ?? 0) * games;
      perfSamples += games;
    }

    if (entry.lastPlayed && (!lastPlayed || entry.lastPlayed > lastPlayed)) {
      lastPlayed = entry.lastPlayed;
    }

    rowCount += entry.rowCount;
  }

  if (totalGames <= 0) {
    return null;
  }

  return {
    source,
    sampleSizeGames: Math.round(totalGames),
    whiteWinPct: round2(whiteWeighted / totalGames),
    drawPct: round2(drawWeighted / totalGames),
    blackWinPct: round2(blackWeighted / totalGames),
    avgPlayerRating: avgPlayerSamples > 0 ? round2(avgPlayerWeighted / avgPlayerSamples) : null,
    perfRating: perfSamples > 0 ? round2(perfWeighted / perfSamples) : null,
    popularitySharePct: null,
    lastPlayed: lastPlayed || null,
    rowCount,
  };
};

const buildMainLineMovePopularity = (
  pgn: string,
  movePopularityByFen: Record<string, MovePopularityPosition>
) => {
  const game = new Chess();
  const tokens = tokenizePgnMoves(pgn);
  const result: OpeningDetail["mainLineMovePopularity"] = [];

  for (let index = 0; index < tokens.length; index += 1) {
    const fromFen4 = fenToFen4(game.fen());
    const positionEntry = movePopularityByFen[fromFen4];

    let playedMove;
    try {
      playedMove = game.move(tokens[index]);
    } catch {
      break;
    }

    if (!playedMove) {
      break;
    }

    const playedSan = playedMove.san;
    const matchedMove = positionEntry?.moves.find(
      (move) => normalizeSan(move.san) === normalizeSan(playedSan)
    );

    result.push({
      ply: index + 1,
      fen: fromFen4,
      playedSan,
      playedPct: matchedMove?.pct ?? null,
      totalGames: positionEntry?.totalGames ?? null,
      topMoves: (positionEntry?.moves ?? []).slice(0, 3).map((move) => ({
        san: move.san,
        pct: move.pct,
        games: move.games,
      })),
    });

    if (result.length >= 24) {
      break;
    }
  }

  return result;
};

const byPriorityThenName = (left: OpeningCatalogRow, right: OpeningCatalogRow) => {
  if (left.rank.priority !== right.rank.priority) {
    return right.rank.priority - left.rank.priority;
  }
  if (left.rank.scoreSamples !== right.rank.scoreSamples) {
    return right.rank.scoreSamples - left.rank.scoreSamples;
  }
  return left.name.localeCompare(right.name);
};

const loadCatalog = async (): Promise<OpeningCatalogCache> => {
  if (cache) {
    return cache;
  }

  const raw = await readFile(CATALOG_PATH, "utf8");
  const rows = JSON.parse(raw) as OpeningCatalogRow[];

  let movePopularityByFen: Record<string, MovePopularityPosition> = {};
  try {
    const movePopularityRaw = await readFile(MOVE_POPULARITY_INDEX_PATH, "utf8");
    movePopularityByFen = JSON.parse(movePopularityRaw) as Record<string, MovePopularityPosition>;
  } catch {
    movePopularityByFen = {};
  }

  const bySlug = new Map<string, OpeningCatalogRow[]>();
  const rootNameBySlug = new Map<string, string>();
  for (const row of rows) {
    const rootName = getRootOpeningName(row.name);
    const slug = slugifyOpeningName(rootName);
    if (!bySlug.has(slug)) {
      bySlug.set(slug, []);
      rootNameBySlug.set(slug, rootName);
    }
    bySlug.get(slug)?.push(row);
  }

  for (const values of bySlug.values()) {
    values.sort(byPriorityThenName);
  }

  cache = { rows, bySlug, rootNameBySlug, movePopularityByFen };
  return cache;
};

export const getOpeningCards = async (limit = 80): Promise<OpeningCard[]> => {
  const catalog = await loadCatalog();

  const cards: OpeningCard[] = [];
  for (const [slug, rows] of catalog.bySlug.entries()) {
    const rootName = catalog.rootNameBySlug.get(slug) ?? rows[0].name;
    const rootLine = rows.find((row) => row.name === rootName) ?? rows[0];
    const fallbackAggregatedStats = aggregateOpeningStats(
      rows.map((row) => (row.stats?.matchType === "exact-name" ? row.stats : null))
    );
    const popularity = rootLine.stats ?? fallbackAggregatedStats;

    cards.push({
      slug,
      name: rootName,
      eco: rootLine.eco,
      moves: rootLine.pgn,
      description: summarizeDescription(rootLine, rows.length),
      variationCount: rows.length,
      popularity,
    });
  }

  cards.sort((left, right) => {
    const leftGames = left.popularity?.sampleSizeGames ?? 0;
    const rightGames = right.popularity?.sampleSizeGames ?? 0;
    if (leftGames !== rightGames) {
      return rightGames - leftGames;
    }
    if (left.variationCount !== right.variationCount) {
      return right.variationCount - left.variationCount;
    }
    return left.name.localeCompare(right.name);
  });

  return cards.slice(0, Math.max(1, limit));
};

export const getOpeningBySlug = async (slug: string): Promise<OpeningDetail | null> => {
  const normalizedSlug = normalize(slug);
  if (!normalizedSlug) {
    return null;
  }

  const catalog = await loadCatalog();
  const rows = catalog.bySlug.get(normalizedSlug);
  if (!rows || rows.length === 0) {
    return null;
  }

  const rootName = catalog.rootNameBySlug.get(normalizedSlug) ?? rows[0].name;
  const best = rows.find((row) => row.name === rootName) ?? rows[0];
  const openingStats = best.stats ?? aggregateOpeningStats(rows.map((row) => row.stats));
  const mainLineSan = extractSanHistory(best.pgn);

  const branchPositionGame = new Chess();
  for (const san of mainLineSan) {
    let move;
    try {
      move = branchPositionGame.move(san);
    } catch {
      break;
    }

    if (!move) {
      break;
    }
  }

  const branchPositionEntry = catalog.movePopularityByFen[fenToFen4(branchPositionGame.fen())];
  const detailRows = rows.slice(0, 30);
  const variationDetails = detailRows.map((row) => {
    const rowSanHistory = extractSanHistory(row.pgn);
    const isBranchVariation =
      row.id !== best.id &&
      isSanPrefixMatch(mainLineSan, rowSanHistory) &&
      rowSanHistory.length > mainLineSan.length;

    const triggerMoveSan = isBranchVariation ? rowSanHistory[mainLineSan.length] ?? null : null;
    const triggerMoveMatch = triggerMoveSan
      ? branchPositionEntry?.moves.find((move) => normalizeSan(move.san) === normalizeSan(triggerMoveSan))
      : null;

    return {
      row,
      isBranchVariation,
      triggerMoveSan,
      triggerMoveGlobalPopularity: triggerMoveMatch
        ? {
          san: triggerMoveMatch.san,
          pct: triggerMoveMatch.pct,
          games: triggerMoveMatch.games,
          totalGames: branchPositionEntry?.totalGames ?? triggerMoveMatch.games,
        }
        : null,
    };
  });

  const branchTotalSampleGames = variationDetails.reduce((sum, detail) => {
    if (!detail.isBranchVariation) {
      return sum;
    }

    const games = detail.row.stats?.sampleSizeGames ?? 0;
    return games > 0 ? sum + games : sum;
  }, 0);

  const mainLineMovePopularity = buildMainLineMovePopularity(best.pgn, catalog.movePopularityByFen);

  return {
    slug: normalizedSlug,
    name: rootName,
    eco: best.eco,
    openingStats,
    mainLine: {
      id: best.id,
      pgn: best.pgn,
      priority: best.rank.priority,
      sources: best.sources,
      stats: best.stats,
    },
    mainLineMovePopularity,
    variationCount: rows.length,
    variations: variationDetails.map((detail) => {
      const lineGames = detail.row.stats?.sampleSizeGames ?? 0;
      const linePopularity =
        detail.isBranchVariation && lineGames > 0 && branchTotalSampleGames > 0
          ? {
            sampleSizeGames: lineGames,
            sharePct: round2((lineGames / branchTotalSampleGames) * 100),
          }
          : null;

      return {
        id: detail.row.id,
        eco: detail.row.eco,
        name: detail.row.name,
        pgn: detail.row.pgn,
        priority: detail.row.rank.priority,
        sources: detail.row.sources,
        triggerMoveSan: detail.triggerMoveSan,
        triggerMoveGlobalPopularity: detail.triggerMoveGlobalPopularity,
        linePopularity,
        stats: detail.row.stats,
      };
    }),
  };
};
