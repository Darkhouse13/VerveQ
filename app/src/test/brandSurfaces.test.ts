/**
 * VerveQ ONE P4.4 — the brand off the app's own screens: app icons, the
 * WEEKEND receipt PNG, the duel share card, the reminder email and the SEO
 * pages' header all carry the mark and read their colors from the tokens.
 */
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { describe, expect, it } from "vitest";
import tokens from "@/styles/tokens.json";
import { brandColor } from "@/lib/brandTokens";
import { RECEIPT_COLORS } from "@/lib/receiptImage";
import {
  buildShareCardSvg,
  buildShareCardTexts,
  CARD_COLORS,
  OG_IMAGE_HEIGHT,
  OG_IMAGE_WIDTH,
} from "../../convex/lib/duelShareCard";
import { SHARE_CARD_FONT_BASE64 } from "../../convex/lib/shareCardFontData";
import { renderEmail } from "../../convex/whosOlderReminders";
import { BRAND_LOCKUP_SVG, renderBody, SEO_CSS } from "../../seo/lib.mjs";

const APP = path.resolve(__dirname, "../..");
const read = (p: string) => readFileSync(path.join(APP, p), "utf8");

/** Width, height and PNG color type (2 = RGB, 6 = RGBA) from the IHDR chunk. */
function pngInfo(file: string) {
  const b = readFileSync(path.join(APP, file));
  expect(b.subarray(1, 4).toString("ascii"), `${file} is not a PNG`).toBe("PNG");
  return { width: b.readUInt32BE(16), height: b.readUInt32BE(20), colorType: b[25] };
}

describe("app icons (scripts/generatePwaIcons.mjs)", () => {
  const ICONS: Array<[file: string, size: number, opaque: boolean]> = [
    ["public/vq-logo.png", 512, false],
    ["public/favicon-48x48.png", 48, false],
    ["public/pwa-192x192.png", 192, false],
    ["public/pwa-512x512.png", 512, false],
    ["public/pwa-maskable-512x512.png", 512, true],
    ["public/apple-touch-icon.png", 180, true],
    ["public/apple-touch-icon-180x180.png", 180, true],
    ["public/brand/instagram-avatar.png", 1080, true],
  ];
  for (const [file, size, opaque] of ICONS) {
    it(`${file} is ${size}×${size}${opaque ? ", no alpha channel" : ""}`, () => {
      const info = pngInfo(file);
      expect([info.width, info.height]).toEqual([size, size]);
      // iOS (and the masks of maskable/avatar) need no alpha AT ALL, not just alpha=255.
      expect(info.colorType).toBe(opaque ? 2 : 6);
    });
  }

  it("favicon.svg is the mark in the brand colors", () => {
    const svg = read("public/favicon.svg");
    expect(svg).toContain(`fill="${tokens.palette.ink.hex}"`);
    expect(svg).toContain(`fill="${tokens.palette.lime.hex}"`);
    expect(svg).toContain("rotate(-4 32 32)");
  });

  it("every icon reference carries the cache-busting version", () => {
    const html = read("index.html");
    expect(html).toContain('href="/favicon.svg?v=2"');
    expect(html).toContain('href="/apple-touch-icon.png?v=2"');
    expect(html).not.toContain('href="/vq-logo.png"');
    const vite = read("vite.config.ts");
    expect(vite).toMatch(/const ICON_VERSION = "2";/);
    expect(vite).toContain("/pwa-maskable-512x512.png?v=${ICON_VERSION}");
    for (const p of ["public/terms/index.html", "public/privacy/index.html"]) {
      expect(read(p)).toContain('href="/favicon.svg?v=2"');
    }
  });
});

describe("WEEKEND receipt PNG", () => {
  it("paints in the brand tokens, not literal colors", () => {
    expect(RECEIPT_COLORS.ground).toBe(brandColor("ink"));
    expect(RECEIPT_COLORS.text).toBe(brandColor("cream"));
    expect(RECEIPT_COLORS.accent).toBe(brandColor("lime"));
    const src = read("src/lib/receiptImage.ts");
    expect(src).not.toMatch(/"#[0-9a-f]{3,8}"/i);
    expect(src).toContain("drawBrandLockup(");
  });
});

