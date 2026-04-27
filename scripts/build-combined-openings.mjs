import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { Chess } from "chess.js";

const ROOT = process.cwd();
const LICHESS_DIR = path.join(ROOT, "src", "data", "openings");
const ECOJSON_DIR = path.join(ROOT, "src", "data", "openings_ecojson");
const STATS_DIR = path.join(ROOT, "src", "data", "openings_stats");
const OUT_DIR = path.join(ROOT, "src", "data", "openings_combined");

const ECO_FILES = ["ecoA.json", "ecoB.json", "ecoC.json", "ecoD.json", "ecoE.json", "eco_interpolated.json"];
const SCORES_FILE = "scores.json";
const TRANSITIONS_FILE = "fromToPositionIndexed.json";
const STATS_FILE = "openings.csv";

const parseJsonFile = async (filePath) => {
  const raw = await readFile(filePath, "utf8");
  return JSON.parse(raw);
};

const normalizeText = (value) => (typeof value === "string" ? value.trim() : "");
const round2 = (value) => Math.round(value * 100) / 100;
const round3 = (value) => Math.round(value * 1000) / 1000;

const parseNumber = (value) => {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value !== "string") {
    return null;
  }

  const cleaned = value.replace(/,/g, "").trim();
  if (!cleaned) {
    return null;
  }

  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
};

const normalizeOpeningNameKey = (value) => {
  const normalized = normalizeText(value)
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return normalized;
};

const getRootOpeningName = (name) => {
  const colonRoot = normalizeText(name).split(":")[0]?.trim() ?? normalizeText(name);
  const commaRoot = colonRoot.split(",")[0]?.trim() ?? colonRoot;
  return commaRoot || normalizeText(name);
};

const tokenizePgnMoves = (pgn) =>
  normalizeText(pgn)
    .replace(/\{[^}]*\}/g, " ")
    .replace(/\d+\.(\.\.\.)?/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .map((token) => token.trim())
    .filter((token) => token.length > 0 && token !== "1-0" && token !== "0-1" && token !== "1/2-1/2" && token !== "*");

const parseCsvRows = (text) => {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];

    if (char === '"') {
      const nextChar = text[index + 1];
      if (inQuotes && nextChar === '"') {
        field += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      row.push(field);
      field = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && text[index + 1] === "\n") {
        index += 1;
      }

      row.push(field);
      if (row.some((value) => normalizeText(value).length > 0)) {
        rows.push(row);
      }
      row = [];
      field = "";
      continue;
    }

    field += char;
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    if (row.some((value) => normalizeText(value).length > 0)) {
      rows.push(row);
    }
  }

  if (rows.length === 0) {
    return [];
  }

  const headers = rows[0];
  return rows.slice(1).map((values) => {
    const record = {};
    for (let index = 0; index < headers.length; index += 1) {
      const key = normalizeText(headers[index]);
      if (!key) {
        continue;
      }
      record[key] = normalizeText(values[index] ?? "");
    }
    return record;
  });
};

const createStatsAccumulator = () => ({
  games: 0,
  whiteWinWeighted: 0,
  drawWeighted: 0,
  blackWinWeighted: 0,
  avgPlayerWeighted: 0,
  avgPlayerSamples: 0,
  perfRatingWeighted: 0,
  perfRatingSamples: 0,
  lastPlayed: "",
  rowCount: 0,
});

const addStatsSample = (accumulator, sample) => {
  const games = sample.games;
  if (!Number.isFinite(games) || games <= 0) {
    return;
  }

  accumulator.games += games;
  accumulator.whiteWinWeighted += (sample.whiteWinPct ?? 0) * games;
  accumulator.drawWeighted += (sample.drawPct ?? 0) * games;
  accumulator.blackWinWeighted += (sample.blackWinPct ?? 0) * games;

  if (Number.isFinite(sample.avgPlayer)) {
    accumulator.avgPlayerWeighted += sample.avgPlayer * games;
    accumulator.avgPlayerSamples += games;
  }

  if (Number.isFinite(sample.perfRating)) {
    accumulator.perfRatingWeighted += sample.perfRating * games;
    accumulator.perfRatingSamples += games;
  }

  if (sample.lastPlayed && (!accumulator.lastPlayed || sample.lastPlayed > accumulator.lastPlayed)) {
    accumulator.lastPlayed = sample.lastPlayed;
  }

  accumulator.rowCount += 1;
};

