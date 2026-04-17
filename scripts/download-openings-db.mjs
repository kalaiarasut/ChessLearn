import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const OUT_DIR = path.join(ROOT, "src", "data", "openings");

const SOURCES = [
  {
    id: "lichess-openings-a",
    url: "https://raw.githubusercontent.com/lichess-org/chess-openings/master/a.tsv",
    fileName: "a.tsv",
    volume: "A",
  },
  {
    id: "lichess-openings-b",
    url: "https://raw.githubusercontent.com/lichess-org/chess-openings/master/b.tsv",
    fileName: "b.tsv",
    volume: "B",
  },
  {
    id: "lichess-openings-c",
    url: "https://raw.githubusercontent.com/lichess-org/chess-openings/master/c.tsv",
    fileName: "c.tsv",
    volume: "C",
  },
  {
    id: "lichess-openings-d",
    url: "https://raw.githubusercontent.com/lichess-org/chess-openings/master/d.tsv",
    fileName: "d.tsv",
    volume: "D",
  },
  {
    id: "lichess-openings-e",
    url: "https://raw.githubusercontent.com/lichess-org/chess-openings/master/e.tsv",
    fileName: "e.tsv",
    volume: "E",
  },
  {
    id: "lichess-openings-readme",
    url: "https://raw.githubusercontent.com/lichess-org/chess-openings/master/README.md",
    fileName: "README.source.md",
    volume: "meta",
  },
];

const nowIso = new Date().toISOString();

const parseTsvRows = (raw, volume) => {
  const lines = raw.split(/\r?\n/).filter((line) => line.trim().length > 0);

  return lines
    .map((line) => line.trim())
    .map((line) => {
      const parts = line.split(/\t+/);
      if (parts.length < 3) return null;

      const [eco, name, ...pgnParts] = parts;
      const pgn = pgnParts.join(" ").trim();

      return {
        eco,
        name,
        pgn,
        volume,
      };
    })
    .filter((row) => row && row.eco.toLowerCase() !== "eco")
    .filter(Boolean);
};

const run = async () => {
  await mkdir(OUT_DIR, { recursive: true });

  const downloadResults = [];
  const combinedRows = [];

  for (const source of SOURCES) {
    const response = await fetch(source.url, {
      headers: {
        "User-Agent": "Chessify Opening Importer",
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to download ${source.id}: ${response.status} ${response.statusText}`);
    }

    const text = await response.text();
    const target = path.join(OUT_DIR, source.fileName);
    await writeFile(target, text, "utf8");

    const parsedRows = source.fileName.endsWith(".tsv") ? parseTsvRows(text, source.volume) : [];

    downloadResults.push({
      id: source.id,
      url: source.url,
      file: source.fileName,
      volume: source.volume,
      bytes: Buffer.byteLength(text, "utf8"),
      rows: source.fileName.endsWith(".tsv") ? parsedRows.length : undefined,
    });

    if (parsedRows.length > 0) {
      combinedRows.push(...parsedRows);
    }
  }

  const totalRows = downloadResults
    .filter((entry) => typeof entry.rows === "number")
    .reduce((sum, entry) => sum + (entry.rows ?? 0), 0);

  const manifest = {
    generatedAt: nowIso,
    source: {
      name: "lichess-org/chess-openings",
      repository: "https://github.com/lichess-org/chess-openings",
      notes:
        "This dataset provides named opening variations across ECO volumes A-E in TSV format.",
      licensing:
        "Repository README states data is released under CC0 Public Domain Dedication.",
    },
    files: downloadResults,
    totals: {
      tsvFileCount: downloadResults.filter((entry) => entry.file.endsWith(".tsv")).length,
      variationRows: totalRows,
    },
  };

  const manifestPath = path.join(OUT_DIR, "sources.manifest.json");
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

  const combinedPath = path.join(OUT_DIR, "openings.all.json");
  await writeFile(combinedPath, `${JSON.stringify(combinedRows, null, 2)}\n`, "utf8");

  console.log(`Downloaded ${manifest.totals.tsvFileCount} TSV files.`);
  console.log(`Total variation rows: ${manifest.totals.variationRows}`);
  console.log(`Saved manifest: ${manifestPath}`);
  console.log(`Saved combined JSON: ${combinedPath}`);
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
