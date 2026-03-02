#!/usr/bin/env node
/**
 * One-time script to generate football_player_metadata.json
 * from archive/players.csv for the tiered hint system.
 *
 * Usage: node scripts/generate_football_metadata.js
 */
const fs = require("fs");
const path = require("path");

const CSV_PATH = path.join(__dirname, "..", "archive", "players.csv");
const OUTPUT_PATH = path.join(
  __dirname,
  "..",
  "frontend-web",
  "convex",
  "data",
  "football_player_metadata.json",
);

function getEra(lastSeason) {
  const year = parseInt(lastSeason, 10);
  if (isNaN(year)) return "Unknown";
  if (year >= 2020) return "2020s";
  if (year >= 2010) return "2010s";
  if (year >= 2000) return "2000s";
  return "Pre-2000s";
}

function parseCSVLine(line) {
  const fields = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === "," && !inQuotes) {
      fields.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  fields.push(current);
  return fields;
}

const raw = fs.readFileSync(CSV_PATH, "utf-8");
const lines = raw.split("\n").filter((l) => l.trim());
const header = parseCSVLine(lines[0]);

// Find column indices
const idx = {};
for (const col of [
  "name",
  "current_club_name",
  "position",
  "country_of_citizenship",
  "last_season",
]) {
  idx[col] = header.indexOf(col);
  if (idx[col] === -1) {
    console.error(`Column "${col}" not found. Available: ${header.join(", ")}`);
    process.exit(1);
  }
}

const metadata = {};
let count = 0;

for (let i = 1; i < lines.length; i++) {
  const fields = parseCSVLine(lines[i]);
  const name = (fields[idx.name] || "").trim();
  if (!name) continue;

  metadata[name] = {
    club: (fields[idx.current_club_name] || "").trim() || "Unknown",
    position: (fields[idx.position] || "").trim() || "Unknown",
    nationality: (fields[idx.country_of_citizenship] || "").trim() || "Unknown",
    era: getEra(fields[idx.last_season] || ""),
  };
  count++;
}

fs.writeFileSync(OUTPUT_PATH, JSON.stringify(metadata));
console.log(`Generated metadata for ${count} players -> ${OUTPUT_PATH}`);