const toStatsSummary = (accumulator, sourceId, totalGamesAll) => {
  if (!accumulator || accumulator.games <= 0) {
    return null;
  }

  return {
    source: sourceId,
    sampleSizeGames: Math.round(accumulator.games),
    whiteWinPct: round2(accumulator.whiteWinWeighted / accumulator.games),
    drawPct: round2(accumulator.drawWeighted / accumulator.games),
    blackWinPct: round2(accumulator.blackWinWeighted / accumulator.games),
    avgPlayerRating:
      accumulator.avgPlayerSamples > 0 ? round2(accumulator.avgPlayerWeighted / accumulator.avgPlayerSamples) : null,
    perfRating:
      accumulator.perfRatingSamples > 0 ? round2(accumulator.perfRatingWeighted / accumulator.perfRatingSamples) : null,
    popularitySharePct:
      totalGamesAll > 0 ? round3((accumulator.games / totalGamesAll) * 100) : null,
    lastPlayed: accumulator.lastPlayed || null,
    rowCount: accumulator.rowCount,
  };
};

const parseStatsDataset = async () => {
  const sourceId = "kaggle-all-chess-openings-via-draeangela";
  const byName = new Map();
  const byRoot = new Map();
  const movePopularityByFen = new Map();
  let totalGames = 0;
  let rowCount = 0;

  let csvText = "";
  try {
    csvText = await readFile(path.join(STATS_DIR, STATS_FILE), "utf8");
  } catch (error) {
    if (error && error.code === "ENOENT") {
      return {
        sourceId,
        rowCount,
        totalGames,
        byName,
        byRoot,
        movePopularityByFen,
      };
    }
    throw error;
  }

  const rows = parseCsvRows(csvText);

  for (const row of rows) {
    const openingName = normalizeText(row.Opening);
    const pgnMoves = normalizeText(row.Moves);
    const games = parseNumber(row["Num Games"]);

    if (!openingName || !Number.isFinite(games) || games <= 0) {
      continue;
    }

    const whiteWinPct = parseNumber(row["White_win%"]) ?? parseNumber(row["Player Win %"]);
    const drawPct = parseNumber(row["Draw %"]);
    const blackWinPct = parseNumber(row["Black_win%"]) ?? parseNumber(row["Opponent Win %"]);
    const avgPlayer = parseNumber(row["Avg Player"]);
    const perfRating = parseNumber(row["Perf Rating"]);
    const lastPlayed = normalizeText(row["Last Played"]);

    const sample = {
      games,
      whiteWinPct: Number.isFinite(whiteWinPct) ? whiteWinPct : 0,
      drawPct: Number.isFinite(drawPct) ? drawPct : 0,
      blackWinPct: Number.isFinite(blackWinPct) ? blackWinPct : 0,
      avgPlayer,
      perfRating,
      lastPlayed,
    };

    const fullNameKey = normalizeOpeningNameKey(openingName);
    if (fullNameKey) {
      if (!byName.has(fullNameKey)) {
        byName.set(fullNameKey, createStatsAccumulator());
      }
      addStatsSample(byName.get(fullNameKey), sample);
    }

    const rootNameKey = normalizeOpeningNameKey(getRootOpeningName(openingName));
    if (rootNameKey) {
      if (!byRoot.has(rootNameKey)) {
        byRoot.set(rootNameKey, createStatsAccumulator());
      }
      addStatsSample(byRoot.get(rootNameKey), sample);
    }

    if (pgnMoves) {
      const game = new Chess();
      const tokens = tokenizePgnMoves(pgnMoves);

      for (const token of tokens) {
        const fromFen4 = fenToFen4(game.fen());

        let playedMove = null;
        try {
          playedMove = game.move(token);
        } catch {
          playedMove = null;
        }

        if (!playedMove) {
          break;
        }

        const nextFen4 = fenToFen4(game.fen());

        if (!movePopularityByFen.has(fromFen4)) {
          movePopularityByFen.set(fromFen4, new Map());
        }

        const perPosition = movePopularityByFen.get(fromFen4);
        const existingMove = perPosition.get(playedMove.san);
        if (existingMove) {
          existingMove.games += games;
        } else {
          perPosition.set(playedMove.san, {
            san: playedMove.san,
            games,
            nextFen: nextFen4,
          });
        }
      }
    }

    totalGames += games;
    rowCount += 1;
  }

  return {
    sourceId,
    rowCount,
    totalGames,
    byName,
    byRoot,
    movePopularityByFen,
  };
};

