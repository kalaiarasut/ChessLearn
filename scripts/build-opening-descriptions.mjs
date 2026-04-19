import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const CATALOG_PATH = path.join(process.cwd(), "src", "data", "openings_combined", "openings.catalog.json");
const OUTPUT_PATH = path.join(process.cwd(), "src", "data", "openingDescriptions.json");

const WIKI_TITLE_OVERRIDES = {
  english: "English Opening",
  sicilian: "Sicilian Defence",
  french: "French Defence",
  "caro-kann": "Caro-Kann Defence",
  "ruy-lopez": "Ruy Lopez",
  "queen-s-gambit": "Queen's Gambit",
  "king-s-indian": "King's Indian Defence",
  scandinavian: "Scandinavian Defense",
  italian: "Italian Game",
  gruenfeld: "Grunfeld Defence",
  "nimzo-indian": "Nimzo-Indian Defence",
  london: "London System",
  slav: "Slav Defense",
  pirc: "Pirc Defence",
  vienna: "Vienna Game",
};

const FORCE_DETERMINISTIC_DESCRIPTIONS = true;

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

const fallbackDescriptionForName = (name) => {
  const lowered = name.toLowerCase();
  const themes = [];

  if (lowered.includes("gambit")) {
    themes.push("initiative", "piece activity", "practical attacking chances");
  } else if (lowered.includes("defense") || lowered.includes("defence")) {
    themes.push("durable pawn structure", "coordinated development", "timely counterplay");
  } else if (lowered.includes("attack")) {
    themes.push("early pressure", "active piece play", "direct kingside or central threats");
  } else if (lowered.includes("countergambit")) {
    themes.push("immediate central challenge", "initiative", "dynamic counterplay");
  } else if (lowered.includes("trap")) {
    themes.push("tactical alertness", "precise move order", "early initiative");
  } else {
    themes.push("healthy development", "central control", "sound king safety");
  }

  const identity =
    lowered.includes("gambit")
      ? `${name} is an aggressive opening choice built around dynamic compensation for material.`
      : lowered.includes("defense") || lowered.includes("defence")
        ? `${name} is a dependable defensive system that aims for resilience and flexible counterplay.`
        : lowered.includes("attack")
          ? `${name} is a proactive attacking setup that seeks momentum and active piece coordination.`
          : `${name} is a practical opening system used to reach clear, playable middlegame structures.`;

  return `${identity} Typical plans emphasize ${themes.join(", ")}.`;
};

const hashText = (value) => {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash;
};

const pick = (items, seed, offset = 0) => items[(seed + offset) % items.length];

const deterministicDescriptionForName = (name, key) => {
  const lowered = name.toLowerCase();
  const seed = hashText(`${key}:${name}`);

  const shapeByType = {
    gambit: [
      "creates immediate imbalance by offering material for activity",
      "trades material security for initiative and open lines",
      "seeks dynamic compensation through rapid mobilization",
      "forces concrete play early with tactical pressure",
    ],
    defense: [
      "prioritizes structural soundness before active counterplay",
      "aims to neutralize early pressure with disciplined piece placement",
      "builds a resilient pawn shell and waits for the right break",
      "focuses on flexible responses to central expansion",
    ],
    attack: [
      "drives play toward active piece coordination and initiative",
      "creates momentum with direct pressure against key squares",
      "pushes for attacking chances before the position settles",
      "encourages energetic development and tactical opportunities",
    ],
    system: [
      "targets a clear middlegame structure with practical plans",
      "emphasizes smooth development and stable central control",
      "seeks a reliable setup that stays playable in many move orders",
      "balances flexibility with strategic clarity",
    ],
  };

  const planPhrases = [
    "Typical plans include improving minor-piece activity before committing pawn breaks",
    "A common plan is to complete development, secure king safety, and then challenge the center",
    "Players often aim for harmonious coordination and a well-timed central or flank expansion",
    "The structure usually rewards patience, piece improvement, and accurate transition into the middlegame",
    "Practical success often comes from controlling key central squares and preserving piece harmony",
    "It is most effective when development is fast and strategic pawn commitments are timed carefully",
  ];

  const cautionPhrases = [
    "Early inaccuracies can quickly hand over the initiative.",
    "Move-order discipline matters because transpositions are common.",
    "The opening is playable at all levels when plans are understood, not memorized mechanically.",
    "Precise development is more important than grabbing short-term material.",
    "Understanding typical pawn structures is usually more valuable than memorizing long forcing lines.",
    "Positions can shift quickly, so coordination and king safety must stay the priority.",
  ];

  const type = lowered.includes("gambit")
    ? "gambit"
    : lowered.includes("defense") || lowered.includes("defence")
      ? "defense"
      : lowered.includes("attack")
        ? "attack"
        : "system";

  const first = `${name} ${pick(shapeByType[type], seed)}.`;
  const second = `${pick(planPhrases, seed, 3)}.`;
  const third = pick(cautionPhrases, seed, 9);
  return `${first} ${second} ${third}`;
};

