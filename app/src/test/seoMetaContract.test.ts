/**
 * SEO-1 contract — the indexable surface's metadata rules, enforced.
 *
 * The static `/games/` layer is the real indexable surface (the SPA is
 * client-rendered), so its head tags are load-bearing product surface, not
 * decoration. These assertions exist because every one of them was a
 * hand-check at ticket time and would silently rot otherwise: titles creep
 * past the SERP truncation budget, a new game page gets added without a
 * sitemap entry, or a www URL sneaks back in after the canonical
 * consolidation.
 */
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import {
  ROUTE_META,
  DEFAULT_META,
  TITLE_MAX,
  DESCRIPTION_MAX,
  resolveRouteMeta,
  canonicalFor,
} from "@/lib/routeMeta";

const read = (p: string) => readFileSync(p, "utf8");

/** Static pages that make up the indexable surface. */
const LANDING = "index.html";
const GAMES_DIR = "public/games";

function gamePages(): string[] {
  return readdirSync(GAMES_DIR, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => `${GAMES_DIR}/${e.name}/index.html`)
    .filter(existsSync);
}

/** Every static HTML page under audit: landing + /games/ index + game pages. */
const STATIC_PAGES = [LANDING, `${GAMES_DIR}/index.html`, ...gamePages()];

const pick = (html: string, re: RegExp) => {
  const m = html.match(re);
  return m ? m[1].trim() : null;
};
const title = (h: string) => pick(h, /<title>(.*?)<\/title>/s);
const description = (h: string) =>
  pick(h, /<meta name="description" content="(.*?)"/s);
const canonical = (h: string) =>
  pick(h, /<link rel="canonical" href="(.*?)"/s);

describe("static indexable surface — head tags", () => {
  it.each(STATIC_PAGES)("%s has a title within the SERP budget", (page) => {
    const t = title(read(page));
    expect(t, `${page} has no <title>`).toBeTruthy();
    expect(t!.length, `${page} title is ${t!.length} chars: ${t}`).toBeLessThanOrEqual(
      TITLE_MAX,
    );
  });

  it.each(STATIC_PAGES)("%s has a description within the SERP budget", (page) => {
    const d = description(read(page));
    expect(d, `${page} has no meta description`).toBeTruthy();
    expect(
      d!.length,
      `${page} description is ${d!.length} chars`,
    ).toBeLessThanOrEqual(DESCRIPTION_MAX);
  });

  it("every static page title is unique", () => {
    const titles = STATIC_PAGES.map((p) => title(read(p)));
    expect(new Set(titles).size).toBe(titles.length);
  });

  it.each(STATIC_PAGES)("%s self-references a non-www canonical", (page) => {
    const c = canonical(read(page));
    expect(c, `${page} has no canonical`).toBeTruthy();
    expect(c!.startsWith("https://verveq.com/"), `${page} canonical: ${c}`).toBe(true);
    expect(c).not.toContain("www.");
  });

  /**
   * The landing page is the SPA shell, so its single h1 is rendered by
   * ColdEntryScreen at runtime rather than sitting in the HTML; only the
   * static content pages carry an h1 in source.
   */
  it.each(STATIC_PAGES.filter((p) => p !== LANDING))(
    "%s has exactly one h1",
    (page) => {
      const h1s = read(page).match(/<h1[\s>]/g) ?? [];
      expect(h1s.length).toBe(1);
    },
  );

  it("the landing page's h1 is rendered by the cold-entry screen", () => {
    const screen = read("src/pages/shell/ColdEntryScreen.tsx");
    expect((screen.match(/<h1[\s>]/g) ?? []).length).toBe(1);
  });
});

describe("canonical host consolidation", () => {
  it("no static page references the www host", () => {
    for (const page of STATIC_PAGES) {
      expect(read(page), `${page} references www`).not.toContain("www.verveq.com");
    }
  });

  it("the funnel script reports only from the canonical host", () => {
    // Assert the allowlist itself, not the whole file — the surrounding
    // comment legitimately names the www host it is explaining the absence of.
    const funnel = read(`${GAMES_DIR}/funnel.js`);
    const hosts = funnel.match(/var PROD_HOSTS = \[(.*?)\];/s)?.[1];
    expect(hosts, "PROD_HOSTS allowlist not found").toBeTruthy();
    expect(hosts).toContain("verveq.com");
    expect(hosts).not.toContain("www.");
  });

  it("nginx 301s the www host to the apex, preserving path and query", () => {
    const conf = read("../deploy/nginx.conf");
    expect(conf).toContain("server_name www.verveq.com;");
    expect(conf).toContain("return 301 https://verveq.com$request_uri;");
  });
});

describe("sitemap ↔ static surface", () => {
  const sitemap = read("public/sitemap.xml");
  const locs = [...sitemap.matchAll(/<loc>(.*?)<\/loc>/g)].map((m) => m[1]);

  /** SPA-rendered routes that legitimately have no static file. */
  const SPA_ROUTES = new Set(["/privacy", "/terms"]);

  it("lists only non-www, absolute URLs", () => {
    expect(locs.length).toBeGreaterThan(0);
    for (const loc of locs) {
      expect(loc.startsWith("https://verveq.com/"), loc).toBe(true);
      expect(loc).not.toContain("www.");
    }
  });

  it("every sitemap URL resolves to a real page (no dead entries)", () => {
    for (const loc of locs) {
      const path = new URL(loc).pathname;
      if (path === "/" || SPA_ROUTES.has(path)) continue;
      // /games/foo/ is served from public/games/foo/index.html
      expect(existsSync(`public${path}index.html`), `${loc} has no static file`).toBe(
        true,
      );
    }
  });

  it("every static game page is in the sitemap (no orphans)", () => {
    const paths = new Set(locs.map((l) => new URL(l).pathname));
    for (const page of [`${GAMES_DIR}/index.html`, ...gamePages()]) {
      const path = page.replace(/^public/, "").replace(/index\.html$/, "");
      expect(paths.has(path), `${path} is not in the sitemap`).toBe(true);
    }
  });
});

describe("SPA route metadata", () => {
  it("keeps every title and description within the SERP budget", () => {
    for (const [path, meta] of Object.entries(ROUTE_META)) {
      expect(meta.title.length, `${path}: ${meta.title}`).toBeLessThanOrEqual(TITLE_MAX);
      expect(
        meta.description.length,
        `${path} description is ${meta.description.length}`,
      ).toBeLessThanOrEqual(DESCRIPTION_MAX);
    }
  });

  it("gives every route a distinct title", () => {
    const titles = Object.values(ROUTE_META).map((m) => m.title);
    expect(new Set(titles).size).toBe(titles.length);
  });

  /**
   * The fallback must stay byte-identical to the shipped shell, or an unlisted
   * route would advertise metadata the served HTML never had.
   */
  it("falls back to the landing page's own head values", () => {
    const html = read(LANDING);
    expect(DEFAULT_META.title).toBe(title(html));
    expect(DEFAULT_META.description).toBe(description(html));
    expect(resolveRouteMeta("/does-not-exist")).toEqual(DEFAULT_META);
  });

  it("normalises a trailing slash", () => {
    expect(resolveRouteMeta("/compete/")).toEqual(ROUTE_META["/compete"]);
    expect(canonicalFor("/compete/")).toBe("https://verveq.com/compete");
  });

  it("builds self-referencing non-www canonicals", () => {
    expect(canonicalFor("/")).toBe("https://verveq.com/");
    expect(canonicalFor("/v2/daily")).toBe("https://verveq.com/v2/daily");
  });
});
