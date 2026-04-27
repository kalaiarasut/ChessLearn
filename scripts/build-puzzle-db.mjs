import fs from 'fs';
import readline from 'readline';
import Database from 'better-sqlite3';
import path from 'path';

// This script expects `lichess_db_puzzle.csv` to be in the same folder as the script
const CSV_FILE = path.join(process.cwd(), 'lichess_db_puzzle.csv');
const DB_FILE = path.join(process.cwd(), 'puzzles.sqlite3');

const POPULARITY_THRESHOLD = 75; // Only keep well-liked puzzles
const PLAYS_THRESHOLD = 50;      // Only keep puzzles with stable ratings

async function buildDatabase() {
  if (!fs.existsSync(CSV_FILE)) {
    console.error(`❌ Error: Could not find ${CSV_FILE}`);
    console.error("Please download the Lichess puzzle database from:");
    console.error("https://database.lichess.org/lichess_db_puzzle.csv.zst");
    console.error("Extract it and place 'lichess_db_puzzle.csv' in the project root.");
    process.exit(1);
  }

  // Clean up old DB if it exists
  if (fs.existsSync(DB_FILE)) {
    fs.unlinkSync(DB_FILE);
  }

  console.log('📦 Creating SQLite database...');
  const db = new Database(DB_FILE);

  // Use WAL mode for better performance
  db.pragma('journal_mode = WAL');

  // Create table
  db.exec(`
    CREATE TABLE puzzles (
      id TEXT PRIMARY KEY,
      fen TEXT NOT NULL,
      moves TEXT NOT NULL,
      rating INTEGER NOT NULL,
      themes TEXT NOT NULL,
      popularity INTEGER NOT NULL
    );
  `);

  const insert = db.prepare(`
    INSERT INTO puzzles (id, fen, moves, rating, themes, popularity)
    VALUES (@id, @fen, @moves, @rating, @themes, @popularity)
  `);

  console.log('⏳ Processing CSV... This may take a few minutes.');
  
  const fileStream = fs.createReadStream(CSV_FILE);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  let count = 0;
  let isFirstLine = true;

  db.exec('BEGIN TRANSACTION');

  for await (const line of rl) {
    if (isFirstLine) {
      isFirstLine = false;
      continue; // Skip header
    }

    // Format: PuzzleId,FEN,Moves,Rating,RatingDeviation,Popularity,NbPlays,Themes,GameUrl,OpeningTags
    const parts = line.split(',');
    if (parts.length < 8) continue;

    const [id, fen, moves, ratingStr, devStr, popStr, playsStr, themes] = parts;
    const rating = parseInt(ratingStr, 10);
    const popularity = parseInt(popStr, 10) || 0;

    // Insert ALL puzzles as requested
    insert.run({
      id,
      fen,
      moves,
      rating,
      themes: ` ${themes} `, // Pad with spaces for easier LIKE '% theme %' queries
      popularity
    });
    
    count++;

    if (count > 0 && count % 50000 === 0) {
      db.exec('COMMIT');
      process.stdout.write(`\r✅ Inserted ${count} puzzles...`);
      db.exec('BEGIN TRANSACTION');
    }
  }

  db.exec('COMMIT');
  console.log(`\n\n🎉 Done! Inserted all ${count} puzzles from the dataset.`);

  console.log('📊 Creating indexes for fast searching...');
  db.exec(`
    CREATE INDEX idx_rating ON puzzles(rating);
    CREATE INDEX idx_popularity ON puzzles(popularity);
  `);
  console.log('✅ Indexes created.');
  
  db.close();
  console.log(`\n🚀 Database saved to ${DB_FILE}`);
  console.log(`Size: ${(fs.statSync(DB_FILE).size / (1024 * 1024)).toFixed(2)} MB`);
}

buildDatabase().catch(console.error);
