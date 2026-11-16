// Writes solid-color placeholder PNGs so a fresh project builds before real art exists.
// Usage: node scripts/make-placeholder-icons.js [hexColor]
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const hex = (process.argv[2] ?? '0F766E').replace('#', '');
const [r, g, b] = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16));

function crc32(buf) {
  let c;
  const table = [];
  for (let n = 0; n < 256; n++) {
    c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  let crc = 0xffffffff;
  for (const byte of buf) crc = table[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function png(size) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  const row = Buffer.alloc(1 + size * 3);
  for (let x = 0; x < size; x++) row.set([r, g, b], 1 + x * 3);
  const raw = Buffer.concat(Array.from({ length: size }, () => row));
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const out = path.join(__dirname, '..', 'assets', 'images');
fs.mkdirSync(out, { recursive: true });
for (const [file, size] of [
  ['icon.png', 1024],
  ['adaptive-icon.png', 1024],
  ['splash-icon.png', 512],
  ['favicon.png', 48],
]) {
  fs.writeFileSync(path.join(out, file), png(size));
}
console.log('placeholder icons written to', out);
