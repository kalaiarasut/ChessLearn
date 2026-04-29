import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

const DB_FILE = path.join(process.cwd(), 'puzzles.sqlite3');
const OUT_DIR = path.join(process.cwd(), 'puzzle-theme-fts-chunks');
const CHUNK_SIZE = 25_000;
const ROWS_PER_INSERT = 1_000;

if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR);

const db = new Database(DB_FILE, { readonly: true });

const schemaSQL = `
CREATE VIRTUAL TABLE IF NOT EXISTS puzzle_theme_fts USING fts5(
  id UNINDEXED,
  themes
);
`;
fs.writeFileSync(path.join(OUT_DIR, '000_schema.sql'), schemaSQL);
console.log('✅ Theme FTS schema file written.');

const total = db.prepare('SELECT COUNT(*) as c FROM puzzles').get().c;
console.log(`📊 Total puzzle theme rows to export: ${total.toLocaleString()}`);
console.log(`📦 Chunk size: ${CHUNK_SIZE.toLocaleString()} rows`);
console.log(`📁 Output: ${OUT_DIR}\n`);

const stmt = db.prepare('SELECT id, trim(themes) as themes FROM puzzles ORDER BY rowid LIMIT ? OFFSET ?');
const escape = (s) => s.replace(/'/g, "''");

let offset = 0;
let fileIndex = 1;

while (offset < total) {
  const rows = stmt.all(CHUNK_SIZE, offset);
  if (rows.length === 0) break;

  const sqlChunks = [];

  for (let i = 0; i < rows.length; i += ROWS_PER_INSERT) {
    const batch = rows.slice(i, i + ROWS_PER_INSERT);
    const values = batch
      .map((row) => `('${escape(row.id)}','${escape(row.themes)}')`)
      .join(',\n');

    sqlChunks.push(`INSERT INTO puzzle_theme_fts (id, themes) VALUES\n${values};`);
  }

  const fileName = `${String(fileIndex).padStart(4, '0')}_theme_fts.sql`;
  fs.writeFileSync(path.join(OUT_DIR, fileName), sqlChunks.join('\n\n'));

  offset += rows.length;
  fileIndex++;

  if (fileIndex % 10 === 1) {
    process.stdout.write(`\r✅ Exported ${offset.toLocaleString()} / ${total.toLocaleString()} theme rows (file ${fileIndex - 1})...`);
  }
}

db.close();
console.log(`\n\n🎉 Done! ${fileIndex - 1} theme FTS chunk files written to ./${path.relative(process.cwd(), OUT_DIR)}/`);
