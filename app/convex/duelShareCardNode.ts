"use node";

import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { internalAction } from "./_generated/server";
import { v } from "convex/values";
import { initWasm, Resvg } from "@resvg/resvg-wasm";
import { buildShareCardSvg, OG_IMAGE_WIDTH } from "./lib/duelShareCard";
import { SHARE_CARD_FONT_BASE64 } from "./lib/shareCardFontData";

// satori was considered, but the card is a fixed three-line layout, so a
// hand-built SVG + resvg keeps the dependency surface to one wasm package.
// resvg renders <text> itself given a font buffer — the output is a real
// raster PNG (WhatsApp/iMessage won't unfurl SVG).

let wasmReady: Promise<void> | null = null;
function ensureWasm(): Promise<void> {
  if (!wasmReady) {
    // @resvg/resvg-wasm is an externalPackage (convex.json) so its .wasm
    // asset is present on disk next to the JS instead of being bundled away.
    const require = createRequire(import.meta.url);
    const wasmPath = require.resolve("@resvg/resvg-wasm/index_bg.wasm");
    wasmReady = initWasm(readFileSync(wasmPath)).catch((err) => {
      wasmReady = null;
      throw err;
    });
  }
  return wasmReady;
}

const fontBuffer = Buffer.from(SHARE_CARD_FONT_BASE64, "base64");

export const renderCard = internalAction({
  args: {
    line1: v.string(),
    line2: v.string(),
    accent: v.string(),
  },
  returns: v.bytes(),
  handler: async (_ctx, args): Promise<ArrayBuffer> => {
    await ensureWasm();
    const svg = buildShareCardSvg(args);
    const resvg = new Resvg(svg, {
      fitTo: { mode: "width", value: OG_IMAGE_WIDTH },
      font: {
        fontBuffers: [fontBuffer],
        loadSystemFonts: false,
        defaultFontFamily: "Space Grotesk",
      },
    });
    const png = resvg.render().asPng();
    return png.buffer.slice(
      png.byteOffset,
      png.byteOffset + png.byteLength,
    ) as ArrayBuffer;
  },
});
