// Rasterizes the brand mark (src/components/brand/geometry.ts) into the app icon, Android
// adaptive icon and splash images. No dependencies: shapes are drawn with signed distances
// (4x4 supersampling) and encoded as PNG with node:zlib.
// Usage: node scripts/generate-brand-assets.mts
import { writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

import { HAND, HEART, type Shape } from '../src/components/brand/geometry.ts';

// Brand palette (src/theme/tokens.ts). Duplicated here because scripts don't load the app theme.
const INK: RGBA = [0x20, 0x20, 0x20, 255];
const LIME: RGBA = [0xc9, 0xf1, 0x58, 255];
const CLEAR: RGBA = [0, 0, 0, 0];

type RGBA = [number, number, number, number];

function inside(shape: Shape, x: number, y: number): boolean {
  switch (shape.kind) {
    case 'circle':
      return Math.hypot(x - shape.cx, y - shape.cy) <= shape.r;
    case 'diamond':
      return Math.abs(x - shape.cx) + Math.abs(y - shape.cy) <= shape.s / Math.SQRT2;
    case 'rect': {
      const cx = Math.min(Math.max(x, shape.x + shape.r), shape.x + shape.w - shape.r);
      const cy = Math.min(Math.max(y, shape.y + shape.r), shape.y + shape.h - shape.r);
      return Math.hypot(x - cx, y - cy) <= shape.r;
    }
    case 'capsule': {
      const dx = shape.x2 - shape.x1;
      const dy = shape.y2 - shape.y1;
      const t = Math.max(0, Math.min(1, ((x - shape.x1) * dx + (y - shape.y1) * dy) / (dx * dx + dy * dy)));
      return Math.hypot(x - (shape.x1 + t * dx), y - (shape.y1 + t * dy)) <= shape.r;
    }
  }
}

/** Renders the mark into a size x size image. `scale` is the mark's share of the canvas. */
function render(size: number, { background, ink, scale, tileRadius }: { background: RGBA; ink: RGBA; scale: number; tileRadius?: number }) {
  const pixels = Buffer.alloc(size * size * 4);
  const SS = 4;
  const offset = (1 - scale) / 2;
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      const acc = [0, 0, 0, 0];
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const u = (px + (sx + 0.5) / SS) / size;
          const v = (py + (sy + 0.5) / SS) / size;
          let color = background;
          if (tileRadius !== undefined && !inside({ kind: 'rect', x: 0, y: 0, w: 1, h: 1, r: tileRadius }, u, v)) {
            color = CLEAR;
          } else {
            const x = ((u - offset) / scale) * 100;
            const y = ((v - offset) / scale) * 100;
            if (HAND.some((s) => inside(s, x, y)) && !HEART.some((s) => inside(s, x, y))) color = ink;
          }
          const a = color[3] / 255;
          acc[0] += color[0] * a;
          acc[1] += color[1] * a;
          acc[2] += color[2] * a;
          acc[3] += a;
        }
      }
      const i = (py * size + px) * 4;
      const alpha = acc[3] / (SS * SS);
      pixels[i] = alpha ? Math.round(acc[0] / acc[3]) : 0;
      pixels[i + 1] = alpha ? Math.round(acc[1] / acc[3]) : 0;
      pixels[i + 2] = alpha ? Math.round(acc[2] / acc[3]) : 0;
      pixels[i + 3] = Math.round(alpha * 255);
    }
  }
  return encodePng(size, size, pixels);
}

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buffer: Buffer): number {
  let c = 0xffffffff;
  for (const byte of buffer) c = CRC_TABLE[(c ^ byte) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

function encodePng(width: number, height: number, rgba: Buffer): Buffer {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8; // bit depth
  header[9] = 6; // RGBA
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0;
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const out = (name: string, png: Buffer) => {
  writeFileSync(new URL(`../assets/images/${name}`, import.meta.url), png);
  console.log(`assets/images/${name}`);
};

// iOS / store icon: full-bleed lime (the OS applies its own mask).
out('icon.png', render(1024, { background: LIME, ink: INK, scale: 0.66 }));
// Android adaptive foreground: transparent, mark inside the 66% safe zone; background color is set in app.config.ts.
out('adaptive-icon.png', render(1024, { background: CLEAR, ink: INK, scale: 0.5 }));
// Splash: ink mark for the lime light splash, lime mark for the dark splash.
out('splash-icon.png', render(512, { background: CLEAR, ink: INK, scale: 0.9 }));
out('splash-icon-dark.png', render(512, { background: CLEAR, ink: LIME, scale: 0.9 }));
// Web favicon.
out('favicon.png', render(96, { background: LIME, ink: INK, scale: 0.7, tileRadius: 0.22 }));
