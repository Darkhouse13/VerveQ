import { query } from "./_generated/server";

const SPORTS_CONFIG = [
  { name: "football", emoji: "⚽", color: "success", modes: ["quiz", "survival"] },
  { name: "tennis", emoji: "🎾", color: "accent", modes: ["quiz", "survival"] },
  { name: "basketball", emoji: "🏀", color: "primary", modes: ["quiz", "survival"] },
];

export const list = query({
  args: {},
  handler: async () => {
    return {
      sports: SPORTS_CONFIG.map((s) => s.name),
      count: SPORTS_CONFIG.length,
      config: SPORTS_CONFIG,
    };
  },
});
