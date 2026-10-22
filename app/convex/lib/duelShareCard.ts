// Pure helpers for the duel share route (/s/d/:linkCode) and its OG taunt
// card. Free of Convex imports so the contract tests can exercise them
// directly, and shared by both the V8 http router and the node card renderer.

// The brand mark's outlines, shared with <BrandMark /> (a few KB of path data).
import brandGeometry from "../../src/components/ui/brandMark.geometry.json";

export const SHARE_ROUTE_PREFIX = "/s/d/";
export const CARD_IMAGE_SUFFIX = "/card.png";
export const APP_DUEL_URL_BASE = "https://verveq.com/duel/";
export const APP_HOME_URL = "https://verveq.com/";
// Cache key namespace for the non-personalized fallback card.
export const GENERIC_CARD_KEY = "__generic__";

export const OG_IMAGE_WIDTH = 1200;
export const OG_IMAGE_HEIGHT = 630;

// Public host for og:image (and any other share-facing URL): the configured
// vanity base (SHARE_PUBLIC_BASE_URL, e.g. https://verveq.com — nginx proxies
// /s/d/* through to this deployment) with the request origin as fallback so
// un-configured deployments keep working off their own .convex.site host.
export function resolveSharePublicBase(
  configured: string | undefined | null,
  requestOrigin: string,
): string {
  const trimmed = (configured ?? "").trim().replace(/\/+$/, "");
  if (/^https?:\/\/[^\s/]+$/i.test(trimmed)) return trimmed;
  return requestOrigin;
}

// Same hash family duels.ts uses for seeds and guest tokens (cyrb53-style).
function hashString(value: string) {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < value.length; i += 1) {
    const ch = value.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
  h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
  h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return `${(h2 >>> 0).toString(16).padStart(8, "0")}${(h1 >>> 0)
    .toString(16)
    .padStart(8, "0")}`;
}

// The card's artwork generation. Part of the variant token, so a restyle
// misses every cached render (duelShareCards rows and crawler caches alike)
// instead of serving the old picture. Bump it whenever buildShareCardSvg's
// look changes. 2 = the ink brand (VerveQ ONE P4.4).
export const CARD_STYLE_VERSION = 2;

// One-way version token for the og:image URL: it changes whenever the
// challenger's score state changes (busting WhatsApp's hard per-URL cache)
// without the score itself ever appearing in a URL.
export function cardVariantToken(
  cacheKey: string,
  challengerScore: number | null,
) {
  return hashString(
    `duel-card:v${CARD_STYLE_VERSION}:${cacheKey}:${challengerScore ?? "pending"}`,
  );
}

// Link-preview fetchers. iMessage masquerades as facebookexternalhit +
// Twitterbot; WhatsApp sends "WhatsApp/2.x". An absent UA is treated as a
// crawler so headless prefetchers never pollute link_tap.
const CRAWLER_UA_RE =
  /bot|crawl|spider|preview|fetch|scrape|embed|external|facebookexternalhit|facebookcatalog|whatsapp|twitterbot|slackbot|telegrambot|discordbot|linkedinbot|skypeuripreview|vkshare|pinterest|redditbot|applebot|googlebot|bingbot|duckduckbot|yandex|baiduspider|petalbot|snapchat|viber|iframely|opengraph|metainspector|inspectiontool|validator|curl\/|wget\//i;

export function isCrawlerUserAgent(userAgent: string | null): boolean {
  if (!userAgent || !userAgent.trim()) return true;
  return CRAWLER_UA_RE.test(userAgent);
}

// /s/d/<linkCode> → page, /s/d/<linkCode>/card.png → card image.
export function parseShareRoutePath(
  pathname: string,
): { linkCode: string; kind: "page" | "card" } | null {
  if (!pathname.startsWith(SHARE_ROUTE_PREFIX)) return null;
  let rest = pathname.slice(SHARE_ROUTE_PREFIX.length);
  let kind: "page" | "card" = "page";
  if (rest.endsWith(CARD_IMAGE_SUFFIX)) {
    kind = "card";
    rest = rest.slice(0, -CARD_IMAGE_SUFFIX.length);
  }
  rest = rest.replace(/\/+$/, "");
  let linkCode: string;
  try {
    linkCode = decodeURIComponent(rest).trim();
  } catch {
    return null;
  }
  if (!/^[A-Za-z0-9]{4,32}$/.test(linkCode)) return null;
  return { linkCode, kind };
}

