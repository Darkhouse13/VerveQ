// Pure helpers for the duel share route (/s/d/:linkCode) and its OG taunt
// card. Free of Convex imports so the contract tests can exercise them
// directly, and shared by both the V8 http router and the node card renderer.

export const SHARE_ROUTE_PREFIX = "/s/d/";
export const CARD_IMAGE_SUFFIX = "/card.png";
export const APP_DUEL_URL_BASE = "https://verveq.com/duel/";
export const APP_HOME_URL = "https://verveq.com/";
// Cache key namespace for the non-personalized fallback card.
export const GENERIC_CARD_KEY = "__generic__";

export const OG_IMAGE_WIDTH = 1200;
export const OG_IMAGE_HEIGHT = 630;

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

// One-way version token for the og:image URL: it changes whenever the
// challenger's score state changes (busting WhatsApp's hard per-URL cache)
// without the score itself ever appearing in a URL.
export function cardVariantToken(
  cacheKey: string,
  challengerScore: number | null,
) {
  return hashString(`duel-card:${cacheKey}:${challengerScore ?? "pending"}`);
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

// 1200x630 neo-brutalist card: cream ground, hard black frame, orange badge
// and accent line. All text is XML-escaped; the renderer loads exactly one
// embedded font, so the card never depends on system fonts.
export function buildShareCardSvg(texts: {
  line1: string;
  line2: string;
  accent: string;
}): string {
  const line1 = escapeHtml(texts.line1);
  const line2 = escapeHtml(texts.line2);
  const accent = escapeHtml(texts.accent);
  const font = "Space Grotesk";
  return `<svg width="${OG_IMAGE_WIDTH}" height="${OG_IMAGE_HEIGHT}" viewBox="0 0 ${OG_IMAGE_WIDTH} ${OG_IMAGE_HEIGHT}" xmlns="http://www.w3.org/2000/svg">
  <rect width="1200" height="630" fill="#FAEFDC"/>
  <rect x="14" y="14" width="1172" height="602" fill="none" stroke="#111111" stroke-width="10"/>
  <rect x="940" y="-60" width="200" height="760" fill="#F97A1F" opacity="0.16" transform="rotate(12 1040 315)"/>
  <g transform="rotate(-3 170 110)">
    <rect x="64" y="72" width="220" height="68" fill="#F97A1F" stroke="#111111" stroke-width="6"/>
    <rect x="72" y="80" width="220" height="68" fill="none" stroke="#111111" stroke-width="6"/>
    <text x="174" y="119" font-family="${font}" font-size="34" font-weight="700" fill="#FFFFFF" text-anchor="middle">VERVEQ</text>
  </g>
  <text x="72" y="300" font-family="${font}" font-size="84" font-weight="700" fill="#111111">${line1}</text>
  <text x="72" y="392" font-family="${font}" font-size="84" font-weight="700" fill="#111111">${line2}</text>
  <g>
    <rect x="64" y="438" width="${Math.min(1060, 60 + accent.length * 34)}" height="86" fill="#111111"/>
    <text x="94" y="498" font-family="${font}" font-size="56" font-weight="700" fill="#F97A1F">${accent}</text>
  </g>
  <text x="1128" y="584" font-family="${font}" font-size="28" font-weight="700" fill="#111111" text-anchor="end">verveq.com</text>
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

// Last-resort 1x1 orange PNG so the card route can never 500 even if the
// renderer is unavailable. Crawlers simply show a text-only preview.
export const FALLBACK_PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==";
