/**
 * Applies per-route document metadata (SEO-1 Part 3).
 *
 * Renders nothing; mounted once inside the Router beside AnalyticsPageviews,
 * whose `useLocation` pattern this mirrors. On every navigation it writes
 * `document.title`, the description meta and the canonical link — the three
 * things a client-rendered app otherwise leaves frozen on the homepage's
 * values for the whole session.
 *
 * Tags are created if absent so the writes never silently no-op, but
 * `app/index.html` ships all three, so in practice this updates in place.
 */
import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { canonicalFor, localizeRouteMeta } from "@/lib/routeMeta";
import { isOnStaticPage, staticSeoPath } from "@/lib/seoPages";

/**
 * The head a static SEO page shipped with (app/seo/build.mjs). Captured once at
 * load, before any write below, so navigating into the app and Back again
 * restores the page's own title/description/canonical instead of the table's.
 */
const STATIC_HEAD = staticSeoPath()
  ? {
      title: document.title,
      description:
        document.head.querySelector<HTMLMetaElement>('meta[name="description"]')?.content ?? "",
      canonical:
        document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.href ?? "",
    }
  : null;

/** Find-or-create a `<meta name=...>` and set its content. */
function setMetaByName(name: string, content: string) {
  let tag = document.head.querySelector<HTMLMetaElement>(`meta[name="${name}"]`);
  if (!tag) {
    tag = document.createElement("meta");
    tag.setAttribute("name", name);
    document.head.appendChild(tag);
  }
  tag.setAttribute("content", content);
}

/** Find-or-create a `<link rel=...>` and set its href. */
function setLinkByRel(rel: string, href: string) {
  let tag = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
  if (!tag) {
    tag = document.createElement("link");
    tag.setAttribute("rel", rel);
    document.head.appendChild(tag);
  }
  tag.setAttribute("href", href);
}

export function RouteMeta() {
  const { pathname } = useLocation();
  // The tab title follows the UI language; re-run when it changes. No
  // Suspense: this sits above every boundary, and until the shell namespace
  // loads the English defaults are the right title anyway.
  const { t, i18n } = useTranslation("shell", { useSuspense: false });
  const language = i18n.resolvedLanguage ?? i18n.language;

  useEffect(() => {
    if (STATIC_HEAD && isOnStaticPage(pathname)) {
      document.title = STATIC_HEAD.title;
      setMetaByName("description", STATIC_HEAD.description);
      if (STATIC_HEAD.canonical) setLinkByRel("canonical", STATIC_HEAD.canonical);
      return;
    }
    const { title, description } = localizeRouteMeta(pathname, (key, options) =>
      String(t(key, options)),
    );
    document.title = title;
    setMetaByName("description", description);
    setLinkByRel("canonical", canonicalFor(pathname));
  }, [pathname, t, language]);

  return null;
}
