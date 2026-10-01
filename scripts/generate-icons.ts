/**
 * Tekent het app-icoon (een planbord met één afwezige dag) en schrijft de PNG's en de favicon.
 * Zonder extra afhankelijkheden, zodat iedereen het opnieuw kan draaien: `npm run icons`.
 * De uitvoer staat in de repo; draai dit alleen opnieuw als het ontwerp verandert.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { crc32, deflateSync } from 'node:zlib';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

type Rgb = readonly [number, number, number];

const BRAND_700: Rgb = [0x0f, 0x76, 0x6e];
const BRAND_900: Rgb = [0x13, 0x4e, 0x4a];
const WHITE: Rgb = [0xff, 0xff, 0xff];
const AMBER: Rgb = [0xf5, 0x9e, 0x0b];

/** Afgeronde rechthoek in een ontwerpvlak van 512 × 512. */
interface Box {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  r: number;
}

function inBox(box: Box, x: number, y: number): boolean {
  if (x < box.x0 || x > box.x1 || y < box.y0 || y > box.y1) return false;
  const dx = Math.max(box.x0 + box.r - x, 0, x - (box.x1 - box.r));
  const dy = Math.max(box.y0 + box.r - y, 0, y - (box.y1 - box.r));
  return dx * dx + dy * dy <= box.r * box.r;
}

const BOARD: Box = { x0: 112, y0: 136, x1: 400, y1: 392, r: 32 };
const HEADER_BOTTOM = 204;
const RINGS: Box[] = [
  { x0: 172, y0: 104, x1: 200, y1: 168, r: 14 },
  { x0: 312, y0: 104, x1: 340, y1: 168, r: 14 },
];
const CELLS: { box: Box; color: Rgb }[] = [232, 308].flatMap((y, row) =>
  [144, 228, 312].map((x, column) => ({
    box: { x0: x, y0: y, x1: x + 56, y1: y + 52, r: 10 },
    color: row === 0 && column === 2 ? AMBER : BRAND_700,
  })),
);

/** Kleur op een punt van het ontwerp, of null voor transparant. */
function colorAt(x: number, y: number, cornerRadius: number): Rgb | null {
  for (const ring of RINGS) if (inBox(ring, x, y)) return WHITE;
  for (const cell of CELLS) if (inBox(cell.box, x, y)) return cell.color;
  if (inBox(BOARD, x, y)) return y < HEADER_BOTTOM ? BRAND_900 : WHITE;
  if (inBox({ x0: 0, y0: 0, x1: 512, y1: 512, r: cornerRadius }, x, y)) return BRAND_700;
  return null;
}

/** RGBA-pixels, met 4 × 4 monsters per pixel voor gladde randen. */
function render(size: number, cornerRadius: number): Uint8Array {
  const samples = 4;
  const pixels = new Uint8Array(size * size * 4);
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let r = 0;
      let g = 0;
      let b = 0;
      let covered = 0;
      for (let sy = 0; sy < samples; sy++) {
        for (let sx = 0; sx < samples; sx++) {
          const color = colorAt(((px + (sx + 0.5) / samples) * 512) / size, ((py + (sy + 0.5) / samples) * 512) / size, cornerRadius);
          if (!color) continue;
          r += color[0];
          g += color[1];
          b += color[2];
          covered++;
        }
      }
      const offset = (py * size + px) * 4;
      if (covered > 0) {
        pixels[offset] = Math.round(r / covered);
        pixels[offset + 1] = Math.round(g / covered);
        pixels[offset + 2] = Math.round(b / covered);
        pixels[offset + 3] = Math.round((covered / (samples * samples)) * 255);
      }
    }
  }
  return pixels;
}

function chunk(type: string, data: Uint8Array): Buffer {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

function png(size: number, pixels: Uint8Array): Buffer {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8; // bits per kanaal
  header[9] = 6; // RGBA
  const rows = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    rows[y * (size * 4 + 1)] = 0; // geen filter
    Buffer.from(pixels.buffer, y * size * 4, size * 4).copy(rows, y * (size * 4 + 1) + 1);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(rows, { level: 9 })),
    chunk('IEND', new Uint8Array()),
  ]);
}

/** Een .ico met PNG-afbeeldingen erin; dat begrijpen alle huidige browsers. */
function ico(images: { size: number; data: Buffer }[]): Buffer {
  const header = Buffer.alloc(6 + images.length * 16);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);
  let offset = header.length;
  images.forEach((image, index) => {
    const entry = 6 + index * 16;
    header[entry] = image.size >= 256 ? 0 : image.size;
    header[entry + 1] = image.size >= 256 ? 0 : image.size;
    header.writeUInt16LE(1, entry + 4);
    header.writeUInt16LE(32, entry + 6);
    header.writeUInt32LE(image.data.length, entry + 8);
    header.writeUInt32LE(offset, entry + 12);
    offset += image.data.length;
  });
  return Buffer.concat([header, ...images.map((image) => image.data)]);
}

const ROUNDED = 96;
const FULL_BLEED = 0;

function write(path: string, data: Buffer): void {
  const target = join(root, path);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, data);
  console.log(`${path} (${data.length} bytes)`);
}

// Voor het manifest (Android, desktop).
write('public/icons/icon-192.png', png(192, render(192, ROUNDED)));
write('public/icons/icon-512.png', png(512, render(512, ROUNDED)));
// Maskable: Android snijdt zelf een vorm uit; het planbord valt binnen de veilige cirkel.
write('public/icons/icon-maskable-512.png', png(512, render(512, FULL_BLEED)));
// iOS rondt de hoeken zelf af en wil geen transparantie.
write('src/app/apple-icon.png', png(180, render(180, FULL_BLEED)));
write(
  'src/app/favicon.ico',
  ico([16, 32, 48].map((size) => ({ size, data: png(size, render(size, ROUNDED)) }))),
);
