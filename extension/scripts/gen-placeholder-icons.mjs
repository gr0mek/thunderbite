// One-off generator for placeholder toolbar icons (solid --tag yellow square).
// Real artwork (the lightning mark from the wireframes) should replace these
// before any Chrome Web Store submission.
import { deflateSync } from "node:zlib";
import { writeFileSync, mkdirSync } from "node:fs";

const OUT_DIR = new URL("../src/assets/", import.meta.url);
mkdirSync(OUT_DIR, { recursive: true });

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type, "ascii");
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])));
  return Buffer.concat([len, typeBuf, data, crc]);
}

function solidSquarePng(size, [r, g, b]) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // color type: RGB
  const row = Buffer.alloc((1 + size * 3) * size);
  for (let y = 0; y < size; y++) {
    const base = y * (1 + size * 3);
    row[base] = 0; // filter: none
    for (let x = 0; x < size; x++) {
      const p = base + 1 + x * 3;
      row[p] = r;
      row[p + 1] = g;
      row[p + 2] = b;
    }
  }
  const idat = deflateSync(row);
  return Buffer.concat([
    sig,
    chunk("IHDR", ihdr),
    chunk("IDAT", idat),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

const TAG_YELLOW = [0xf2, 0xc2, 0x30];
for (const size of [16, 32, 48, 128]) {
  const png = solidSquarePng(size, TAG_YELLOW);
  writeFileSync(new URL(`icon-${size}.png`, OUT_DIR), png);
}
console.log("Wrote placeholder icons to src/assets/");
