/**
 * Compete → Play contract (VerveQ ONE decision 10).
 *
 * History: Compete used to be a drill (category → sport → mode grid), then a
 * one-step mode grid behind its own tab. Decision 10 merged it into PLAY: 12 of
 * its 15 entries already sat on Home, so the two catalogues became one tab.
 * The Compete screen is gone; its URLs are not — SEO pages and old links point
 * at them.
 *
 * Locked here:
 *  1. Routing — every Compete URL (`/compete`, `/compete/sport`,
 *     `/compete/sport/:sport`, `/sport-select`) lands on Play with the More
 *     games catalogue open (`#more`), keeping incoming params, and an incoming
 *     `#anchor` wins over the default. Mirrors the App.tsx route table.
 *  2. Catalogue — every live mode sits in exactly ONE of Play's sections
 *     (Today · Featured · With friends · More games), so nothing the grid
 *     offered was dropped and nothing is offered twice.
 *  3. Tile targets — Arena and Duels stay reachable and DISTINCT (the "send a
 *     link" and "live room" halves of Challenge a friend), and every tile
 *     routes to a concrete deep link.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route, useLocation } from "react-router-dom";

import { LegacyRedirect } from "@/components/LegacyRedirect";
import {
  COMPETE_MODE_TILES,
  COMPETE_KNOWLEDGE_TILES,
  PLAY_FEATURED_KEYS,
  PLAY_FRIEND_KEYS,
  PLAY_MORE_KEYS,
  PLAY_TODAY_KEYS,
} from "@/pages/shell/competeModeTiles";
import { SHELL_ROUTES } from "@/lib/shellRoutes";

function LocationProbe() {
  const loc = useLocation();
  return <div data-testid="location">{`${loc.pathname}${loc.search}${loc.hash}`}</div>;
}

/** Mirror the App.tsx route table for the legacy Compete URLs. */
function renderAt(entry: string) {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route path="/compete" element={<LegacyRedirect to="/home#more" />} />
        <Route path="/compete/sport" element={<LegacyRedirect to="/home#more" />} />
        <Route path="/compete/sport/:sport" element={<LegacyRedirect to="/home#more" />} />
        <Route path="/sport-select" element={<LegacyRedirect to="/home#more" />} />
        <Route path="/home" element={<div data-testid="play">PLAY</div>} />
      </Routes>
      <LocationProbe />
    </MemoryRouter>,
  );
}

const location = () => screen.getByTestId("location").textContent;

describe("Compete URLs land on Play (decision 10)", () => {
  it.each(["/compete", "/compete/sport", "/compete/sport/football", "/compete/sport/basketball", "/sport-select"])(
    "%s → Play with More games open",
    (entry) => {
      renderAt(entry);
      expect(screen.getByTestId("play")).toBeTruthy();
      expect(location()).toBe("/home#more");
    },
  );

  it("keeps incoming params", () => {
    renderAt("/compete?utm_source=seo");
    expect(location()).toBe("/home?utm_source=seo#more");
  });

  it("an incoming #anchor wins over the default", () => {
    renderAt("/compete#today");
    expect(location()).toBe("/home#today");
  });

  it("is wired that way in App.tsx (source contract)", () => {
    const app = readFileSync("src/App.tsx", "utf8");
    for (const path of ["/compete", "/compete/sport", "/compete/sport/:sport", "/sport-select"]) {
      expect(app).toContain(`path="${path}" element={<LegacyRedirect to="/home#more" />}`);
    }
    // The Compete screen itself is gone — no route may mount it again.
    expect(app).not.toContain("CompeteModeGridScreen");
  });

  it("the deprecated route names point at Play, not a dead screen", () => {
    expect(SHELL_ROUTES.compete).toBe(SHELL_ROUTES.play);
    expect(SHELL_ROUTES.competeSportGrid("football")).toBe("/home#more");
  });
});

describe("Play's sections hold every live mode exactly once", () => {
  const sections: Record<string, string[]> = {
    today: [...PLAY_TODAY_KEYS],
    featured: [...PLAY_FEATURED_KEYS],
    friends: [...PLAY_FRIEND_KEYS],
    more: [...PLAY_MORE_KEYS],
  };
  const placed = Object.values(sections).flat();

  it("no mode is offered twice", () => {
    expect(new Set(placed).size).toBe(placed.length);
  });

  it("every football mode has a section", () => {
    expect([...placed].sort()).toEqual(COMPETE_MODE_TILES.map((t) => t.key).sort());
  });

  it("matches decision 10's order", () => {
    expect(sections.today).toEqual(["whosOlder", "missingLetters", "daily", "dailySurvival"]);
    expect(sections.featured).toEqual(["careerPath"]);
    expect(sections.friends).toEqual(["duel", "arena"]);
    // Decision 11: Blitz and Higher or Lower are demoted into More games.
    expect(sections.more).toEqual(["quiz", "survival", "verveGrid", "higherLower", "blitz"]);
  });

  it("More games also closes with the general-knowledge quizzes", () => {
    const play = readFileSync("src/pages/shell/ShellHomeScreen.tsx", "utf8");
    expect(play).toContain("...tilesByKeys(PLAY_MORE_KEYS), ...COMPETE_KNOWLEDGE_TILES");
  });

  it("the Ranked chip comes from the tile's own flag", () => {
    const ranked = COMPETE_MODE_TILES.filter((t) => t.ranked).map((t) => t.key);
    expect(ranked).toEqual(["quiz", "survival"]);
    expect(ranked.every((k) => sections.more.includes(k))).toBe(true);
  });
});

describe("Play tile targets (real config)", () => {
  const tileTarget = (key: string) => {
    const tile = COMPETE_MODE_TILES.find((t) => t.key === key);
    expect(tile, `tile "${key}" must stay in the catalogue`).toBeTruthy();
    return tile!.to("football");
  };

  it("keeps Arena and Duels reachable — and DISTINCT (arena hub vs duels hub)", () => {
    expect(tileTarget("arena")).toBe(SHELL_ROUTES.arena);
    expect(tileTarget("duel")).toBe(SHELL_ROUTES.duels);
    expect(SHELL_ROUTES.arena).not.toBe(SHELL_ROUTES.duels);
  });

  it("Challenge a friend opens both halves", () => {
    const play = readFileSync("src/pages/shell/ShellHomeScreen.tsx", "utf8");
    expect(play).toContain("navigate(SHELL_ROUTES.duels)");
    expect(play).toContain("navigate(SHELL_ROUTES.arena)");
  });

  it("routes every tile to a concrete path (no dead tiles)", () => {
    for (const tile of COMPETE_MODE_TILES) {
      expect(tile.to("football")).toMatch(/^\//);
    }
  });

  it("surfaces Knowledge + Which Came First on the knowledge quiz flow", () => {
    const byKey = Object.fromEntries(
      COMPETE_KNOWLEDGE_TILES.map((tile) => [tile.key, tile.to("football")]),
    );
    expect(byKey.knowledgeQuiz).toBe(
      "/difficulty?sport=knowledge&mode=quiz&target=v2",
    );
    expect(byKey.cameFirst).toBe(
      "/difficulty?sport=knowledge&mode=came_first&target=v2",
    );
    // Sport-fixed: the carried sport must never leak into a knowledge target.
    for (const tile of COMPETE_KNOWLEDGE_TILES) {
      expect(tile.to("basketball")).toContain("sport=knowledge");
    }
  });
});
