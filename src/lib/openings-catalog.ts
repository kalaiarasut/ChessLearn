import { readFile } from "node:fs/promises";
import path from "node:path";

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
};

export type OpeningCard = {
  slug: string;
  name: string;
  eco: string;
  moves: string;
  description: string;
  variationCount: number;
};

export type OpeningDetail = {
  slug: string;
  name: string;
  eco: string;
  mainLine: {
    id: string;
    pgn: string;
    priority: number;
    sources: string[];
  };
  variationCount: number;
  variations: Array<{
    id: string;
    eco: string;
    name: string;
    pgn: string;
    priority: number;
    sources: string[];
  }>;
};

type OpeningCatalogCache = {
  rows: OpeningCatalogRow[];
  bySlug: Map<string, OpeningCatalogRow[]>;
  rootNameBySlug: Map<string, string>;
};

const CATALOG_PATH = path.join(process.cwd(), "src", "data", "openings_combined", "openings.catalog.json");

let cache: OpeningCatalogCache | null = null;

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

const summarizeDescription = (row: OpeningCatalogRow, variationCount: number) => {
  const eco = row.eco || "N/A";
  const sourceCount = row.sources.length;
  const evalText = row.rank.scoreMean === null ? "no eval sample" : `mean eval ${row.rank.scoreMean > 0 ? "+" : ""}${row.rank.scoreMean}`;
  return `ECO ${eco}. ${variationCount} mapped lines, ${sourceCount} source${sourceCount === 1 ? "" : "s"}, ${evalText}.`;
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

  cache = { rows, bySlug, rootNameBySlug };
  return cache;
};

export const getOpeningCards = async (limit = 80): Promise<OpeningCard[]> => {
  const catalog = await loadCatalog();

  const cards: OpeningCard[] = [];
  for (const [slug, rows] of catalog.bySlug.entries()) {
    const rootName = catalog.rootNameBySlug.get(slug) ?? rows[0].name;
    const rootLine = rows.find((row) => row.name === rootName) ?? rows[0];
    cards.push({
      slug,
      name: rootName,
      eco: rootLine.eco,
      moves: rootLine.pgn,
      description: summarizeDescription(rootLine, rows.length),
      variationCount: rows.length,
    });
  }

  cards.sort((left, right) => {
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

  return {
    slug: normalizedSlug,
    name: rootName,
    eco: best.eco,
    mainLine: {
      id: best.id,
      pgn: best.pgn,
      priority: best.rank.priority,
      sources: best.sources,
    },
    variationCount: rows.length,
    variations: rows.slice(0, 30).map((row) => ({
      id: row.id,
      eco: row.eco,
      name: row.name,
      pgn: row.pgn,
      priority: row.rank.priority,
      sources: row.sources,
    })),
  };
};
