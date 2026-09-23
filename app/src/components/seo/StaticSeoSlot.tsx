import { useLayoutEffect, useRef } from "react";

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
