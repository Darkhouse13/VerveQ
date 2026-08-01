// "THE WALL" — nine career paths at once, and a claim about what your score
// says about you.
//
// The mechanic being copied here is density, not narrative. A reel that puts a
// large, scannable puzzle fully on screen at frame 0 earns its watch time in a
// way animation cannot: viewers stop, scrub back, and pause — and a pause is
// worth more than any cut. So nothing is revealed progressively; the whole
// wall is there from the first frame and a clock runs down over it.
//
// Only two of the nine are ever answered on screen: enough to prove the answers
// exist and to let a viewer confirm two guesses (the validation that makes them
// comment a score), not enough to end the puzzle.
export const FPS = 30;
export const TOTAL = 390; // 13.0s

export type Cell = { clubs: string[]; answer: string };

// Sourced from app/convex/data/football_career_paths.json, each path copied
// WHOLE (never truncated — a shortened path is a different, usually ambiguous
// puzzle). Deliberately mixed easy/hard: the wall has to LOOK winnable or
// nobody starts.
//
// CASTING LAW: all nine answers are names a casual fan knows on sight. The
// first cut ran Rodri / Marquinhos / Chiesa / Havertz / Gabriel Jesus — nine
// correct paths, five forgettable subjects, and a wall of forgettable subjects
// is a wall nobody screenshots. Nine S-tier names make the SAME grid feel
// beatable, which is what makes someone comment a score.
export const CELLS: Cell[] = [
  { clubs: ["Monaco", "Paris Saint-Germain", "Real Madrid"], answer: "MBAPPÉ" }, // cp-mbappe
  { clubs: ["Ajax", "Inter Milan", "Arsenal"], answer: "BERGKAMP" }, // cp-bergkamp
  { clubs: ["Everton", "Manchester United", "Everton", "D.C. United", "Derby County"], answer: "ROONEY" }, // cp-rooney
  { clubs: ["Groningen", "Celtic", "Southampton", "Liverpool"], answer: "VAN DIJK" }, // cp-van-dijk
  { clubs: ["Barcelona", "Vissel Kobe", "Emirates Club"], answer: "INIESTA" }, // cp-iniesta
  { clubs: ["Independiente", "Atlético Madrid", "Manchester City", "Barcelona"], answer: "AGÜERO" }, // cp-aguero
  { clubs: ["Sevilla", "Real Madrid", "Paris Saint-Germain", "Sevilla", "Monterrey"], answer: "SERGIO RAMOS" }, // cp-sergio-ramos
  { clubs: ["Santos", "Barcelona", "Paris Saint-Germain", "Al-Hilal", "Santos"], answer: "NEYMAR" }, // cp-neymar
  { clubs: ["Southampton", "Blackburn Rovers", "Newcastle United"], answer: "SHEARER" }, // cp-alan-shearer
];

// the two that get answered — the two most gettable, on purpose. 01 and 05 are
// also the two the caption names, so a viewer can check their own two.
export const REVEALED = [0, 4];
export const REVEAL_AT = [300, 318];

export const CLOCK_FRAMES = 300; // 10s on the clock, over the wall
export const VERDICT_AT = 336; // the "other seven" slam
