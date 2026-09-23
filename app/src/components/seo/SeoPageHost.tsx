/**
 * Bridges the static SEO layer (app/seo/build.mjs) and the SPA. Mounted once
 * inside the Router. Renders nothing.
 *
 * - Shows the server-rendered `#seo` block only while the location is the page
 *   it belongs to: a Play tap navigates into the game client-side, the block
 *   hides, and Back brings it back without a reload.
 * - Routes `a[data-spa]` launch links through the router so the game opens with
 *   no page load (the bundle is already here).
 * - Starts the curiosity funnel on a static page's first render.
 */
import { useEffect, useLayoutEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { isOnStaticPage, isSeoPath, staticSeoPath } from "@/lib/seoPages";
import { startSeoFunnel } from "@/lib/seoFunnel";

export function SeoPageHost() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { accountState } = useAuth();

  // Visibility of the static block.
  useEffect(() => {
    const el = document.getElementById("seo");
    if (!el) return;
    const visible = isOnStaticPage(pathname);
    el.style.display = visible ? "" : "none";
    document.documentElement.classList.toggle("seo-static-page", visible);
  }, [pathname]);

  // Client-side launch links.
  useEffect(() => {
    if (!staticSeoPath()) return;
    const onClick = (ev: MouseEvent) => {
      if (ev.defaultPrevented || ev.button !== 0 || ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.altKey) return;
      const link = (ev.target as Element | null)?.closest?.("a[data-spa]") as HTMLAnchorElement | null;
      if (!link) return;
      const href = link.getAttribute("href");
      if (!href || !href.startsWith("/")) return;
      ev.preventDefault();
      // An incoming ?ref= (e.g. daily_share from a shared result card) wins
      // over the page's own seo_* tag, so attribution survives the hop.
      const target = new URL(href, window.location.origin);
      const incoming = new URLSearchParams(window.location.search).get("ref");
      if (incoming && /^[a-z0-9_-]{1,32}$/i.test(incoming)) target.searchParams.set("ref", incoming);
      navigate(`${target.pathname}${target.search}`);
      window.scrollTo(0, 0);
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, [navigate]);

  // Funnel: once, on the static page itself, after auth has settled.
  useEffect(() => {
    if (accountState === "loading") return;
    if (!isSeoPath(pathname) || !isOnStaticPage(pathname)) return;
    startSeoFunnel(pathname, accountState !== "loggedOut");
  }, [accountState, pathname]);

  return null;
}

/**
 * Route element for the static layer's paths. On the page whose HTML is in
 * this document there is nothing to render. Reached client-side from anywhere
 * else (an in-app link), the HTML isn't here, so load it for real.
 */
export function SeoRouteOutlet() {
  const { pathname, search } = useLocation();
  const onPage = isOnStaticPage(pathname);
  useEffect(() => {
    if (!onPage) window.location.assign(`${pathname}${search}`);
  }, [onPage, pathname, search]);
  return null;
}

/**
 * Hosts the server-rendered `#seo` block INSIDE a React screen. The homepage's
 * landing is a fixed full-screen frame, so the block can't sit after #root
 * there (it would be covered: invisible to people, visible to crawlers — the
 * wrong way round). The landing renders this slot below its hero instead, and
 * the block moves into it: same HTML the crawler read, now visible and
 * scrollable. It moves back (hidden) when the slot unmounts.
 */
export function StaticSeoSlot({ className }: { className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = document.getElementById("seo");
    const host = ref.current;
    if (!el || !host) return;
    const parent = el.parentNode;
    const next = el.nextSibling;
    host.appendChild(el);
    el.style.display = "";
    return () => {
      el.style.display = "none";
      parent?.insertBefore(el, next);
    };
  }, []);
  return <div ref={ref} className={className} />;
}
