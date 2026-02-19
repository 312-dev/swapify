#!/usr/bin/env node
/**
 * Generate PWA icons + favicon for Swapify.
 * Uses the Noun Project "Share Song" SVG (by S. Belalcazar Lareo)
 * rendered via sharp onto dark rounded backgrounds.
 */
import { writeFileSync, mkdirSync } from "node:fs";
import sharp from "sharp";

// Swapify brand colors
const BRAND = "#38BDF8"; // sky blue
const BG = "#0a0a0a"; // app dark background

// The Noun Project "Share Song" icon path (5120-unit coordinate system, y-inverted)
const ICON_PATH = `M1483 5105 c-170 -46 -304 -181 -348 -350 -12 -47 -15 -123 -15 -372 l0 -313 -47 23 c-100 50 -152 62 -273 62 -94 0 -128 -4 -185 -23 -109 -36 -193 -88 -271 -167 -244 -247 -244 -643 1 -891 254 -257 657 -258 907 -1 l48 48 872 -386 873 -387 2 -111 c1 -62 3 -123 5 -137 3 -23 -51 -54 -802 -471 l-805 -447 -3 304 c-3 341 -1 351 64 400 l37 29 217 5 217 5 37 29 c71 54 85 151 32 221 -46 59 -72 65 -293 65 -217 0 -285 -11 -375 -56 -71 -36 -159 -123 -197 -193 -56 -106 -61 -143 -61 -488 l0 -313 -47 23 c-100 50 -152 62 -273 62 -94 0 -128 -4 -185 -23 -109 -36 -193 -88 -271 -167 -247 -249 -244 -645 6 -896 315 -316 845 -219 1032 190 39 85 58 189 58 324 l1 112 886 491 886 491 61 -49 c221 -179 520 -194 759 -39 117 77 203 189 255 333 l26 73 4 383 3 382 193 0 c258 0 332 22 455 136 113 104 169 270 144 419 -33 195 -192 359 -382 395 -80 15 -286 12 -359 -5 -175 -41 -311 -175 -357 -350 -12 -47 -15 -123 -15 -372 l0 -313 -42 21 c-213 109 -468 84 -665 -65 -35 -26 -73 -61 -87 -78 l-23 -30 -644 285 c-354 156 -749 331 -877 388 l-234 104 6 35 c3 19 6 187 6 373 l0 337 183 0 c200 0 271 11 359 56 65 33 164 132 200 200 145 271 -6 610 -307 689 -77 20 -318 20 -392 0z`;

/**
 * Build an SVG string of the icon on a rounded-rect dark background.
 * @param {number} size - Output pixel size
 * @param {number} padding - Fraction of size to pad the icon (e.g. 0.15 = 15% each side)
 * @param {number} cornerRadius - Fraction of size for corner rounding
 */
function buildIconSvg(size, { padding = 0.15, cornerRadius = 0.22 } = {}) {
  const r = Math.round(size * cornerRadius);
  const iconSize = Math.round(size * (1 - padding * 2));
  const offset = Math.round(size * padding);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" rx="${r}" ry="${r}" fill="${BG}"/>
  <svg x="${offset}" y="${offset}" width="${iconSize}" height="${iconSize}" viewBox="0 0 512 512">
    <g fill="${BRAND}" transform="translate(0,512) scale(0.1,-0.1)">
      <path d="${ICON_PATH}"/>
    </g>
  </svg>
</svg>`;
}

/**
 * Build favicon SVG — no background, just the icon on transparent.
 */
function buildFaviconSvg(size) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 512 512">
  <g fill="${BRAND}" transform="translate(0,512) scale(0.1,-0.1)">
    <path d="${ICON_PATH}"/>
  </g>
</svg>`;
}

/**
 * Create an ICO file from one or more PNG buffers.
 * Modern ICO format — embeds raw PNGs.
 */
function createIco(pngBuffers) {
  const count = pngBuffers.length;
  const headerSize = 6;
  const dirEntrySize = 16;
  const dataOffset = headerSize + dirEntrySize * count;

  // ICO header
  const header = Buffer.alloc(headerSize);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: 1 = ICO
  header.writeUInt16LE(count, 4);

  const dirEntries = [];
  let currentOffset = dataOffset;

  for (const png of pngBuffers) {
    const entry = Buffer.alloc(dirEntrySize);
    // We'll get actual dimensions from sharp metadata, but for 32x32/16x16:
    // Width/height 0 means 256 in ICO spec, otherwise actual value
    entry[0] = 0; // width (will be filled)
    entry[1] = 0; // height (will be filled)
    entry[2] = 0; // color palette count
    entry[3] = 0; // reserved
    entry.writeUInt16LE(1, 4); // color planes
    entry.writeUInt16LE(32, 6); // bits per pixel
    entry.writeUInt32LE(png.length, 8); // size of image data
    entry.writeUInt32LE(currentOffset, 12); // offset to image data
    dirEntries.push({ entry, png });
    currentOffset += png.length;
  }

  return Buffer.concat([header, ...dirEntries.map((d) => d.entry), ...pngBuffers]);
}

async function main() {
  mkdirSync("public/icons", { recursive: true });

  // Generate PWA icons (with dark bg + rounded corners)
  for (const size of [192, 512]) {
    const svg = buildIconSvg(size);
    const png = await sharp(Buffer.from(svg)).png().toBuffer();
    writeFileSync(`public/icons/icon-${size}.png`, png);
    console.log(`Created public/icons/icon-${size}.png (${png.length} bytes)`);
  }

  // Generate favicon sizes
  const sizes = [16, 32, 48];
  const pngBuffers = [];

  for (const size of sizes) {
    const svg = buildFaviconSvg(512); // render at full res then resize
    const png = await sharp(Buffer.from(svg))
      .resize(size, size)
      .png()
      .toBuffer();
    pngBuffers.push(png);
  }

  // Set correct dimensions in ICO directory entries
  const ico = createIco(pngBuffers);
  // Patch dimensions into directory entries
  const dirStart = 6;
  for (let i = 0; i < sizes.length; i++) {
    const s = sizes[i];
    ico[dirStart + i * 16] = s < 256 ? s : 0;
    ico[dirStart + i * 16 + 1] = s < 256 ? s : 0;
  }

  writeFileSync("src/app/favicon.ico", ico);
  console.log(`Created src/app/favicon.ico (${ico.length} bytes, ${sizes.join("+")}px)`);

  console.log("Done! Icons generated with Noun Project 'Share Song' logo.");
}

main().catch((err) => {
  console.error("Icon generation failed:", err);
  process.exit(1);
});
