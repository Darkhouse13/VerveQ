import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";
import { readFileSync } from "fs";
import type { Plugin } from "vite";

// Convex bundles `*.txt` imports as raw text (esbuild's default text loader);
// mirror that so tests can import the same modules.
const textAssets: Plugin = {
  name: "text-assets",
  enforce: "pre",
  load(id) {
    if (!id.endsWith(".txt")) return null;
    return `export default ${JSON.stringify(readFileSync(id, "utf8"))};`;
  },
};

export default defineConfig({
  plugins: [textAssets, react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
});
