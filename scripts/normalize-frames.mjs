/**
 * Normalize monster frames so every mood shares the same canvas size and the
 * body sits in the same place — removing the size/position "jump" when the app
 * swaps moods. Each image is trimmed to its content, scaled to fit, and
 * centered on a uniform transparent square.
 *
 * Run after strip-checkerboard.mjs (needs real transparency to trim against):
 *   node scripts/normalize-frames.mjs
 */
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import sharp from "sharp";

const DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "src", "assets", "monsters");
const SIZE = 512; // uniform output canvas
const FILL = 0.9; // fraction of the canvas the content may occupy
const TRANSPARENT = { r: 0, g: 0, b: 0, alpha: 0 };

async function normalize(file) {
  const input = readFileSync(file);

  // Trim transparent margins down to the monster's bounding box.
  const trimmed = await sharp(input).trim({ threshold: 10 }).toBuffer();

  // Scale to fit within FILL*SIZE, preserving aspect ratio.
  const inner = Math.round(SIZE * FILL);
  const resized = await sharp(trimmed)
    .resize(inner, inner, { fit: "inside", background: TRANSPARENT })
    .toBuffer();

  // Center it on a SIZE x SIZE transparent canvas.
  const meta = await sharp(resized).metadata();
  const left = Math.floor((SIZE - meta.width) / 2);
  const top = Math.floor((SIZE - meta.height) / 2);
  const out = await sharp(resized)
    .extend({
      top,
      bottom: SIZE - meta.height - top,
      left,
      right: SIZE - meta.width - left,
      background: TRANSPARENT,
    })
    .png()
    .toBuffer();

  writeFileSync(file, out);
  return { w: meta.width, h: meta.height };
}

const files = readdirSync(DIR).filter((f) => /\.png$/i.test(f));
for (const f of files) {
  const { w, h } = await normalize(join(DIR, f));
  console.log(`✓ ${f} — content ${w}x${h} centered on ${SIZE}x${SIZE}`);
}
