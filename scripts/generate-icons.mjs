#!/usr/bin/env node
/**
 * Generate PWA icons for Deep Digs.
 * Creates simple branded icons using raw PNG construction with Node.js built-ins.
 * No external dependencies needed.
 */
import { writeFileSync, mkdirSync } from "fs";
import { deflateSync } from "zlib";

function createPNG(size) {
  // Deep Digs brand colors
  const bgR = 10, bgG = 10, bgB = 10;       // #0a0a0a background
  const fgR = 29, fgG = 185, fgB = 84;      // #1DB954 Spotify green

  // Create raw pixel data (RGBA) with filter byte per row
  const rawData = Buffer.alloc(size * (size * 4 + 1));

  for (let y = 0; y < rawData.length; y += size * 4 + 1) {
    rawData[y] = 0; // No filter
  }

  const cx = size / 2;
  const cy = size / 2;
  const outerR = size * 0.42;
  const innerR = size * 0.30;
  const dotR = size * 0.08;

  for (let y = 0; y < size; y++) {
    const rowOffset = y * (size * 4 + 1) + 1; // +1 for filter byte
    for (let x = 0; x < size; x++) {
      const px = rowOffset + x * 4;
      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);

      let r = bgR, g = bgG, b = bgB, a = 255;

      // Background circle with slight rounding
      const bgRadius = size * 0.46;
      if (dist > bgRadius) {
        a = 0; // transparent outside the circle
      }

      // Ring (donut shape)
      if (dist <= outerR && dist >= innerR) {
        r = fgR; g = fgG; b = fgB;
      }

      // Small center dot
      if (dist <= dotR) {
        r = fgR; g = fgG; b = fgB;
      }

      // Needle/arm from center toward top-right (like a record player)
      const angle = Math.atan2(dy, dx);
      const targetAngle = -Math.PI / 4; // -45 degrees (top-right)
      let angleDiff = Math.abs(angle - targetAngle);
      if (angleDiff > Math.PI) angleDiff = 2 * Math.PI - angleDiff;
      const armWidth = size * 0.025;
      const armMaxDist = outerR * 0.85;
      if (angleDiff < Math.atan2(armWidth, dist) && dist <= armMaxDist && dist >= dotR) {
        r = fgR; g = fgG; b = fgB;
      }

      // Anti-alias the outer edge of the background circle
      if (dist > bgRadius - 1.5 && dist <= bgRadius + 1.5) {
        const blend = Math.max(0, Math.min(1, (bgRadius + 0.75 - dist) / 1.5));
        a = Math.round(255 * blend);
      }

      rawData[px] = r;
      rawData[px + 1] = g;
      rawData[px + 2] = b;
      rawData[px + 3] = a;
    }
  }

  // Compress pixel data
  const compressed = deflateSync(rawData, { level: 9 });

  // Build PNG file
  const chunks = [];

  // PNG signature
  chunks.push(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));

  // IHDR chunk
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);  // width
  ihdr.writeUInt32BE(size, 4);  // height
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 6;  // color type: RGBA
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace
  chunks.push(pngChunk("IHDR", ihdr));

  // IDAT chunk
  chunks.push(pngChunk("IDAT", compressed));

  // IEND chunk
  chunks.push(pngChunk("IEND", Buffer.alloc(0)));

  return Buffer.concat(chunks);
}

function pngChunk(type, data) {
  const typeBuffer = Buffer.from(type, "ascii");
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);

  const crcData = Buffer.concat([typeBuffer, data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(crcData) >>> 0, 0);

  return Buffer.concat([length, typeBuffer, data, crc]);
}

function crc32(buf) {
  // Standard CRC32 table
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[i] = c;
  }

  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return crc ^ 0xffffffff;
}

// Generate icons
mkdirSync("public/icons", { recursive: true });

const icon192 = createPNG(192);
writeFileSync("public/icons/icon-192.png", icon192);
console.log("Created public/icons/icon-192.png (%d bytes)", icon192.length);

const icon512 = createPNG(512);
writeFileSync("public/icons/icon-512.png", icon512);
console.log("Created public/icons/icon-512.png (%d bytes)", icon512.length);

console.log("Done! PWA icons generated.");
