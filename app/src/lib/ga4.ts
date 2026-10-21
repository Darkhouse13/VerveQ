import { afterFirstPaint } from "./afterFirstPaint";

/**
 * Google Analytics 4, deferred (VerveQ ONE decision 8). It used to load from
 * index.html and cost about 1.2s on a mid-range phone before the first game
 * frame (177 KB gzipped, more than the app's own entry chunk). PostHog carries
 * the product events; GA4 stays for search and acquisition reporting, so it
 * loads once the page has painted. Production builds only.
 */
const GA_ID = "G-4CWMRVF3K8";

type GtagWindow = Window & { dataLayer?: unknown[]; gtag?: (...args: unknown[]) => void };

export function armGa4(): void {
  if (!import.meta.env.PROD || typeof window === "undefined") return;
  afterFirstPaint(() => {
    const w = window as GtagWindow;
    w.dataLayer = w.dataLayer || [];
    w.gtag = function gtag() {
      // gtag.js reads the Arguments object itself, not an array copy.
      // eslint-disable-next-line prefer-rest-params
      w.dataLayer!.push(arguments);
    };
    w.gtag("js", new Date());
    w.gtag("config", GA_ID);
    const script = document.createElement("script");
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_ID}`;
    document.head.appendChild(script);
  }, 4000);
}