export type ShareCardData = {
  found: boolean;
  challengerName: string | null;
  challengerScore: number | null;
};

export type ShareCardTexts = {
  // OG/Twitter meta
  title: string;
  description: string;
  // Card image copy (three stacked lines, neo-brutalist)
  line1: string;
  line2: string;
  accent: string;
};

function clampName(name: string, max = 18): string {
  const trimmed = name.trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max - 1).trimEnd()}…`;
}

// Card data is resolved server-side from the linkCode and exposes ONLY the
// challenger's display label and score — never opponent data, answers,
// checksums, aliases, or emails. Lookup failure degrades to a generic,
// non-personalized card.
export function buildShareCardTexts(data: ShareCardData): ShareCardTexts {
  if (data.found && data.challengerName) {
    const name = clampName(data.challengerName);
    if (data.challengerScore !== null) {
      return {
        title: `${name} scored ${data.challengerScore}. Your move.`,
        description:
          "Beat their score in a head-to-head VerveQ duel — tap to play.",
        line1: name,
        line2: `scored ${data.challengerScore}.`,
        accent: "YOUR MOVE.",
      };
    }
    return {
      title: `${name} challenged you — can you beat them?`,
      description: "A VerveQ duel is waiting. Tap to play.",
      line1: name,
      line2: "challenged you.",
      accent: "CAN YOU BEAT THEM?",
    };
  }
  return {
    title: "You've been challenged on VerveQ",
    description: "A head-to-head trivia duel is waiting. Tap to play.",
    line1: "You've been",
    line2: "challenged.",
    accent: "TAP TO PLAY.",
  };
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// 1200x630 card on the ink brand (VerveQ ONE P4.4), the same look as the
// per-game link cards (scripts/renderOgCards.mjs): ink ground with a faint
// lime stripe, the mark + VERVEQ lockup, cream headline, the one lime action.
// The mark and the wordmark are glyph OUTLINES (brandMark.geometry.json), so
// the renderer's single embedded font (Space Grotesk) is only needed for the
// copy. All text is XML-escaped; no system font is ever consulted.
//
// Colors mirror the --ink / --cream / --lime tokens in src/index.css
// (src/styles/tokens.json; duelShareFunnelContract.test.ts holds the parity).
export const CARD_COLORS = {
  ink: "#121212",
  cream: "#FFF7F0",
  lime: "#C6FF1A",
  raised: "#1F1F1F",
} as const;

// Space Grotesk Bold advance widths for U+0020..U+007E, in 1/1000 em, read
// off the embedded font with resvg. Used to fit the headline without a
// layout engine; anything outside ASCII counts as ADV_DEFAULT.
const ADV = [
  254, 298, 514, 636, 606, 758, 591, 294, 398, 390, 540, 620, 294, 432, 298, 388, 648, 452, 594, 608, 636,
  600, 618, 554, 600, 618, 298, 298, 620, 620, 620, 578, 1014, 634, 664, 644, 666, 554, 534, 662, 656, 264,
  610, 626, 542, 882, 670, 676, 604, 676, 632, 606, 588, 672, 618, 898, 644, 624, 576, 358, 388, 358, 620,
  620, 296, 578, 638, 586, 638, 577, 436, 638, 616, 266, 268, 564, 266, 854, 616, 612, 638, 638, 396, 524,
  456, 616, 548, 784, 592, 616, 518, 466, 258, 466, 620,
];
const ADV_DEFAULT = 640;

/** Approximate rendered width of `text` in Space Grotesk Bold at `size` px. */
export function textWidth(text: string, size: number, letterSpacing = 0): number {
  let units = 0;
  let n = 0;
  for (const ch of text) {
    const code = ch.codePointAt(0) ?? 0;
    units += code >= 32 && code < 127 ? ADV[code - 32] : ADV_DEFAULT;
    n += 1;
  }
  return (units / 1000) * size + Math.max(0, n - 1) * letterSpacing;
}

function fitSize(lines: string[], max: number, min: number, maxWidth: number, spacing: number) {
  let size = max;
  while (size > min && lines.some((l) => textWidth(l, size, spacing) > maxWidth)) size -= 2;
  return size;
}

const { mark: MARK, wordmark: WORD } = brandGeometry;

function markSvg(x: number, y: number, size: number): string {
  const k = size / MARK.viewBox;
  const half = MARK.viewBox / 2;
  const inset = (MARK.viewBox - MARK.square.size) / 2;
  const glyphs = MARK.letters.glyphs.map((g) => `<path transform="translate(${g.x} 0)" d="${g.d}"/>`).join("");
  return (
    `<g transform="translate(${x} ${y}) scale(${k})"><g transform="rotate(${MARK.tilt} ${half} ${half})">` +
    `<rect x="${inset}" y="${inset}" width="${MARK.square.size}" height="${MARK.square.size}" rx="${MARK.square.radius}" fill="${CARD_COLORS.ink}"/>` +
    `<rect x="${inset + 0.75}" y="${inset + 0.75}" width="${MARK.square.size - 1.5}" height="${MARK.square.size - 1.5}" rx="${MARK.square.radius - 0.75}" fill="none" stroke="${CARD_COLORS.cream}" stroke-opacity="0.22" stroke-width="1.5"/>` +
    `<g fill="${CARD_COLORS.lime}" transform="translate(${MARK.letters.x} ${MARK.letters.baseline}) scale(${MARK.letters.scale})">${glyphs}</g>` +
    `</g></g>`
  );
}

function wordmarkSvg(x: number, y: number, cap: number): string {
  const k = cap / WORD.capHeight;
  const glyphs = [...WORD.text]
    .map(
      (c, i) =>
        `<path transform="translate(${i * (WORD.advance + WORD.tracking)} 0)" d="${(WORD.glyphs as Record<string, string>)[c]}"/>`,
    )
    .join("");
  return `<g fill="${CARD_COLORS.cream}" transform="translate(${x} ${y}) scale(${k.toFixed(5)})">${glyphs}</g>`;
}

export function buildShareCardSvg(texts: {
  line1: string;
  line2: string;
  accent: string;
}): string {
  const { ink, cream, lime, raised } = CARD_COLORS;
  const font = "Space Grotesk";
  const W = OG_IMAGE_WIDTH;
  const H = OG_IMAGE_HEIGHT;
  const PAD = 72;

  // Headline: both lines at one size, fitted to the copy column.
  const hSize = fitSize([texts.line1, texts.line2], 100, 52, 760, -2);
  const ctaY = 470;
  const line2Base = ctaY - 44;
  const line1Base = line2Base - Math.round(hSize * 1.02);
  const eyebrowBase = line1Base - Math.round(hSize * 0.8) - 24;

  // The one action: lime pill, ink lettering, sized to its words.
  const aSize = fitSize([texts.accent], 40, 26, 760, 0);
  const pillW = Math.round(textWidth(texts.accent, aSize) + 64);

  // Hero: two cards face to face — the duel — top right, clear of the copy.
  const card = (cx: number, cy: number, rot: number, stroke: string, label: string) =>
    `<g transform="rotate(${rot} ${cx} ${cy})">` +
    `<rect x="${cx - 70 + 8}" y="${cy - 98 + 8}" width="140" height="196" rx="16" fill="#000000"/>` +
    `<rect x="${cx - 70}" y="${cy - 98}" width="140" height="196" rx="16" fill="${raised}" stroke="${stroke}" stroke-width="5"/>` +
    `<text x="${cx}" y="${cy + 33}" font-family="${font}" font-size="96" font-weight="700" fill="${stroke}" text-anchor="middle">${label}</text>` +
    `</g>`;
  const hero =
    card(930, 180, -8, lime, "?") +
    card(1066, 214, 6, cream, "?") +
    `<circle cx="1000" cy="206" r="34" fill="${cream}" stroke="${ink}" stroke-width="5"/>` +
    `<text x="1000" y="217" font-family="${font}" font-size="28" font-weight="700" fill="${ink}" text-anchor="middle">VS</text>`;

  // Ground: ink with a faint lime diagonal stripe (22-wide bars every 56,
  // rotated -30°). Plain rects, not a <pattern>: resvg rasterises a pattern
  // fill ~7× slower, and a cold render must beat WhatsApp's preview timeout.
  const bars: string[] = [];
  for (let k = -36; k <= 36; k++) {
    bars.push(`<rect x="${k * 56}" y="-4000" width="22" height="8000"/>`);
  }

  return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${W}" height="${H}" fill="${ink}"/>
  <g fill="${lime}" fill-opacity="0.06" transform="rotate(-30)">${bars.join("")}</g>
  ${hero}
  ${markSvg(PAD - 4, PAD, 76)}
  ${wordmarkSvg(PAD + 76 + 18, PAD + 38 + 11, 22)}
  <text x="${PAD}" y="${eyebrowBase}" font-family="${font}" font-size="24" font-weight="700" fill="${lime}" letter-spacing="4">HEAD-TO-HEAD DUEL</text>
  <text x="${PAD - 4}" y="${line1Base}" font-family="${font}" font-size="${hSize}" font-weight="700" fill="${cream}" letter-spacing="-2">${escapeHtml(texts.line1)}</text>
  <text x="${PAD - 4}" y="${line2Base}" font-family="${font}" font-size="${hSize}" font-weight="700" fill="${cream}" letter-spacing="-2">${escapeHtml(texts.line2)}</text>
  <rect x="${PAD}" y="${ctaY}" width="${pillW}" height="80" rx="10" fill="${lime}"/>
  <text x="${PAD + 32}" y="${ctaY + 54}" font-family="${font}" font-size="${aSize}" font-weight="700" fill="${ink}">${escapeHtml(texts.accent)}</text>
  <text x="${W - PAD}" y="${H - 52}" font-family="${font}" font-size="24" font-weight="700" fill="${cream}" fill-opacity="0.62" text-anchor="end" letter-spacing="1">verveq.com</text>
</svg>`;
}

