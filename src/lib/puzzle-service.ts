export type PuzzleEntry = {
  id: string;
  fen: string;
  moves: string[];
  rating: number;
  themes: string[];
  popularity: number;
};

type D1ResponseRow = {
  id: string;
  fen: string;
  moves: string;
  rating: number;
  themes: string;
  popularity: number;
};

type PuzzleQueryOptions = {
  count?: number;
  theme?: string | null;
  minRating?: number;
  maxRating?: number;
  mode?: string | null;
  random?: boolean;
  id?: string | null;
  excludeId?: string | null;
};

const DB_ID_FALLBACK = "e6b0defb-7070-4138-9448-a2e82ee477a5";
const PUZZLE_SELECT = "SELECT puzzles.id, puzzles.fen, puzzles.moves, puzzles.rating, puzzles.themes, puzzles.popularity FROM puzzles";

let themeFtsAvailablePromise: Promise<boolean> | null = null;

function getCredentials() {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const dbId = process.env.CLOUDFLARE_DATABASE_ID || DB_ID_FALLBACK;
  const token = process.env.CLOUDFLARE_API_TOKEN;

  if (!accountId || !token) {
    throw new Error("Cloudflare D1 credentials missing. Set CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN.");
  }

  return { accountId, dbId, token };
}

function hashSeed(value: string) {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  }
  return hash;
}

async function queryD1<T>(sql: string, params: unknown[] = []) {
  const { accountId, dbId, token } = getCredentials();

  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/d1/database/${dbId}/query`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ sql, params }),
      cache: "no-store",
    }
  );

  const data = await response.json();

  if (!data.success || !data.result?.[0]?.results) {
    console.error("D1 API Error:", data.errors);
    throw new Error("D1 query failed");
  }

  return data.result[0].results as T[];
}

async function hasThemeFtsIndex() {
  if (!themeFtsAvailablePromise) {
    themeFtsAvailablePromise = (async () => {
      try {
        const rows = await queryD1<{ name: string }>(
          "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'puzzle_theme_fts' LIMIT 1"
        );
        return rows.length > 0;
      } catch {
        return false;
      }
    })();
  }

  return themeFtsAvailablePromise;
}

function formatPuzzles(rows: D1ResponseRow[]): PuzzleEntry[] {
  return rows.map((row) => ({
    ...row,
    moves: row.moves.split(" "),
    themes: row.themes.trim().split(" "),
  }));
}

async function buildFilter(options: PuzzleQueryOptions) {
  const params: unknown[] = [];
  const clauses: string[] = [];
  let fromClause = " FROM puzzles";

  const minRating = options.minRating ?? 0;
  const maxRating = options.maxRating ?? 9999;
  clauses.push("puzzles.rating >= ?");
  params.push(minRating);
  clauses.push("puzzles.rating <= ?");
  params.push(maxRating);

  if (options.excludeId) {
    clauses.push("puzzles.id != ?");
    params.push(options.excludeId);
  }

  const theme = options.theme;
  if (theme && theme !== "mix") {
    if (await hasThemeFtsIndex()) {
      fromClause += " INNER JOIN puzzle_theme_fts ON puzzle_theme_fts.id = puzzles.id";
      clauses.push("puzzle_theme_fts MATCH ?");
      params.push(`themes:${theme}`);
    } else {
      clauses.push("(' ' || puzzles.themes || ' ') LIKE ?");
      params.push(`% ${theme} %`);
    }
  }

  return {
    fromClause,
    whereClause: clauses.join(" AND "),
    params,
  };
}

export async function getPuzzles(options: PuzzleQueryOptions = {}) {
  if (options.id) {
    const results = await queryD1<D1ResponseRow>(`${PUZZLE_SELECT} WHERE puzzles.id = ? LIMIT 1`, [options.id]);
    return formatPuzzles(results);
  }

  const count = Math.min(50, Math.max(1, options.count ?? 10));
  const { fromClause, whereClause, params } = await buildFilter(options);

  if (options.mode === "daily" || options.random) {
    const maxRowRows = await queryD1<{ maxRowId: number }>(
      `SELECT MAX(puzzles.rowid) AS maxRowId${fromClause} WHERE ${whereClause}`,
      params
    );
    const maxRowId = maxRowRows[0]?.maxRowId ?? 0;

    if (!maxRowId) {
      return [];
    }

    const seed =
      options.mode === "daily"
        ? hashSeed(new Date().toISOString().slice(0, 10))
        : Math.floor(Math.random() * maxRowId);
    const startRowId = (seed % maxRowId) + 1;

    const forwardResults = await queryD1<D1ResponseRow>(
      `${PUZZLE_SELECT}${fromClause} WHERE ${whereClause} AND puzzles.rowid >= ? ORDER BY puzzles.rowid LIMIT ?`,
      [...params, startRowId, count]
    );

    if (forwardResults.length >= count) {
      return formatPuzzles(forwardResults);
    }

    const wrapResults = await queryD1<D1ResponseRow>(
      `${PUZZLE_SELECT}${fromClause} WHERE ${whereClause} AND puzzles.rowid < ? ORDER BY puzzles.rowid LIMIT ?`,
      [...params, startRowId, count - forwardResults.length]
    );

    return formatPuzzles([...forwardResults, ...wrapResults]);
  }

  const results = await queryD1<D1ResponseRow>(
    `${PUZZLE_SELECT}${fromClause} WHERE ${whereClause} ORDER BY puzzles.popularity DESC LIMIT ?`,
    [...params, count]
  );

  return formatPuzzles(results);
}

export async function getDailyPuzzle() {
  const puzzles = await getPuzzles({ mode: "daily", count: 1 });
  return puzzles[0] ?? null;
}
