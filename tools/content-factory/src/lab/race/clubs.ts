import type React from "react";

// Club colour ribbons — no crests, ever. Each club is its kit colours as a
// bar: `bg` is the body, `alt` the second colour (a bottom band on "band"
// bars, alternating vertical stripes on "stripes" bars — Juventus, Milan,
// Inter), `fg` the type colour when the club's name sits on its own colour.
export type ClubStyle = { bg: string; alt: string; fg: string; kind: "band" | "stripes" };

export const CLUBS: Record<string, ClubStyle> = {
  "Real Madrid": { bg: "#FFFFFF", alt: "#FEBE10", fg: "#111111", kind: "band" },
  Barcelona: { bg: "#A50044", alt: "#004D98", fg: "#FFFFFF", kind: "band" },
  Juventus: { bg: "#F4F4F4", alt: "#111111", fg: "#111111", kind: "stripes" },
  "AC Milan": { bg: "#E0131A", alt: "#111111", fg: "#FFFFFF", kind: "stripes" },
  Inter: { bg: "#0068A8", alt: "#111111", fg: "#FFFFFF", kind: "stripes" },
  "Bayern Munich": { bg: "#DC052D", alt: "#0066B2", fg: "#FFFFFF", kind: "band" },
  "Manchester United": { bg: "#DA291C", alt: "#FBE122", fg: "#FFFFFF", kind: "band" },
  "Manchester City": { bg: "#6CABDD", alt: "#1C2C5B", fg: "#111111", kind: "band" },
  "Paris Saint-Germain": { bg: "#004170", alt: "#DA291C", fg: "#FFFFFF", kind: "band" },
  Ajax: { bg: "#FFFFFF", alt: "#D2122E", fg: "#111111", kind: "band" },
  Benfica: { bg: "#E83030", alt: "#FFFFFF", fg: "#FFFFFF", kind: "band" },
  Blackpool: { bg: "#F68712", alt: "#FFFFFF", fg: "#111111", kind: "band" },
  "Borussia Dortmund": { bg: "#FDE100", alt: "#111111", fg: "#111111", kind: "band" },
  "Borussia Mönchengladbach": { bg: "#FFFFFF", alt: "#00A94F", fg: "#111111", kind: "band" },
  "Dukla Prague": { bg: "#8B1A1A", alt: "#F2C200", fg: "#FFFFFF", kind: "band" },
  "Dynamo Moscow": { bg: "#004B8D", alt: "#FFFFFF", fg: "#FFFFFF", kind: "band" },
  "Dynamo Kyiv": { bg: "#FFFFFF", alt: "#0057A8", fg: "#111111", kind: "band" },
  "Ferencváros": { bg: "#009045", alt: "#FFFFFF", fg: "#FFFFFF", kind: "band" },
  "Hamburger SV": { bg: "#005CA9", alt: "#111111", fg: "#FFFFFF", kind: "band" },
  Liverpool: { bg: "#C8102E", alt: "#00B2A9", fg: "#FFFFFF", kind: "band" },
  Marseille: { bg: "#2FAEE0", alt: "#FFFFFF", fg: "#111111", kind: "band" },
  "Inter Miami": { bg: "#F7B5CD", alt: "#111111", fg: "#111111", kind: "band" },
};

export const clubStyle = (c: string): ClubStyle => {
  const s = CLUBS[c];
  if (!s) throw new Error(`race: no colours for club "${c}"`);
  return s;
};

export const barFill = (s: ClubStyle): React.CSSProperties =>
  s.kind === "stripes"
    ? { backgroundColor: s.bg, backgroundImage: `repeating-linear-gradient(90deg, ${s.bg} 0 16px, ${s.alt} 16px 32px)` }
    : { backgroundColor: s.bg, backgroundImage: `linear-gradient(0deg, ${s.alt} 0 30%, transparent 30% 100%)` };
