import { ConvexReactClient } from "convex/react";
import { anyApi } from "convex/server";
import type { api as WebApi } from "@convex/_generated/api";

const url = process.env.EXPO_PUBLIC_CONVEX_URL;
const siteUrl = process.env.EXPO_PUBLIC_CONVEX_SITE_URL;
if (!url || !siteUrl) {
  throw new Error("EXPO_PUBLIC_CONVEX_URL and EXPO_PUBLIC_CONVEX_SITE_URL must be set (see mobile/.env).");
}

export const convex = new ConvexReactClient(url, { unsavedChangesWarning: false });
export const convexSiteUrl = siteUrl;

// Same backend as the website. `anyApi` builds function references at runtime;
// the type comes from the web app's generated api, so calls stay type-checked
// without bundling anything from ../app.
export const api = anyApi as unknown as typeof WebApi;
