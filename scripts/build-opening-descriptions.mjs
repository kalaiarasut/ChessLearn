import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const CATALOG_PATH = path.join(process.cwd(), "src", "data", "openings_combined", "openings.catalog.json");
const OUTPUT_PATH = path.join(process.cwd(), "src", "data", "openingDescriptions.json");

const normalizeSlug = (value) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const toBaseOpeningName = (name) => {
  const colonRoot = name.split(":")[0]?.trim() ?? name;
  const commaRoot = colonRoot.split(",")[0]?.trim() ?? colonRoot;
  return commaRoot.replace(/\s+(variation|line|system|accepted|declined)\b.*$/i, "").trim() || name;
};

const toOpeningCoreKey = (name) => {
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

const cleanupText = (text) => {
  return text
    .replace(/\s*\([^)]*\)/g, "")
    .replace(/\s*\[[^\]]*\]/g, "")
    .replace(/\b\d+\.(\.\.)?/g, "")
    .replace(/\b(?:O-O(?:-O)?|[KQRBN]?[a-h]?[1-8]?x?[a-h][1-8](?:=[QRBN])?[+#]?)(?:[!?+#]+)?\b/g, "")
    .replace(/\b[a-h][1-8]\b/g, "")
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([,.;:!?])/g, "$1")
    .trim();
};

const toPlainDescription = (extract, title) => {
  const cleaned = cleanupText(extract ?? "");
  if (!cleaned || cleaned.length < 40) {
    return `A classical chess opening named ${title}, with established strategic ideas and typical middlegame plans.`;
  }

  const firstSentence = cleaned.split(/(?<=[.!?])\s+/)[0] ?? cleaned;
  return firstSentence.length > 220 ? `${firstSentence.slice(0, 217).trim()}...` : firstSentence;
};

const fetchJson = async (url) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  const response = await fetch(url, {
    headers: {
      "User-Agent": "ChessifyOpeningDescriptions/1.0 (https://localhost)",
      "Accept": "application/json",
    },
    signal: controller.signal,
  });

  clearTimeout(timeout);

  if (!response.ok) {
    return null;
  }

  return response.json();
};

const getSummary = async (title) => {
  const encoded = encodeURIComponent(title);
  const direct = await fetchJson(`https://en.wikipedia.org/api/rest_v1/page/summary/${encoded}`).catch(() => null);
  if (direct && typeof direct.extract === "string" && direct.extract.trim()) {
    return { title: direct.title ?? title, extract: direct.extract };
  }
  return null;
};

const findWikipediaTitle = async (query) => {
  const encoded = encodeURIComponent(query);
  const openSearch = await fetchJson(`https://en.wikipedia.org/w/api.php?action=opensearch&search=${encoded}&limit=3&namespace=0&format=json`).catch(() => null);
  if (!Array.isArray(openSearch) || !Array.isArray(openSearch[1])) {
    return null;
  }

  const titles = openSearch[1].filter((entry) => typeof entry === "string");
  return titles[0] ?? null;
};

const fetchDescriptionFromInternet = async (name) => {
  const title = await findWikipediaTitle(`${name} chess opening`) ?? await findWikipediaTitle(`${name} chess`);
  if (title) {
    const summary = await getSummary(title);
    if (summary) {
      return toPlainDescription(summary.extract, summary.title ?? name);
    }
  }

  const fallbackSummary = await getSummary(`${name} (chess)`) ?? await getSummary(name);
  if (fallbackSummary) {
    return toPlainDescription(fallbackSummary.extract, fallbackSummary.title ?? name);
  }

  return null;
};

async function mapConcurrent(items, concurrency, worker) {
  const results = new Array(items.length);
  let index = 0;

  const runners = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (true) {
      const current = index;
      index += 1;
      if (current >= items.length) {
        break;
      }
      results[current] = await worker(items[current], current);
    }
  });

  await Promise.all(runners);
  return results;
}

async function main() {
  const raw = await readFile(CATALOG_PATH, "utf8");
  const rows = JSON.parse(raw);

  const byKey = new Map();
  for (const row of rows) {
    const name = typeof row?.name === "string" ? row.name : "";
    if (!name) continue;
    const key = toOpeningCoreKey(name);
    const baseName = toBaseOpeningName(name);
    const current = byKey.get(key);
    if (!current || baseName.length < current.length) {
      byKey.set(key, baseName);
    }
  }

  const result = {};
  const entries = Array.from(byKey.entries()).sort((a, b) => a[1].localeCompare(b[1]));

  console.log(`Building descriptions for ${entries.length} opening families...`);

  await mapConcurrent(entries, 10, async ([key, name]) => {
    const description = await fetchDescriptionFromInternet(name);
    if (description) {
      result[key] = description;
      console.log(`ok  ${name}`);
      return;
    }

    result[key] = "A practical chess opening with clear strategic themes, balanced piece development, and common middlegame plans.";
    console.log(`fallback  ${name}`);
  });

  await writeFile(OUTPUT_PATH, `${JSON.stringify(result, null, 2)}\n`, "utf8");
  console.log(`Saved ${Object.keys(result).length} descriptions to ${OUTPUT_PATH}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
