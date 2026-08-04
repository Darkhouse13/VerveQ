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
import { canonicalFor, resolveRouteMeta } from "@/lib/routeMeta";

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

  useEffect(() => {
    const { title, description } = resolveRouteMeta(pathname);
    document.title = title;
    setMetaByName("description", description);
    setLinkByRel("canonical", canonicalFor(pathname));
  }, [pathname]);

  return null;
}
