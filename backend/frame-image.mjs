import { deflateSync } from 'node:zlib';
import { CARPARK_LAYOUT } from '../dist/carpark/layout.mjs';
import { temperatureColor } from '../dist/thermal-map.mjs';

const crc = bytes => { let c = 0xffffffff; for (const b of bytes) { c ^= b; for (let i = 0; i < 8; i++) c = (c >>> 1) ^ ((c & 1) ? 0xedb88320 : 0); } return (c ^ 0xffffffff) >>> 0; };
function chunk(type, data) { const tag = Buffer.from(type), size = Buffer.alloc(4), check = Buffer.alloc(4); size.writeUInt32BE(data.length); check.writeUInt32BE(crc(Buffer.concat([tag, data]))); return Buffer.concat([size, tag, data, check]); }
export function bayFrameImage(matrix) {
  const { rows, cols } = CARPARK_LAYOUT.frame;
  if (!Array.isArray(matrix) || matrix.length !== rows || matrix.some(row => !Array.isArray(row) || row.length !== cols || row.some(value => value !== null && (!Number.isFinite(value) || value < -60 || value > 1000)))) throw Error('BAY_FRAME_MATRIX');
  const w = cols * 8, h = rows * 8, stride = w * 3 + 1, raw = Buffer.alloc(h * stride);
  const set = (x, y, rgb) => { for (let i = 0; i < 3; i++) raw[y * stride + 1 + x * 3 + i] = rgb[i]; };
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const value = matrix[Math.floor(y / 8)][Math.floor(x / 8)], colour = temperatureColor(value);
    const rgb = colour.startsWith('#') ? [1, 3, 5].map(i => parseInt(colour.slice(i, i + 2), 16)) : colour.match(/\d+/g).map(Number);
    set(x, y, value === null && (x + y) % 8 === 0 ? [157, 171, 178] : rgb);
  }
  for (const zone of CARPARK_LAYOUT.zones) for (const rect of zone.rects) {
    const x0 = rect.cols[0] * 8, x1 = (rect.cols[1] + 1) * 8 - 1, y0 = rect.rows[0] * 8, y1 = (rect.rows[1] + 1) * 8 - 1;
    for (let x = x0; x <= x1; x++) { set(x, y0, [235, 242, 242]); set(x, y1, [235, 242, 242]); }
    for (let y = y0; y <= y1; y++) { set(x0, y, [235, 242, 242]); set(x1, y, [235, 242, 242]); }
  }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  return 'data:image/png;base64,' + Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]).toString('base64');
}
