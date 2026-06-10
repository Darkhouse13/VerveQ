/**
 * Public-pages contract: the launch/app-store surfaces can't silently regress
 * to the SPA soft-404 pattern.
 *
 *  - /privacy and /terms render REAL content (headings, substantive sections,
 *    a contact address) with no auth and no feature flag;
 *  - public/sitemap.xml is a real sitemap on the verveq.com origin listing the
 *    truly public pages, and robots.txt advertises it;
 *  - deploy/nginx.conf serves robots.txt + sitemap.xml as static files (they
 *    carry no asset extension, so without explicit locations they fall through
 *    to the SPA fallback and return the app shell), and splits caching:
 *    no-cache for the HTML shell, long-cache for hashed assets.
 */
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import PrivacyScreen from "@/pages/legal/PrivacyScreen";
import TermsScreen from "@/pages/legal/TermsScreen";

const read = (rel: string) =>
  readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8");

describe("legal pages render real content", () => {
  it("/privacy has a real privacy policy", () => {
    render(
      <MemoryRouter initialEntries={["/privacy"]}>
        <PrivacyScreen />
      </MemoryRouter>,
    );
    // By role: "Privacy Policy" also appears as a LegalLayout footer link.
    expect(
      screen.getByRole("heading", { level: 1, name: "Privacy Policy" }),
    ).toBeTruthy();
    expect(screen.getByText("Information we collect")).toBeTruthy();
    expect(screen.getByText(/Retention and deletion/)).toBeTruthy();
    expect(screen.getByText(/security@verveq\.com/)).toBeTruthy();
  });

  it("/terms has real terms of service", () => {
    render(
      <MemoryRouter initialEntries={["/terms"]}>
        <TermsScreen />
      </MemoryRouter>,
    );
    // By role: "Terms of Service" also appears as a LegalLayout footer link.
    expect(
      screen.getByRole("heading", { level: 1, name: "Terms of Service" }),
    ).toBeTruthy();
    expect(screen.getByText("Fair play")).toBeTruthy();
    expect(screen.getByText("Suspension and termination")).toBeTruthy();
    expect(screen.getByText(/security@verveq\.com/)).toBeTruthy();
  });

  it("App.tsx mounts them as public routes (no auth guard, no shell gate)", () => {
    const app = read("../App.tsx");
    expect(app).toMatch(/path="\/privacy" element={<PrivacyScreen \/>}/);
    expect(app).toMatch(/path="\/terms" element={<TermsScreen \/>}/);
  });
});

describe("sitemap.xml + robots.txt", () => {
  it("public/sitemap.xml is a real sitemap on the verveq.com origin", () => {
    const sitemap = read("../../public/sitemap.xml");
    expect(sitemap).toContain("<urlset");
    expect(sitemap).toContain("<loc>https://verveq.com/</loc>");
    expect(sitemap).toContain("<loc>https://verveq.com/privacy</loc>");
    expect(sitemap).toContain("<loc>https://verveq.com/terms</loc>");
  });

  it("public/robots.txt allows crawling and advertises the sitemap", () => {
    const robots = read("../../public/robots.txt");
    expect(robots).toMatch(/User-agent: \*\s+Allow: \//);
    expect(robots).toContain("Sitemap: https://verveq.com/sitemap.xml");
  });
});

describe("nginx serves the crawler files and splits caching", () => {
  const nginx = read("../../../deploy/nginx.conf");

  it("serves robots.txt and sitemap.xml as static files (no SPA fallback)", () => {
    expect(nginx).toMatch(/location = \/robots\.txt\s*{[^}]*try_files \$uri =404/);
    expect(nginx).toMatch(/location = \/sitemap\.xml\s*{[^}]*try_files \$uri =404/);
  });

  it("no-cache for the HTML shell, long-cache for hashed assets", () => {
    expect(nginx).toMatch(/location = \/index\.html\s*{[^}]*no-cache/);
    expect(nginx).toMatch(/location \/\s*{[^}]*no-cache/);
    expect(nginx).toMatch(/\(js\|css\|[^)]*\)\$[\s\S]{0,200}immutable/);
  });
});
