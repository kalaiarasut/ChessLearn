import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const DB_NAME = "chessify-puzzles";
const CHUNKS_DIR = path.join(process.cwd(), 'puzzle-chunks');

const files = fs.readdirSync(CHUNKS_DIR)
  .filter(f => f.endsWith('.sql'))
  .sort();

const total = files.length;
let i = 0;

for (const file of files) {
  i++;
  const filePath = path.join(CHUNKS_DIR, file);
  process.stdout.write(`[${i}/${total}] Uploading ${file}... `);
  
  try {
    execSync(`npx wrangler d1 execute ${DB_NAME} --remote --file="${filePath}" -y`, { stdio: 'pipe' });
    console.log('✅');
  } catch (error) {
    console.log('FAILED ❌ — retrying once...');
    try {
      execSync(`npx wrangler d1 execute ${DB_NAME} --remote --file="${filePath}" -y`, { stdio: 'pipe' });
      console.log('✅');
    } catch (retryError) {
      console.log(`\nFAILED again. Stopping. Re-run script to resume from: ${file}`);
      process.exit(1);
    }
  }
}

console.log(`\n🎉 All ${total} chunks uploaded to D1 successfully!`);
