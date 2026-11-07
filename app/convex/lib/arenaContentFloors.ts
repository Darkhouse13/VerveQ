// Bundled fallback question counts per Arena category: the static content
// floor create-time validation checks (categoryRoundCapacityFloor). Kept as
// plain numbers so the hot arena module never loads the question banks;
// src/test/arenaContentFloorsContract.test.ts asserts they equal the real
// bank sizes (ARENA_FALLBACK_SEEDS in challengeArenaSelection.ts).
export const ARENA_FALLBACK_SEED_COUNTS: Record<string, number> = {
  general_knowledge: 1149,
  which_came_first: 550,
  enterprise_logos: 144,
  capital_cities: 195,
  science: 624,
  world_history: 628,
  movies_tv: 623,
  music: 624,
  video_games: 624,
};