const fenToFen4 = (fen) => {
  const normalized = normalizeText(fen);
  if (!normalized) {
    return "";
  }

  const parts = normalized.split(/\s+/);
  if (parts.length >= 4) {
    return parts.slice(0, 4).join(" ");
  }

  return normalized;
};

const buildKey = (eco, name, pgn) => `${eco}|${name}|${pgn}`;

const toSortedArray = (set) => Array.from(set).sort((a, b) => a.localeCompare(b));

const addToSetMap = (map, key, value) => {
  if (!key || !value) {
    return;
  }

  if (!map.has(key)) {
    map.set(key, new Set());
  }

  map.get(key).add(value);
};

const getOrCreateCombinedEntry = (combinedMap, eco, name, pgn) => {
  const key = buildKey(eco, name, pgn);
  if (combinedMap.has(key)) {
    return combinedMap.get(key);
  }

  const entry = {
    id: key,
    eco,
    name,
    pgn,
    fenCandidatesSet: new Set(),
    sourcesSet: new Set(),
    metadataSets: {
      volumes: new Set(),
      srcTags: new Set(),
      aliases: new Set(),
      rootSources: new Set(),
    },
    isEcoRoot: false,
  };

  combinedMap.set(key, entry);
  return entry;
};

const computePriority = ({ sourceCount, isEcoRoot, scoreSamples, outDegreeMax, totalDegreeMax }) => {
  const sourceScore = sourceCount * 2;
  const rootScore = isEcoRoot ? 5 : 0;
  const scoreCoverage = scoreSamples > 0 ? 1 : 0;
  const graphScore = outDegreeMax * 0.7 + totalDegreeMax * 0.2;
  return round2(sourceScore + rootScore + scoreCoverage + graphScore);
};