// Minimal crawler-facing HTML: per-link OG/Twitter tags and nothing else.
// Carries no opponent data, answers, checksums, aliases, or emails, and no
// score or PII in any URL. The meta-refresh is a graceful fallback for a
// human who somehow receives the crawler document.
export function buildCrawlerHtml(args: {
  title: string;
  description: string;
  imageUrl: string;
  duelUrl: string;
}): string {
  const title = escapeHtml(args.title);
  const description = escapeHtml(args.description);
  const imageUrl = escapeHtml(args.imageUrl);
  const duelUrl = escapeHtml(args.duelUrl);
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${title}</title>
<meta name="description" content="${description}">
<meta property="og:site_name" content="VerveQ">
<meta property="og:type" content="website">
<meta property="og:title" content="${title}">
<meta property="og:description" content="${description}">
<meta property="og:url" content="${duelUrl}">
<meta property="og:image" content="${imageUrl}">
<meta property="og:image:type" content="image/png">
<meta property="og:image:width" content="${OG_IMAGE_WIDTH}">
<meta property="og:image:height" content="${OG_IMAGE_HEIGHT}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${title}">
<meta name="twitter:description" content="${description}">
<meta name="twitter:image" content="${imageUrl}">
<meta http-equiv="refresh" content="0;url=${duelUrl}">
</head>
<body>
<p><a href="${duelUrl}">Play the duel on VerveQ</a></p>
</body>
</html>`;
}

// Last-resort 1x1 ink (#121212) PNG so the card route can never 500 even if
// the renderer is unavailable. Crawlers simply show a text-only preview.
export const FALLBACK_PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR42mMQEhICAABwADd8QYvdAAAAAElFTkSuQmCC";
