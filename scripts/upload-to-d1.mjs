import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const DB_NAME = 'chessify-puzzles';
const CHUNKS_DIR = path.join(process.cwd(), 'puzzle-chunks');
const CHUNK_SIZE = 10_000;
const MAX_ATTEMPTS = 5;
const RETRY_DELAY_MS = 5_000;
const WRANGLER_BIN = path.join(
  process.cwd(),
  'node_modules',
  '.bin',
  process.platform === 'win32' ? 'wrangler.cmd' : 'wrangler',
);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function runWrangler(args) {
  const command = [WRANGLER_BIN, 'd1', 'execute', DB_NAME, '--remote', ...args]
    .map((arg) => `"${String(arg).replace(/"/g, '\\"')}"`)
    .join(' ');

  return execSync(command, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

function parseArgs(argv) {
  let from = null;
  let dryRun = false;

  for (const arg of argv) {
    if (arg === '--dry-run') {
      dryRun = true;
      continue;
    }

    if (arg.startsWith('--from=')) {
      from = arg.slice('--from='.length);
      continue;
    }
  }

  return { from, dryRun };
}

function normalizeChunkFile(value) {
  if (!value) return null;
  if (/^\d+$/.test(value)) {
    return `${value.padStart(4, '0')}_puzzles.sql`;
  }
  if (/^\d{4}_puzzles\.sql$/.test(value)) {
    return value;
  }

  throw new Error(`Invalid --from value: ${value}. Use 531 or 0531_puzzles.sql.`);
}

function getRemoteRowCount() {
  const output = runWrangler(['--command=SELECT COUNT(*) AS count FROM puzzles;', '-y']);
  const match = output.match(/"count"\s*:\s*(\d+)/);

  if (!match) {
    throw new Error(`Unable to determine remote row count.\n${output}`);
  }

  return Number(match[1]);
}

function getResumeFile(remoteRows) {
  if (remoteRows <= 0) {
    return '000_schema.sql';
  }

  const nextChunkNumber = Math.floor(remoteRows / CHUNK_SIZE) + 1;
  return `${String(nextChunkNumber).padStart(4, '0')}_puzzles.sql`;
}

const { from: fromArg, dryRun } = parseArgs(process.argv.slice(2));

const files = fs.readdirSync(CHUNKS_DIR)
  .filter((file) => file.endsWith('.sql'))
  .sort();

const total = files.length;
const manualStartFile = normalizeChunkFile(fromArg);

let startFile = manualStartFile;
let remoteRows = null;

if (!startFile) {
  remoteRows = getRemoteRowCount();
  startFile = getResumeFile(remoteRows);
}

const startIndex = files.indexOf(startFile);

if (startIndex === -1) {
  if (startFile > files.at(-1)) {
    if (remoteRows !== null) {
      console.log(`Remote D1 row count: ${remoteRows.toLocaleString()}`);
    }
    console.log('Remote D1 already appears fully uploaded. Nothing to do.');
    process.exit(0);
  }
  throw new Error(`Start file not found in ${CHUNKS_DIR}: ${startFile}`);
}

if (remoteRows !== null) {
  console.log(`Remote D1 row count: ${remoteRows.toLocaleString()}`);
}
console.log(`Starting upload from: ${startFile} (${startIndex + 1}/${total})`);

if (dryRun) {
  process.exit(0);
}

for (let index = startIndex; index < files.length; index++) {
  const file = files[index];
  const filePath = path.join(CHUNKS_DIR, file);
  process.stdout.write(`[${index + 1}/${total}] Uploading ${file}... `);

  let success = false;
  let attempts = 0;

  while (!success && attempts < MAX_ATTEMPTS) {
    try {
      runWrangler([`--file=${filePath}`, '-y']);
      console.log('OK');
      success = true;
    } catch (error) {
      attempts++;

      if (attempts < MAX_ATTEMPTS) {
        process.stdout.write(`FAILED (attempt ${attempts}/${MAX_ATTEMPTS}) - waiting 5s then retrying... `);
        await sleep(RETRY_DELAY_MS);
      } else {
        const details = error.stderr?.toString?.().trim() || error.message;
        console.log(`\nFAILED after ${MAX_ATTEMPTS} attempts. Stopping. Re-run with: node scripts/upload-to-d1.mjs --from=${file}`);
        if (details) {
          console.log(details);
        }
        process.exit(1);
      }
    }
  }
}

console.log(`\nAll ${total} chunk files uploaded to D1 successfully.`);
