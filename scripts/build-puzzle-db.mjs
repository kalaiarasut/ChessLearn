import fs from 'fs';
import readline from 'readline';
import Database from 'better-sqlite3';
import path from 'path';

const CSV_FILE = path.join(process.cwd(), 'lichess_db_puzzle.csv');
const DB_FILE  = path.join(process.cwd(), 'puzzles.sqlite3');

async function buildDatabase() {
  if (!fs.existsSync(CSV_FILE)) {
    console.error(`❌ Cannot find ${CSV_FILE}`);
    process.exit(1);
  }

  const isResume = fs.existsSync(DB_FILE);

  console.log(isResume
    ? '🔄 Existing database found — resuming from where we left off...'
    : '📦 Creating new SQLite database...');

  const db = new Database(DB_FILE);
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = NORMAL');

  // Create table only if starting fresh
  db.exec(`
    CREATE TABLE IF NOT EXISTS puzzles (
      id TEXT PRIMARY KEY,
      fen TEXT NOT NULL,
      moves TEXT NOT NULL,
      rating INTEGER NOT NULL,
      themes TEXT NOT NULL,
      popularity INTEGER NOT NULL
    );
  `);

  // Find how many rows we already have
  const existing = db.prepare('SELECT COUNT(*) as c FROM puzzles').get().c;
  console.log(`📊 Already in DB: ${existing.toLocaleString()} puzzles`);

  const insert = db.prepare(`
    INSERT OR IGNORE INTO puzzles (id, fen, moves, rating, themes, popularity)
    VALUES (@id, @fen, @moves, @rating, @themes, @popularity)
  `);

  console.log('⏳ Processing CSV...');

  const fileStream = fs.createReadStream(CSV_FILE);
  const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

  let csvLine = 0;  // total lines read from CSV (including header)
  let inserted = 0; // new rows added this run
  let skipped  = 0; // rows skipped (already exist)

  db.exec('BEGIN TRANSACTION');

  for await (const line of rl) {
    if (csvLine === 0) { csvLine++; continue; } // skip header
    csvLine++;

    // Format: PuzzleId,FEN,Moves,Rating,RatingDeviation,Popularity,NbPlays,Themes,GameUrl,OpeningTags
    const parts = line.split(',');
    if (parts.length < 8) continue;

    const [id, fen, moves, ratingStr, , popStr, , themes] = parts;
    const rating     = parseInt(ratingStr, 10);
    const popularity = parseInt(popStr,    10) || 0;

    const info = insert.run({
      id,
      fen,
      moves,
      rating,
      themes: ` ${themes} `,
      popularity
    });

    if (info.changes > 0) {
      inserted++;
    } else {
      skipped++;
    }

    const total = existing + inserted;
    if (total > 0 && total % 50000 === 0 && info.changes > 0) {
      db.exec('COMMIT');
      process.stdout.write(`\r✅ Total: ${total.toLocaleString()} (added ${inserted.toLocaleString()} new this run)...`);
      db.exec('BEGIN TRANSACTION');
    }
  }

  db.exec('COMMIT');

  const grandTotal = db.prepare('SELECT COUNT(*) as c FROM puzzles').get().c;
  console.log(`\n\n🎉 Done!`);
  console.log(`   New this run : ${inserted.toLocaleString()}`);
  console.log(`   Already had  : ${skipped.toLocaleString()} (skipped)`);
  console.log(`   Grand total  : ${grandTotal.toLocaleString()} puzzles`);

  // Create indexes if they don't exist yet
  console.log('\n📊 Ensuring indexes exist...');
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_rating     ON puzzles(rating);
    CREATE INDEX IF NOT EXISTS idx_popularity ON puzzles(popularity);
  `);
  console.log('✅ Indexes ready.');

  console.log('\n🔎 Ensuring theme search index exists...');
  db.exec(`
    CREATE VIRTUAL TABLE IF NOT EXISTS puzzle_theme_fts USING fts5(
      id UNINDEXED,
      themes
    );
  `);

  const ftsCount = db.prepare('SELECT COUNT(*) as c FROM puzzle_theme_fts').get().c;
  if (ftsCount !== grandTotal) {
    console.log(`🔄 Rebuilding theme search index (${ftsCount.toLocaleString()} -> ${grandTotal.toLocaleString()})...`);
    db.exec('DELETE FROM puzzle_theme_fts;');
    db.exec(`
      INSERT INTO puzzle_theme_fts (id, themes)
      SELECT id, trim(themes) FROM puzzles;
    `);
  }
  console.log('✅ Theme search index ready.');

  db.close();
  const sizeMB = (fs.statSync(DB_FILE).size / (1024 * 1024)).toFixed(2);
  console.log(`\n🚀 Database: ${DB_FILE}`);
  console.log(`   Size: ${sizeMB} MB`);
}

buildDatabase().catch(console.error);
