// Android icons + splash from the brand geometry (docs/BRAND.md: never redraw the mark).
// Platform-masked icons: ink canvas, lime "VQ" only, tilted −4°, inside the safe circle.
import { writeFileSync } from "node:fs";
import { INK, LIME, markLettersSvg, markSvg, svgToPng } from "../../app/scripts/lib/brand.mjs";

const S = 1024;
const wrap = (body, bg) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}" viewBox="0 0 ${S} ${S}">${bg ? `<rect width="${S}" height="${S}" fill="${bg}"/>` : ""}${body}</svg>`;
const letters = (px, fill) => markLettersSvg(S / 2, S / 2, px).replace(/fill="[^"]*"/g, `fill="${fill}"`);

const out = {
  "assets/images/icon.png": wrap(letters(620, LIME), INK),
  "assets/images/android-icon-foreground.png": wrap(letters(470, LIME)),
  "assets/images/android-icon-background.png": wrap("", INK),
  "assets/images/android-icon-monochrome.png": wrap(letters(470, "#FFFFFF")),
  "assets/images/splash-icon.png": wrap(markSvg(S / 2 - 256, S / 2 - 256, 512)),
};
for (const [file, svg] of Object.entries(out)) {
  writeFileSync(file, await svgToPng(svg, S));
  console.log("wrote", file);
}
