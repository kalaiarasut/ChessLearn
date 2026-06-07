import { Chess, type Square } from "chess.js";

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
  excludeIds?: string[];
};

const DEFAULT_D1_DATABASE_ID = "e6b0defb-7070-4138-9448-a2e82ee477a5";
const PUZZLE_SELECT =
  "SELECT puzzles.id, puzzles.fen, puzzles.moves, puzzles.rating, puzzles.themes, puzzles.popularity";
const PUZZLE_ROW_COUNT = 5_882_680;
const D1_FETCH_TIMEOUT_MS = 5_000;
const D1_RETRY_ATTEMPTS = 1;

function getCredentials() {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const dbId = process.env.CLOUDFLARE_DATABASE_ID || DEFAULT_D1_DATABASE_ID;
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

function parseMoveList(moves: string) {
  return moves.trim().split(/\s+/).filter(Boolean);
}

function parseThemeList(themes: string) {
  return themes.trim().split(/\s+/).filter(Boolean);
}

function playUciMove(game: Chess, uci: string) {
  if (!/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(uci)) {
    return null;
  }

  return game.move({
    from: uci.slice(0, 2) as Square,
    to: uci.slice(2, 4) as Square,
    promotion: (uci[4] as "q" | "r" | "b" | "n") || undefined,
  });
}

function canPlayLine(game: Chess, moves: string[], startIndex: number) {
  if (startIndex >= moves.length) {
    return false;
  }

  const testGame = new Chess(game.fen());
  for (let index = startIndex; index < moves.length; index += 1) {
    if (testGame.isGameOver()) {
      return false;
    }

    if (!playUciMove(testGame, moves[index])) {
      return false;
    }
  }

  return true;
}

function isPlayablePuzzleRow(row: D1ResponseRow, moves: string[]) {
  if (moves.length === 0) {
    return false;
  }

  try {
    const directGame = new Chess(row.fen);
    const directLineIsPlayable = !directGame.isGameOver() && canPlayLine(directGame, moves, 0);

    if (moves.length > 1) {
      const setupGame = new Chess(row.fen);
      const setupMove = playUciMove(setupGame, moves[0]);
      const setupLineIsPlayable =
        Boolean(setupMove) && !setupGame.isGameOver() && canPlayLine(setupGame, moves, 1);

      if (setupLineIsPlayable) {
        return true;
      }
    }

    return directLineIsPlayable;
  } catch {
    return false;
  }
}

async function queryD1<T>(sql: string, params: unknown[] = []) {
  const { accountId, dbId, token } = getCredentials();
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= D1_RETRY_ATTEMPTS; attempt += 1) {
    try {
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
          signal: AbortSignal.timeout(D1_FETCH_TIMEOUT_MS),
        }
      );

      const responseText = await response.text();
      let data: {
        success?: boolean;
        errors?: unknown;
        result?: Array<{ results?: T[] }>;
      };

      try {
        data = JSON.parse(responseText);
      } catch {
        throw new Error(`D1 query returned a non-JSON response (status ${response.status}).`);
      }

      if (!data.success || !data.result?.[0]?.results) {
        const serializedErrors =
          data.errors && Array.isArray(data.errors) && data.errors.length > 0
            ? JSON.stringify(data.errors)
            : responseText;

        console.error("D1 API Error:", serializedErrors);
        throw new Error(`D1 query failed (status ${response.status}): ${serializedErrors}`);
      }

      return data.result[0].results as T[];
    } catch (error) {
      lastError = error instanceof Error ? error : new Error("D1 query failed");
      const message = lastError.message.toLowerCase();
      const isTimeout =
        message.includes("timeout") ||
        message.includes("fetch failed") ||
        message.includes("aborted");

      if (!isTimeout || attempt === D1_RETRY_ATTEMPTS) {
        throw lastError;
      }
    }
  }

  throw lastError ?? new Error("D1 query failed");
}

function formatPuzzles(rows: D1ResponseRow[]): PuzzleEntry[] {
  return rows.flatMap((row) => {
    const moves = parseMoveList(row.moves);
    if (!isPlayablePuzzleRow(row, moves)) {
      return [];
    }

    return [
      {
        ...row,
        moves,
        themes: parseThemeList(row.themes),
      },
    ];
  });
}

async function buildFilter(options: PuzzleQueryOptions) {
  const params: unknown[] = [];
  const clauses: string[] = [];
  const fromClause = " FROM puzzles";

  const minRating = options.minRating;
  const maxRating = options.maxRating;
  if (typeof minRating === "number" && minRating > 0) {
    clauses.push("puzzles.rating >= ?");
    params.push(minRating);
  }
  if (typeof maxRating === "number" && maxRating < 9999) {
    clauses.push("puzzles.rating <= ?");
    params.push(maxRating);
  }

  if (options.excludeId) {
    clauses.push("puzzles.id != ?");
    params.push(options.excludeId);
  }

  const excludeIds = Array.from(new Set(options.excludeIds ?? [])).filter(Boolean);
  if (excludeIds.length > 0) {
    clauses.push(`puzzles.id NOT IN (${excludeIds.map(() => "?").join(", ")})`);
    params.push(...excludeIds);
  }

  const theme = options.theme;
  if (theme && theme !== "mix") {
    clauses.push("(' ' || puzzles.themes || ' ') LIKE ?");
    params.push(`% ${theme} %`);
  }

  return {
    fromClause,
    whereClause: clauses.length > 0 ? clauses.join(" AND ") : "1 = 1",
    params,
  };
}

export async function getPuzzles(options: PuzzleQueryOptions = {}) {
  if (options.id) {
    const results = await queryD1<D1ResponseRow>(
      `${PUZZLE_SELECT} FROM puzzles WHERE puzzles.id = ? LIMIT 1`,
      [options.id]
    );
    return formatPuzzles(results);
  }

  const count = Math.min(50, Math.max(1, options.count ?? 10));
  const fetchLimit = Math.min(200, Math.max(count * 4, count));
  const { fromClause, whereClause, params } = await buildFilter(options);

  if (options.mode === "daily" || options.random) {
    const seed =
      options.mode === "daily"
        ? hashSeed(new Date().toISOString().slice(0, 10))
        : Math.floor(Math.random() * PUZZLE_ROW_COUNT);
    const startRowId = (seed % PUZZLE_ROW_COUNT) + 1;

    const forwardResults = await queryD1<D1ResponseRow>(
      `${PUZZLE_SELECT}${fromClause} WHERE ${whereClause} AND puzzles.rowid >= ? ORDER BY puzzles.rowid LIMIT ?`,
      [...params, startRowId, fetchLimit]
    );
    const forwardPuzzles = formatPuzzles(forwardResults);

    if (forwardPuzzles.length >= count) {
      return forwardPuzzles.slice(0, count);
    }

    const wrapResults = await queryD1<D1ResponseRow>(
      `${PUZZLE_SELECT}${fromClause} WHERE ${whereClause} AND puzzles.rowid < ? ORDER BY puzzles.rowid LIMIT ?`,
      [...params, startRowId, fetchLimit]
    );

    return [...forwardPuzzles, ...formatPuzzles(wrapResults)].slice(0, count);
  }

  const results = await queryD1<D1ResponseRow>(
    `${PUZZLE_SELECT}${fromClause} WHERE ${whereClause} ORDER BY puzzles.popularity DESC LIMIT ?`,
    [...params, fetchLimit]
  );

  return formatPuzzles(results).slice(0, count);
}

export async function getDailyPuzzle() {
  const puzzles = await getPuzzles({ mode: "daily", count: 1 });
  return puzzles[0] ?? null;
}