const run = async () => {
  await mkdir(OUT_DIR, { recursive: true });

  const lichessRows = await parseJsonFile(path.join(LICHESS_DIR, "openings.all.json"));

  const ecoEntries = [];
  for (const fileName of ECO_FILES) {
    const data = await parseJsonFile(path.join(ECOJSON_DIR, fileName));
    for (const [fen, value] of Object.entries(data)) {
      const aliases = Array.isArray(value.aliases)
        ? value.aliases.map((alias) => normalizeText(alias)).filter(Boolean)
        : [];

      ecoEntries.push({
        source: "ecojson",
        sourceFile: fileName,
        fen,
        eco: normalizeText(value.eco),
        name: normalizeText(value.name),
        pgn: normalizeText(value.moves),
        srcTag: normalizeText(value.src),
        rootSrc: normalizeText(value.rootSrc),
        aliases,
        isEcoRoot: Boolean(value.isEcoRoot),
      });
    }
  }

  let scoresRaw = {};
  try {
    scoresRaw = await parseJsonFile(path.join(ECOJSON_DIR, SCORES_FILE));
  } catch (error) {
    if (error && error.code === "ENOENT") {
      console.warn(`Warning: ${SCORES_FILE} not found. Score enrichment will be skipped.`);
    } else {
      throw error;
    }
  }

  let transitionsRaw = { to: {}, from: {} };
  try {
    transitionsRaw = await parseJsonFile(path.join(ECOJSON_DIR, TRANSITIONS_FILE));
  } catch (error) {
    if (error && error.code === "ENOENT") {
      console.warn(`Warning: ${TRANSITIONS_FILE} not found. Transition enrichment will be skipped.`);
    } else {
      throw error;
    }
  }

  const statsDataset = await parseStatsDataset();

  const scoreByFen = new Map();
  const scoreBucketsByFen4 = new Map();
  for (const [fen, score] of Object.entries(scoresRaw)) {
    if (!Number.isFinite(score)) {
      continue;
    }

    const normalizedFen = normalizeText(fen);
    const fen4 = fenToFen4(normalizedFen);
    scoreByFen.set(normalizedFen, score);
    scoreByFen.set(fen4, score);

    if (!scoreBucketsByFen4.has(fen4)) {
      scoreBucketsByFen4.set(fen4, []);
    }
    scoreBucketsByFen4.get(fen4).push(score);
  }

  const scoreByFen4Mean = new Map();
  for (const [fen4, values] of scoreBucketsByFen4.entries()) {
    const sum = values.reduce((acc, current) => acc + current, 0);
    scoreByFen4Mean.set(fen4, sum / values.length);
  }

  const transitionsTo = transitionsRaw?.to && typeof transitionsRaw.to === "object" ? transitionsRaw.to : {};
  const transitionsFrom = transitionsRaw?.from && typeof transitionsRaw.from === "object" ? transitionsRaw.from : {};

  const graphByFen4 = new Map();
  const fen4Nodes = new Set([...Object.keys(transitionsTo), ...Object.keys(transitionsFrom)].map(fenToFen4));

  for (const fen4 of fen4Nodes) {
    const toList = Array.isArray(transitionsTo[fen4]) ? transitionsTo[fen4] : Array.isArray(transitionsTo[normalizeText(fen4)]) ? transitionsTo[normalizeText(fen4)] : [];
    const fromList = Array.isArray(transitionsFrom[fen4])
      ? transitionsFrom[fen4]
      : Array.isArray(transitionsFrom[normalizeText(fen4)])
        ? transitionsFrom[normalizeText(fen4)]
        : [];

    const outDegree = toList.length;
    const inDegree = fromList.length;
    graphByFen4.set(fen4, {
      inDegree,
      outDegree,
      totalDegree: inDegree + outDegree,
    });
  }

  const combinedMap = new Map();

  for (const row of lichessRows) {
    const eco = normalizeText(row.eco);
    const name = normalizeText(row.name);
    const pgn = normalizeText(row.pgn);
    const existing = getOrCreateCombinedEntry(combinedMap, eco, name, pgn);
    existing.sourcesSet.add("lichess-tsv");

    const volume = normalizeText(row.volume);
    if (volume) {
      existing.metadataSets.volumes.add(volume);
    }
  }

  for (const row of ecoEntries) {
    const existing = getOrCreateCombinedEntry(combinedMap, row.eco, row.name, row.pgn);
    existing.sourcesSet.add("ecojson");

    if (row.fen) {
      existing.fenCandidatesSet.add(row.fen);
    }

    const volume = row.eco ? row.eco.slice(0, 1) : "";
    if (volume) {
      existing.metadataSets.volumes.add(volume);
    }
    if (row.srcTag) {
      existing.metadataSets.srcTags.add(row.srcTag);
    }
    if (row.rootSrc) {
      existing.metadataSets.rootSources.add(row.rootSrc);
    }
    for (const alias of row.aliases) {
      existing.metadataSets.aliases.add(alias);
    }

    existing.isEcoRoot = existing.isEcoRoot || row.isEcoRoot;
  }

  const combinedRows = Array.from(combinedMap.values()).map((entry) => {
    const fenCandidates = toSortedArray(entry.fenCandidatesSet);
    const scoreValues = [];

    let inDegreeMax = 0;
    let outDegreeMax = 0;
    let totalDegreeMax = 0;

    for (const fen of fenCandidates) {
      const normalizedFen = normalizeText(fen);
      const fen4 = fenToFen4(normalizedFen);

      const directScore = scoreByFen.get(normalizedFen);
      const fallbackScore = scoreByFen4Mean.get(fen4);
      const score = Number.isFinite(directScore) ? directScore : fallbackScore;

      if (Number.isFinite(score)) {
        scoreValues.push(score);
      }

      const graph = graphByFen4.get(fen4);
      if (graph) {
        inDegreeMax = Math.max(inDegreeMax, graph.inDegree);
        outDegreeMax = Math.max(outDegreeMax, graph.outDegree);
        totalDegreeMax = Math.max(totalDegreeMax, graph.totalDegree);
      }
    }

    const scoreSamples = scoreValues.length;
    const scoreMean = scoreSamples > 0 ? round2(scoreValues.reduce((acc, current) => acc + current, 0) / scoreSamples) : null;
    const scoreMin = scoreSamples > 0 ? round2(Math.min(...scoreValues)) : null;
    const scoreMax = scoreSamples > 0 ? round2(Math.max(...scoreValues)) : null;

    const fullNameKey = normalizeOpeningNameKey(entry.name);
    const rootNameKey = normalizeOpeningNameKey(getRootOpeningName(entry.name));

    const exactStats = toStatsSummary(
      statsDataset.byName.get(fullNameKey),
      statsDataset.sourceId,
      statsDataset.totalGames
    );
    const rootStats = toStatsSummary(
      statsDataset.byRoot.get(rootNameKey),
      statsDataset.sourceId,
      statsDataset.totalGames
    );

    const stats = exactStats
      ? { ...exactStats, matchType: "exact-name" }
      : rootStats
        ? { ...rootStats, matchType: "root-name" }
        : null;

    const sources = toSortedArray(entry.sourcesSet);

    return {
      id: entry.id,
      eco: entry.eco,
      name: entry.name,
      pgn: entry.pgn,
      fenCandidates,
      sources,
      metadata: {
        volumes: toSortedArray(entry.metadataSets.volumes),
        srcTags: toSortedArray(entry.metadataSets.srcTags),
        aliases: toSortedArray(entry.metadataSets.aliases),
        rootSources: toSortedArray(entry.metadataSets.rootSources),
        isEcoRoot: entry.isEcoRoot,
      },
      rank: {
        scoreMean,
        scoreMin,
        scoreMax,
        scoreSamples,
        inDegreeMax,
        outDegreeMax,
        totalDegreeMax,
        priority: computePriority({
          sourceCount: sources.length,
          isEcoRoot: entry.isEcoRoot,
          scoreSamples,
          outDegreeMax,
          totalDegreeMax,
        }),
      },
      stats,
    };
  }).sort((a, b) => {
    if (a.eco !== b.eco) return a.eco.localeCompare(b.eco);
    if (a.rank.priority !== b.rank.priority) return b.rank.priority - a.rank.priority;
    if (a.name !== b.name) return a.name.localeCompare(b.name);
    return a.pgn.localeCompare(b.pgn);
  });

  const byEcoSets = new Map();
  const byFenSets = new Map();
  const byNamePrefixSets = new Map();

  for (const row of combinedRows) {
    addToSetMap(byEcoSets, row.eco, row.id);

    for (const fen of row.fenCandidates) {
      addToSetMap(byFenSets, fenToFen4(fen), row.id);
    }

    const normalizedName = row.name
      .toLowerCase()
      .replace(/[^a-z0-9 ]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    if (!normalizedName) {
      continue;
    }

    const firstToken = normalizedName.split(" ")[0];
    for (let length = 1; length <= Math.min(4, firstToken.length); length += 1) {
      addToSetMap(byNamePrefixSets, firstToken.slice(0, length), row.id);
    }
  }

  const byEco = Object.fromEntries(
    Array.from(byEcoSets.entries()).sort(([left], [right]) => left.localeCompare(right)).map(([key, values]) => [key, toSortedArray(values)])
  );

  const byFen = Object.fromEntries(
    Array.from(byFenSets.entries()).sort(([left], [right]) => left.localeCompare(right)).map(([key, values]) => [key, toSortedArray(values)])
  );

  const byNamePrefix = Object.fromEntries(
    Array.from(byNamePrefixSets.entries())
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, values]) => [key, toSortedArray(values)])
  );

  const movePopularityIndex = {};
  for (const [fromFen4, moveMap] of statsDataset.movePopularityByFen.entries()) {
    const moves = Array.from(moveMap.values()).sort((left, right) => right.games - left.games);
    if (moves.length === 0) {
      continue;
    }

    const totalGames = moves.reduce((sum, move) => sum + move.games, 0);
    if (totalGames <= 0) {
      continue;
    }

    movePopularityIndex[fromFen4] = {
      source: statsDataset.sourceId,
      totalGames: Math.round(totalGames),
      moves: moves.slice(0, 24).map((move) => ({
        san: move.san,
        nextFen: move.nextFen,
        games: Math.round(move.games),
        pct: round2((move.games / totalGames) * 100),
        openingIds: (byFen[move.nextFen] || []).slice(0, 30),
      })),
    };
  }

  const nextMovesIndex = {};
  for (const [fromFenRaw, nextFensRaw] of Object.entries(transitionsTo)) {
    if (!Array.isArray(nextFensRaw) || nextFensRaw.length === 0) {
      continue;
    }

    const fromFen4 = fenToFen4(fromFenRaw);
    const uniqueNext = new Set(nextFensRaw.map((fen) => fenToFen4(fen)).filter(Boolean));
    const next = Array.from(uniqueNext).slice(0, 40);

    const openingIdsSet = new Set();
    for (const nextFen of next) {
      const candidateIds = byFen[nextFen] || [];
      for (const openingId of candidateIds) {
        openingIdsSet.add(openingId);
        if (openingIdsSet.size >= 80) {
          break;
        }
      }

      if (openingIdsSet.size >= 80) {
        break;
      }
    }

    nextMovesIndex[fromFen4] = {
      next,
      openingIds: Array.from(openingIdsSet),
      edgeCount: nextFensRaw.length,
    };
  }

  const manifest = {
    generatedAt: new Date().toISOString(),
    sources: [
      {
        id: "lichess-tsv",
        path: "src/data/openings/openings.all.json",
        rows: lichessRows.length,
      },
      {
        id: "ecojson",
        path: "src/data/openings_ecojson/eco*.json",
        rows: ecoEntries.length,
      },
      {
        id: "ecojson-scores",
        path: `src/data/openings_ecojson/${SCORES_FILE}`,
        rows: Object.keys(scoresRaw).length,
      },
      {
        id: "ecojson-transitions",
        path: `src/data/openings_ecojson/${TRANSITIONS_FILE}`,
        rows: {
          toNodes: Object.keys(transitionsTo).length,
          fromNodes: Object.keys(transitionsFrom).length,
        },
      },
      {
        id: statsDataset.sourceId,
        path: `src/data/openings_stats/${STATS_FILE}`,
        rows: statsDataset.rowCount,
      },
    ],
    totals: {
      mergedRows: combinedRows.length,
      graphNodes: graphByFen4.size,
      scoreEntries: scoreByFen4Mean.size,
      statsTotalGames: Math.round(statsDataset.totalGames),
      indexByEco: Object.keys(byEco).length,
      indexByFen: Object.keys(byFen).length,
      indexByNamePrefix: Object.keys(byNamePrefix).length,
      indexNextMoves: Object.keys(nextMovesIndex).length,
      indexMovePopularity: Object.keys(movePopularityIndex).length,
    },
  };

  const combinedPath = path.join(OUT_DIR, "openings.catalog.json");
  const manifestPath = path.join(OUT_DIR, "sources.manifest.json");
  const byEcoPath = path.join(OUT_DIR, "openings.index.by-eco.json");
  const byFenPath = path.join(OUT_DIR, "openings.index.by-fen.json");
  const byNamePrefixPath = path.join(OUT_DIR, "openings.index.by-name-prefix.json");
  const nextMovesPath = path.join(OUT_DIR, "openings.index.next-moves.json");
  const movePopularityPath = path.join(OUT_DIR, "openings.index.move-popularity.json");

  await writeFile(combinedPath, `${JSON.stringify(combinedRows, null, 2)}\n`, "utf8");
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  await writeFile(byEcoPath, `${JSON.stringify(byEco, null, 2)}\n`, "utf8");
  await writeFile(byFenPath, `${JSON.stringify(byFen, null, 2)}\n`, "utf8");
  await writeFile(byNamePrefixPath, `${JSON.stringify(byNamePrefix, null, 2)}\n`, "utf8");
  await writeFile(nextMovesPath, `${JSON.stringify(nextMovesIndex, null, 2)}\n`, "utf8");
  await writeFile(movePopularityPath, `${JSON.stringify(movePopularityIndex, null, 2)}\n`, "utf8");

  console.log(`Combined rows: ${combinedRows.length}`);
  console.log(`Index by ECO keys: ${Object.keys(byEco).length}`);
  console.log(`Index by FEN keys: ${Object.keys(byFen).length}`);
  console.log(`Index next-move roots: ${Object.keys(nextMovesIndex).length}`);
  console.log(`Index move-popularity roots: ${Object.keys(movePopularityIndex).length}`);
  console.log(`Saved: ${combinedPath}`);
  console.log(`Saved: ${manifestPath}`);
  console.log(`Saved: ${byEcoPath}`);
  console.log(`Saved: ${byFenPath}`);
  console.log(`Saved: ${byNamePrefixPath}`);
  console.log(`Saved: ${nextMovesPath}`);
  console.log(`Saved: ${movePopularityPath}`);
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
