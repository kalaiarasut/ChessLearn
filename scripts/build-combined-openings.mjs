import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const LICHESS_DIR = path.join(ROOT, "src", "data", "openings");
const ECOJSON_DIR = path.join(ROOT, "src", "data", "openings_ecojson");
const OUT_DIR = path.join(ROOT, "src", "data", "openings_combined");

const ECO_FILES = ["ecoA.json", "ecoB.json", "ecoC.json", "ecoD.json", "ecoE.json", "eco_interpolated.json"];
const SCORES_FILE = "scores.json";
const TRANSITIONS_FILE = "fromToPositionIndexed.json";

const parseJsonFile = async (filePath) => {
  const raw = await readFile(filePath, "utf8");
  return JSON.parse(raw);
};

const normalizeText = (value) => (typeof value === "string" ? value.trim() : "");
const round2 = (value) => Math.round(value * 100) / 100;

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
    ],
    totals: {
      mergedRows: combinedRows.length,
      graphNodes: graphByFen4.size,
      scoreEntries: scoreByFen4Mean.size,
      indexByEco: Object.keys(byEco).length,
      indexByFen: Object.keys(byFen).length,
      indexByNamePrefix: Object.keys(byNamePrefix).length,
      indexNextMoves: Object.keys(nextMovesIndex).length,
    },
  };

  const combinedPath = path.join(OUT_DIR, "openings.catalog.json");
  const manifestPath = path.join(OUT_DIR, "sources.manifest.json");
  const byEcoPath = path.join(OUT_DIR, "openings.index.by-eco.json");
  const byFenPath = path.join(OUT_DIR, "openings.index.by-fen.json");
  const byNamePrefixPath = path.join(OUT_DIR, "openings.index.by-name-prefix.json");
  const nextMovesPath = path.join(OUT_DIR, "openings.index.next-moves.json");

  await writeFile(combinedPath, `${JSON.stringify(combinedRows, null, 2)}\n`, "utf8");
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  await writeFile(byEcoPath, `${JSON.stringify(byEco, null, 2)}\n`, "utf8");
  await writeFile(byFenPath, `${JSON.stringify(byFen, null, 2)}\n`, "utf8");
  await writeFile(byNamePrefixPath, `${JSON.stringify(byNamePrefix, null, 2)}\n`, "utf8");
  await writeFile(nextMovesPath, `${JSON.stringify(nextMovesIndex, null, 2)}\n`, "utf8");

  console.log(`Combined rows: ${combinedRows.length}`);
  console.log(`Index by ECO keys: ${Object.keys(byEco).length}`);
  console.log(`Index by FEN keys: ${Object.keys(byFen).length}`);
  console.log(`Index next-move roots: ${Object.keys(nextMovesIndex).length}`);
  console.log(`Saved: ${combinedPath}`);
  console.log(`Saved: ${manifestPath}`);
  console.log(`Saved: ${byEcoPath}`);
  console.log(`Saved: ${byFenPath}`);
  console.log(`Saved: ${byNamePrefixPath}`);
  console.log(`Saved: ${nextMovesPath}`);
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
