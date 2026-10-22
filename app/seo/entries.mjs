/**
 * Link-preview cards for the SPA entry paths people actually share
 * (VerveQ ONE P2.4).
 *
 * /older, /letters, /weekend and /draw are client-rendered routes, so a link
 * preview (Instagram, WhatsApp, X, iMessage) only ever sees the HTML nginx
 * returns. seo/build.mjs writes one `entry/<id>.html` per card below — the app
 * shell with this card's og:/twitter: tags — and deploy/nginx.conf's
 * `$spa_shell` map serves it for each listed path. Everything else still gets
 * app-shell.html (the default card).
 *
 * The PNGs are committed (scripts/renderOgCards.mjs). Their file names carry a
 * version directory (og/v2/) because preview caches key on the image URL:
 * re-rendering in place would keep serving the old picture for weeks. Bump the
 * directory when a card's artwork changes.
 */
export const OG_VERSION = "v2";

/** The default card: the homepage, the app shell and every unlisted route. */
export const HOME_CARD = {
  id: "home",
  image: `/og/${OG_VERSION}/home.png`,
  ogTitle: "VerveQ — daily football games. Can you beat it?",
  ogDescription: "Who's Older, Missing Letters, Career Path and more. Free, no sign-up.",
  imageAlt: "VerveQ — daily football games. Can you beat it?",
};

export const ENTRY_CARDS = [
  {
    id: "older",
    paths: ["/older", "/whos-older"],
    image: `/og/${OG_VERSION}/older.png`,
    ogTitle: "Who's older? — VerveQ",
    ogDescription: "Who's older? Ten football pairs a day. Can you beat it?",
    imageAlt: "Who's older? Ten football pairs a day. Can you beat it?",
  },
  {
    id: "letters",
    paths: ["/letters", "/missing-letters"],
    image: `/og/${OG_VERSION}/letters.png`,
    ogTitle: "Missing Letters — VerveQ",
    ogDescription: "Name the footballer from the gaps. Ten names a day. Can you beat it?",
    imageAlt: "Missing Letters: name the footballer from the gaps. Ten names a day.",
  },
  {
    id: "weekend",
    paths: ["/weekend"],
    image: `/og/${OG_VERSION}/weekend.png`,
    ogTitle: "The Weekend — VerveQ",
    ogDescription: "Pick a squad. This weekend's real matches score it. Can you beat it?",
    imageAlt: "The Weekend: pick a squad, this weekend's real matches score it.",
  },
  {
    id: "draw",
    paths: ["/draw"],
    image: `/og/${OG_VERSION}/draw.png`,
    ogTitle: "The Draw — VerveQ",
    ogDescription: "One board a day. Draft six players, run the gauntlet. Can you beat it?",
    imageAlt: "The Draw: one board a day. Draft six players, run the gauntlet.",
  },
];
