import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const OUT_DIR = path.join(ROOT, "src", "data", "openings_ecojson");

const SOURCES = [
  "ecoA.json",
  "ecoB.json",
  "ecoC.json",
  "ecoD.json",
  "ecoE.json",
  "eco_interpolated.json",
  "scores.json",
  "fromTo.json",
  "fromToPositionIndexed.json",
  "README.md",
];

const run = async () => {
  await mkdir(OUT_DIR, { recursive: true });

  const files = [];

  for (const fileName of SOURCES) {
    const url = `https://raw.githubusercontent.com/JeffML/eco.json/master/${fileName}`;
    const response = await fetch(url, {
      headers: {
        "User-Agent": "ChessLearn Opening Importer",
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to download ${fileName}: ${response.status} ${response.statusText}`);
    }

    const text = await response.text();
    const outputName = fileName === "README.md" ? "README.source.md" : fileName;
    const target = path.join(OUT_DIR, outputName);
    await writeFile(target, text, "utf8");

    files.push({
      file: outputName,
      sourceUrl: url,
      bytes: Buffer.byteLength(text, "utf8"),
    });
  }

  const manifest = {
    generatedAt: new Date().toISOString(),
    source: {
      name: "JeffML/eco.json",
      repository: "https://github.com/JeffML/eco.json",
      notes:
        "Extended opening catalog with ECO entries keyed by FEN and transition index data.",
    },
    files,
  };

  const manifestPath = path.join(OUT_DIR, "sources.manifest.json");
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

  console.log(`Downloaded ${files.length} files from JeffML/eco.json.`);
  console.log(`Saved manifest: ${manifestPath}`);
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
