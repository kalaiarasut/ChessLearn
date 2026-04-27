import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const OUT_DIR = path.join(ROOT, "src", "data", "openings_stats");

const SOURCES = [
  {
    id: "draeangela-openings-csv",
    url: "https://raw.githubusercontent.com/draeangela/chess-openings-analysis/main/data/openings.csv",
    fileName: "openings.csv",
    description:
      "Precomputed opening statistics including number of games, white/draw/black outcome percentages, and move strings.",
  },
  {
    id: "draeangela-readme",
    url: "https://raw.githubusercontent.com/draeangela/chess-openings-analysis/main/README.md",
    fileName: "README.source.md",
    description: "Source project README with provenance notes.",
  },
  {
    id: "draeangela-license",
    url: "https://raw.githubusercontent.com/draeangela/chess-openings-analysis/main/LICENSE",
    fileName: "LICENSE.source",
    description: "Source project license text.",
  },
];

const run = async () => {
  await mkdir(OUT_DIR, { recursive: true });

  const files = [];

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

    files.push({
      id: source.id,
      file: source.fileName,
      sourceUrl: source.url,
      bytes: Buffer.byteLength(text, "utf8"),
      description: source.description,
    });
  }

  const manifest = {
    generatedAt: new Date().toISOString(),
    source: {
      name: "draeangela/chess-openings-analysis",
      repository: "https://github.com/draeangela/chess-openings-analysis",
      upstreamDataset: "https://www.kaggle.com/datasets/alexandrelemercier/all-chess-openings",
      notes:
        "Used as an auxiliary stats source for opening popularity and outcome percentages. Keep source attribution files alongside downloaded data.",
    },
    files,
  };

  const manifestPath = path.join(OUT_DIR, "sources.manifest.json");
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

  console.log(`Downloaded ${files.length} files from stats source.`);
  console.log(`Saved manifest: ${manifestPath}`);
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
