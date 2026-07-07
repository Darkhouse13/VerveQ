import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { capturePageview } from "@/lib/analytics";

/**
 * Captures one $pageview per route change (including the initial route).
 * Must render inside BrowserRouter; renders nothing. A complete no-op when
 * analytics is uninitialized (dev, preview, key-less builds).
 */
export function AnalyticsPageviews() {
  const location = useLocation();
  useEffect(() => {
    capturePageview(location.pathname, location.search);
  }, [location.pathname, location.search]);
  return null;
}
