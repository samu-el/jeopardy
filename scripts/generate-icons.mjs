/**
 * Rasterises the app icons and the social preview from the SVG sources in
 * `public/`. The PNGs are committed; run this only when the artwork changes:
 *
 *   PLAYWRIGHT_CHROMIUM_PATH=/path/to/chromium bun scripts/generate-icons.mjs
 *
 * iOS ignores SVG home-screen icons and Chrome's install check wants 192 and
 * 512 PNGs, so the SVG alone is not enough.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright";

const root = process.cwd();
const pub = (name) => join(root, "public", name);

const anySvg = readFileSync(pub("icon.svg"), "utf8");
const maskableSvg = readFileSync(pub("icon-maskable.svg"), "utf8");
// iOS rounds the corners itself; a pre-rounded icon shows black wedges.
const squareSvg = anySvg.replace(' rx="32"', "");
const oswald = readFileSync(join(root, "src/app/fonts/oswald-latin-variable.woff2")).toString("base64");

const browser = await chromium.launch(
  process.env.PLAYWRIGHT_CHROMIUM_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH } : {},
);
const page = await browser.newPage();

async function renderSvg(svg, size, { transparent = true } = {}) {
  await page.setViewportSize({ width: size, height: size });
  const sized = svg.replace(/width="192" height="192"/, `width="${size}" height="${size}"`);
  await page.setContent(
    `<!doctype html><html><body style="margin:0;background:transparent">${sized}</body></html>`,
  );
  return page.screenshot({ omitBackground: transparent, clip: { x: 0, y: 0, width: size, height: size } });
}

const outputs = [
  ["icon-192.png", anySvg, 192],
  ["icon-512.png", anySvg, 512],
  ["icon-maskable-512.png", maskableSvg, 512],
  ["apple-touch-icon.png", squareSvg, 180],
];
for (const [name, svg, size] of outputs) {
  writeFileSync(pub(name), await renderSvg(svg, size));
}

// favicon.ico: an ICO container holding 16, 32 and 48 px PNG images.
const icoSizes = [16, 32, 48];
const pngs = [];
for (const size of icoSizes) pngs.push(await renderSvg(anySvg, size));
const header = Buffer.alloc(6 + 16 * pngs.length);
header.writeUInt16LE(0, 0);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(pngs.length, 4);
let offset = header.length;
pngs.forEach((png, index) => {
  const entry = 6 + index * 16;
  const size = icoSizes[index];
  header.writeUInt8(size % 256, entry);
  header.writeUInt8(size % 256, entry + 1);
  header.writeUInt8(0, entry + 2);
  header.writeUInt8(0, entry + 3);
  header.writeUInt16LE(1, entry + 4);
  header.writeUInt16LE(32, entry + 6);
  header.writeUInt32LE(png.length, entry + 8);
  header.writeUInt32LE(offset, entry + 12);
  offset += png.length;
});
writeFileSync(pub("favicon.ico"), Buffer.concat([header, ...pngs]));

// Open Graph / Twitter card, 1200x630.
await page.setViewportSize({ width: 1200, height: 630 });
await page.setContent(`<!doctype html><html><head><style>
  @font-face { font-family: "OG Oswald"; src: url(data:font/woff2;base64,${oswald}) format("woff2"); font-weight: 200 700; }
  html, body { margin: 0; width: 1200px; height: 630px; }
  body { background: radial-gradient(ellipse at 50% 35%, #0B0F2A 0%, #000 70%); color: #fff;
    display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 28px;
    font-family: "OG Oswald", sans-serif; text-transform: uppercase; }
  .mark { font-weight: 700; font-size: 168px; line-height: 1; transform: skew(-10deg); letter-spacing: 0.01em;
    text-shadow: 0.04em 0.04em 0 rgba(0,0,0,0.6); }
  .mark .b { color: #4B5BFF; } .mark .g { color: #F2C14E; }
  .board { display: grid; grid-template-columns: repeat(6, 120px); gap: 8px; background: #000; padding: 8px; }
  .cell { background: linear-gradient(180deg, #060CE9 0%, #03066B 100%); height: 56px; display: flex;
    align-items: center; justify-content: center; color: #D69F4C; font-weight: 700; font-size: 32px;
    text-shadow: 0.06em 0.06em 0 rgba(0,0,0,0.85); }
  .tag { font-weight: 500; font-size: 30px; letter-spacing: 0.22em; color: rgba(255,255,255,0.78); }
</style></head><body>
  <div class="mark"><span class="b">JEOPARDY</span><span class="g">!</span></div>
  <div class="board">${["$200", "$400", "$600", "$800", "$1000", "$200"].map((v) => `<div class="cell">${v}</div>`).join("")}</div>
  <div class="tag">Play together · buzz from your phone</div>
</body></html>`);
await page.evaluate(() => document.fonts.ready);
writeFileSync(pub("og-image.png"), await page.screenshot({ clip: { x: 0, y: 0, width: 1200, height: 630 } }));

await browser.close();
console.log("Icons written to public/.");
