/**
 * Seed quiz questions from SQLite DB into Convex.
 *
 * Usage:
 *   cd frontend-web
 *   node scripts/seed-questions.mjs
 */
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api.js";
import { config } from "dotenv";
import Database from "better-sqlite3";
import { resolve } from "path";

config({ path: ".env.local" });

const CONVEX_URL = process.env.VITE_CONVEX_URL;
if (!CONVEX_URL) {
  console.error("Missing VITE_CONVEX_URL in .env.local");
  process.exit(1);
}

const client = new ConvexHttpClient(CONVEX_URL);

const DB_PATH = resolve("../backend/verveq_platform.db");
console.log(`Opening database: ${DB_PATH}`);
const db = new Database(DB_PATH, { readonly: true });

const rows = db.prepare("SELECT * FROM quiz_questions").all();
console.log(`Found ${rows.length} questions in database`);

const questions = rows.map((r) => {
  // Parse options — might be double-encoded JSON
  let options;
  try {
    options = JSON.parse(r.options);
    if (typeof options === "string") options = JSON.parse(options);
  } catch {
    options = [r.options];
  }

  return {
    sport: r.sport,
    category: r.category || "general",
    question: r.question,
    options,
    correctAnswer: r.correct_answer,
    explanation: r.explanation || undefined,
    difficulty:
      ["easy", "intermediate", "hard"].includes(r.difficulty)
        ? r.difficulty
        : "intermediate",
    bucket: r.bucket || `${r.sport}_${r.difficulty}_general`,
    checksum: r.checksum,
  };
});

db.close();

// Seed in batches of 25
const BATCH_SIZE = 25;
let total = 0;
const batches = Math.ceil(questions.length / BATCH_SIZE);

for (let i = 0; i < questions.length; i += BATCH_SIZE) {
  const batch = questions.slice(i, i + BATCH_SIZE);
  try {
    const result = await client.mutation(api.seedQuestions.seedBatch, {
      questions: batch,
    });
    total += result.inserted;
    process.stdout.write(`\rBatch ${Math.floor(i / BATCH_SIZE) + 1}/${batches}: ${total} inserted`);
  } catch (err) {
    console.error(`\nBatch ${Math.floor(i / BATCH_SIZE) + 1} failed:`, err.message);
  }
}

console.log(`\nDone! Total inserted: ${total}/${questions.length}`);
