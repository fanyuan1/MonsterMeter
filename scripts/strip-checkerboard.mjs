/**
 * Remove a baked-in "transparency checkerboard" background from monster PNGs.
 *
 * Some exports flatten the editor's transparency checkerboard into the image
 * (every pixel opaque). This restores real transparency by flood-filling from
 * the image borders, clearing pixels that look like the neutral grey/white
 * checker squares. Because each monster has a continuous dark outline, interior
 * whites (eyes, teeth, steam puffs) are enclosed and left untouched.
 *
 * Already-transparent images are skipped, so it is safe to re-run.
 *
 *   node scripts/strip-checkerboard.mjs
 */
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { PNG } from "pngjs";

const DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "src", "assets", "monsters");

/** Is this pixel a neutral (low-saturation) light grey/white checker square? */
function isChecker(r, g, b) {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const neutral = max - min <= 16; // grey, not a warm monster colour
  return neutral && min >= 180; // light: white (~253) or grey (~202) squares
}

function strip(filePath) {
  const png = PNG.sync.read(readFileSync(filePath));
  const { width, height, data } = png;
  const idx = (x, y) => (y * width + x) * 4;

  // Quick check: if it already has meaningful transparency, leave it alone.
  let already = 0;
  for (let i = 3; i < data.length; i += 4) if (data[i] < 10) already++;
  if (already / (width * height) > 0.02) return { skipped: true };

  const visited = new Uint8Array(width * height);
  const stack = [];
  const push = (x, y) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    const p = y * width + x;
    if (visited[p]) return;
    visited[p] = 1;
    stack.push(x, y);
  };
  // Seed from every border pixel.
  for (let x = 0; x < width; x++) {
    push(x, 0);
    push(x, height - 1);
  }
  for (let y = 0; y < height; y++) {
    push(0, y);
    push(width - 1, y);
  }

  let cleared = 0;
  while (stack.length) {
    const y = stack.pop();
    const x = stack.pop();
    const o = idx(x, y);
    if (!isChecker(data[o], data[o + 1], data[o + 2])) continue; // hit the monster outline
    data[o + 3] = 0; // make transparent
    cleared++;
    push(x + 1, y);
    push(x - 1, y);
    push(x, y + 1);
    push(x, y - 1);
  }

  writeFileSync(filePath, PNG.sync.write(png));
  return { cleared, total: width * height };
}

const files = readdirSync(DIR).filter((f) => /\.png$/i.test(f));
for (const f of files) {
  const res = strip(join(DIR, f));
  if (res.skipped) console.log(`• ${f} — already transparent, skipped`);
  else console.log(`✓ ${f} — cleared ${res.cleared} px (${((res.cleared / res.total) * 100).toFixed(0)}%)`);
}