describe("duel share card", () => {
  it("uses the ink brand's token values", () => {
    expect(CARD_COLORS.ink).toBe(tokens.palette.ink.hex);
    expect(CARD_COLORS.cream).toBe(tokens.palette.cream.hex);
    expect(CARD_COLORS.lime).toBe(tokens.palette.lime.hex);
    expect(CARD_COLORS.raised).toBe(tokens.theme.ink.card.hex);
    const svg = buildShareCardSvg(buildShareCardTexts({ found: true, challengerName: "Hamza", challengerScore: 740 }));
    expect(svg).not.toMatch(/#F97A1F|#FAEFDC/i); // the retired cream/orange card
  });

  it("renders to a 1200×630 PNG on the ink ground with the lime action", async () => {
    const require = createRequire(import.meta.url);
    const { initWasm, Resvg } = await import("@resvg/resvg-wasm");
    try {
      await initWasm(readFileSync(require.resolve("@resvg/resvg-wasm/index_bg.wasm")));
    } catch {
      // Already initialised by another suite in this worker.
    }
    const svg = buildShareCardSvg(buildShareCardTexts({ found: true, challengerName: "Hamza", challengerScore: 740 }));
    const r = new Resvg(svg, {
      fitTo: { mode: "width", value: OG_IMAGE_WIDTH },
      font: {
        fontBuffers: [Uint8Array.from(Buffer.from(SHARE_CARD_FONT_BASE64, "base64"))],
        loadSystemFonts: false,
        defaultFontFamily: "Space Grotesk",
      },
    });
    const img = r.render();
    expect([img.width, img.height]).toEqual([OG_IMAGE_WIDTH, OG_IMAGE_HEIGHT]);
    const px = (x: number, y: number) => Array.from(img.pixels.subarray((y * img.width + x) * 4, (y * img.width + x) * 4 + 3));
    // A ground pixel is ink, give or take the 6% lime stripe.
    const [r0, g0, b0] = px(4, 620);
    expect(Math.max(r0, g0, b0)).toBeLessThan(40);
    // The action pill (x 72.., y 470..550) is lime.
    expect(px(80, 478)).toEqual([0xc6, 0xff, 0x1a]);
  });
});

describe("reminder email", () => {
  it("carries the brand: ink ground, lime button, VERVEQ wordmark", () => {
    const { html } = renderEmail({
      heading: "One tap and you're in.",
      lines: ["line"],
      button: "Yes, remind me",
      href: "https://verveq.com/older",
      footer: "footer",
      unsubscribe: "https://x.convex.site/u",
    });
    expect(html).toContain(`background:${tokens.palette.ink.hex}`);
    expect(html).toMatch(new RegExp(`background:${tokens.palette.lime.hex};color:${tokens.palette.ink.hex}`));
    expect(html).toMatch(/letter-spacing:4px;color:#FFF7F0">VERVEQ</);
    expect(html).toContain(">VQ</td>");
  });
});

describe("SEO pages header", () => {
  it("is the ink bar with the outlined brand lockup", () => {
    const body = renderBody({ path: "/games/football-grid/", body: "<p>x</p>" });
    expect(body).toContain(BRAND_LOCKUP_SVG);
    expect(body).not.toContain("seo-word");
    expect(BRAND_LOCKUP_SVG).not.toContain("<text"); // outlines only — no font dependency
    expect(BRAND_LOCKUP_SVG).toContain(`fill="${tokens.palette.lime.hex}"`);
    expect(SEO_CSS).toContain("#seo .seo-top{background:var(--ink)");
    // Body copy keeps system fonts (the CLS fix).
    expect(SEO_CSS).toMatch(/#seo\{[^}]*font-family:system-ui/);
  });

  it("the home page still hides it", () => {
    expect(renderBody({ path: "/", body: "", hideHeader: true })).not.toContain("seo-lockup");
  });
});

describe("brand files", () => {
  it("docs/BRAND.md exists next to the overview", () => {
    expect(existsSync(path.join(APP, "../docs/BRAND.md"))).toBe(true);
  });
});
