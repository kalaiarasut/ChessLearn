import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

const DB_FILE  = path.join(process.cwd(), 'puzzles.sqlite3');
const OUT_DIR  = path.join(process.cwd(), 'puzzle-chunks');
const CHUNK_SIZE = 10000; // rows per file — D1 handles ~25MB per request

if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR);

const db = new Database(DB_FILE, { readonly: true });

// First file: schema only
const schemaSQL = `
CREATE TABLE IF NOT EXISTS puzzles (
  id TEXT PRIMARY KEY,
  fen TEXT NOT NULL,
  moves TEXT NOT NULL,
  rating INTEGER NOT NULL,
  themes TEXT NOT NULL,
  popularity INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_rating     ON puzzles(rating);
CREATE INDEX IF NOT EXISTS idx_popularity ON puzzles(popularity);
`;
fs.writeFileSync(path.join(OUT_DIR, '000_schema.sql'), schemaSQL);
console.log('✅ Schema file written.');

const total = db.prepare('SELECT COUNT(*) as c FROM puzzles').get().c;
console.log(`📊 Total puzzles to export: ${total.toLocaleString()}`);
console.log(`📦 Chunk size: ${CHUNK_SIZE.toLocaleString()} rows`);
console.log(`📁 Output: ${OUT_DIR}\n`);

const stmt = db.prepare('SELECT id, fen, moves, rating, themes, popularity FROM puzzles ORDER BY rowid LIMIT ? OFFSET ?');

const escape = (s) => s.replace(/'/g, "''");

let offset = 0;
let fileIndex = 1;
const ROWS_PER_INSERT = 500; // Safe limit to avoid SQLITE_TOOBIG

while (offset < total) {
  const rows = stmt.all(CHUNK_SIZE, offset);
  if (rows.length === 0) break;

  let sqlChunks = [];
  
  for (let i = 0; i < rows.length; i += ROWS_PER_INSERT) {
    const batch = rows.slice(i, i + ROWS_PER_INSERT);
    const values = batch.map(r =>
      `('${escape(r.id)}','${escape(r.fen)}','${escape(r.moves)}',${r.rating},'${escape(r.themes)}',${r.popularity})`
    ).join(',\n');
    
    sqlChunks.push(`INSERT OR IGNORE INTO puzzles (id,fen,moves,rating,themes,popularity) VALUES\n${values};`);
  }

  const sql = sqlChunks.join('\n\n');

  const fileName = String(fileIndex).padStart(4, '0') + '_puzzles.sql';
  fs.writeFileSync(path.join(OUT_DIR, fileName), sql);

  offset += rows.length;
  fileIndex++;

  if (fileIndex % 10 === 1) {
    process.stdout.write(`\r✅ Exported ${offset.toLocaleString()} / ${total.toLocaleString()} puzzles (file ${fileIndex - 1})...`);
  }
}

db.close();
console.log(`\n\n🎉 Done! ${fileIndex - 1} SQL chunk files written to ./${path.relative(process.cwd(), OUT_DIR)}/`);
console.log('Next: run  scripts/upload-to-d1.ps1  to upload all chunks to Cloudflare D1.');
