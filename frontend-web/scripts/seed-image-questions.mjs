/**
 * Seed image-based quiz questions into Convex.
 * Downloads images from TheSportsDB and stores them in Convex storage.
 *
 * Usage:
 *   cd frontend-web
 *   node scripts/seed-image-questions.mjs
 */
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api.js";
import { config } from "dotenv";
import { readFileSync } from "fs";
import { resolve } from "path";

config({ path: ".env.local" });

const CONVEX_URL = process.env.VITE_CONVEX_URL;
if (!CONVEX_URL) {
  console.error("Missing VITE_CONVEX_URL in .env.local");
  process.exit(1);
}

const client = new ConvexHttpClient(CONVEX_URL);

// Load the generated image dataset
const dataPath = resolve("../complete_image_seed_data.json");
console.log(`Loading: ${dataPath}`);
const raw = JSON.parse(readFileSync(dataPath, "utf-8"));
console.log(`Loaded ${raw.length} image questions\n`);

// Map JSON fields to Convex schema (correct_answer → correctAnswer, drop id/imageType)
const questions = raw.map(({ id, correct_answer, imageType, ...rest }) => ({
  ...rest,
  correctAnswer: correct_answer,
}));

const BATCH_SIZE = 5;
const DELAY_MS = 2000;
const totalBatches = Math.ceil(questions.length / BATCH_SIZE);
let totalInserted = 0;
let totalFailed = 0;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

for (let i = 0; i < questions.length; i += BATCH_SIZE) {
  const batch = questions.slice(i, i + BATCH_SIZE);
  const batchNum = Math.floor(i / BATCH_SIZE) + 1;

  try {
    const result = await client.action(api.seedQuestions.seedImageBatch, {
      questions: batch,
    });
    totalInserted += result.inserted;
    totalFailed += result.failed;
    process.stdout.write(
      `\rBatch ${batchNum}/${totalBatches}: ${totalInserted} inserted, ${totalFailed} failed`
    );
  } catch (err) {
    console.error(`\nBatch ${batchNum} error: ${err.message}`);
    totalFailed += batch.length;
  }

  if (i + BATCH_SIZE < questions.length) {
    await sleep(DELAY_MS);
  }
}

console.log(`\n\nDone! Inserted: ${totalInserted}, Failed: ${totalFailed}, Total: ${questions.length}`);