const BAD_DESCRIPTION_PATTERNS = [
  /usually refers to/i,
  /may refer to/i,
  /can refer to/i,
  /is a surname/i,
  /is a city/i,
  /capital and largest city/i,
  /internet chess server/i,
  /board game for two players/i,
  /opening is the initial stage/i,
  /the game of chess is commonly divided/i,
  /population of/i,
  /list of notable deaths/i,
  /occupational surname/i,
  /is an internet/i,
  /is a german/i,
  /is a dutch/i,
  /is a yiddish/i,
  /in december/i,
  /with an estimated city population/i,
  /recognized chess opening with practical strategic plans/i,
];

const isBadDescription = (value) => {
  const text = (value ?? "").trim();
  if (!text) return true;
  if (text.length < 70) return true;

  if (BAD_DESCRIPTION_PATTERNS.some((pattern) => pattern.test(text))) {
    return true;
  }

  if (!/[.!?]$/.test(text)) {
    return true;
  }

  return false;
};

const cleanupText = (text) => {
  return text
    .replace(/\s*\([^)]*\)/g, "")
    .replace(/\s*\[[^\]]*\]/g, "")
    .replace(/\b\d+\.(\.\.)?/g, "")
    .replace(/\b\d+\.[a-h][1-8]\b/gi, "the first move")
    .replace(/\b(?:O-O(?:-O)?|[KQRBN]?[a-h]?[1-8]?x?[a-h][1-8](?:=[QRBN])?[+#]?)(?:[!?+#]+)?\b/g, "")
    .replace(/\b[a-h][1-8]\b/gi, "the center")
    .replace(/\b(move|moves)\s+\./gi, "")
    .replace(/\bon\s+the\s+center\s*\./gi, "in the center.")
    .replace(/\bdefending\s+the\s+pawn\s*\./gi, "defending key central pawns.")
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([,.;:!?])/g, "$1")
    .trim();
};

const looksLikeGeneric = (value) =>
  /usually refers to|may refer to|can refer to|disambiguation/i.test(value) || value.length < 45;

const completeSentence = (value, name) => {
  let text = value.trim();
  if (!text) {
    return fallbackDescriptionForName(name);
  }

  text = text.replace(/\s{2,}/g, " ").replace(/\s+([,.;:!?])/g, "$1").trim();
  if (/[,:;]$/.test(text) || /\b(on|in|for|with|to|of|by|from|at)$/.test(text)) {
    text = `${text.replace(/[,:;]+$/, "")}.`;
  }
  if (!/[.!?]$/.test(text)) {
    text = `${text}.`;
  }
  return text;
};

const toPlainDescription = (extract, title) => {
  const cleaned = cleanupText(extract ?? "");
  if (!cleaned || looksLikeGeneric(cleaned)) {
    return fallbackDescriptionForName(title);
  }

  const firstSentence = cleaned.split(/(?<=[.!?])\s+/)[0] ?? cleaned;
  const trimmed = firstSentence.length > 220 ? `${firstSentence.slice(0, 217).trim()}...` : firstSentence;
  const candidate = completeSentence(trimmed, title);
  if (isBadDescription(candidate)) {
    return fallbackDescriptionForName(title);
  }
  return candidate;
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
  const searchPayload = await fetchJson(
    `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encoded}&srlimit=8&format=json`,
  ).catch(() => null);

  const results = searchPayload?.query?.search;
  if (!Array.isArray(results)) {
    return null;
  }

  const ranked = results
    .map((item) => (typeof item?.title === "string" ? item.title : ""))
    .filter(Boolean)
    .sort((left, right) => {
      const l = /chess|defence|defense|gambit|opening|attack/i.test(left) ? 0 : 1;
      const r = /chess|defence|defense|gambit|opening|attack/i.test(right) ? 0 : 1;
      if (l !== r) return l - r;
      return left.length - right.length;
    });

  return ranked[0] ?? null;
};

const fetchDescriptionFromInternet = async (name, coreKey) => {
  const overrideTitle = WIKI_TITLE_OVERRIDES[coreKey];
  if (overrideTitle) {
    const summary = await getSummary(overrideTitle);
    if (summary) {
      return toPlainDescription(summary.extract, name);
    }
  }

  const title =
    (await findWikipediaTitle(`${name} chess opening`)) ??
    (await findWikipediaTitle(`${name} chess`)) ??
    (await findWikipediaTitle(`${name} opening`));

  if (title) {
    const summary = await getSummary(title);
    if (summary) {
      return toPlainDescription(summary.extract, name);
    }
  }

  const fallbackSummary = await getSummary(`${name} (chess)`) ?? await getSummary(name);
  if (fallbackSummary) {
    return toPlainDescription(fallbackSummary.extract, name);
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
    if (FORCE_DETERMINISTIC_DESCRIPTIONS) {
      result[key] = deterministicDescriptionForName(name, key);
      console.log(`ok  ${name}`);
      return;
    }

    const description = await fetchDescriptionFromInternet(name, key);
    if (description && !isBadDescription(description)) {
      result[key] = description;
      console.log(`ok  ${name}`);
      return;
    }

    result[key] = fallbackDescriptionForName(name);
    console.log(`fallback  ${name}`);
  });

  await writeFile(OUTPUT_PATH, `${JSON.stringify(result, null, 2)}\n`, "utf8");
  console.log(`Saved ${Object.keys(result).length} descriptions to ${OUTPUT_PATH}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
