// Gera os icones PNG da app a partir de SDFs - sem dependencias externas.
import { deflateSync } from "node:zlib";
import { writeFileSync } from "node:fs";

const BG = [0x0f, 0x5f, 0x4a]; // pine
const FG = [0xff, 0xff, 0xff];

const CRC = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return (buf) => {
    let c = -1;
    for (let i = 0; i < buf.length; i++) c = t[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
    return (c ^ -1) >>> 0;
  };
})();

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(CRC(body));
  return Buffer.concat([len, body, crc]);
}

function png(width, height, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 6;  // RGBA
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0; // filter: none
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

function sdRoundRect(px, py, hw, hh, r) {
  const qx = Math.abs(px) - hw + r;
  const qy = Math.abs(py) - hh + r;
  const ox = Math.max(qx, 0), oy = Math.max(qy, 0);
  return Math.hypot(ox, oy) + Math.min(Math.max(qx, qy), 0) - r;
}

function sdSegment(px, py, ax, ay, bx, by) {
  const pax = px - ax, pay = py - ay;
  const bax = bx - ax, bay = by - ay;
  const h = clamp01((pax * bax + pay * bay) / (bax * bax + bay * bay));
  return Math.hypot(pax - bax * h, pay - bay * h);
}

// Cheque desenhado em coordenadas 0..1
const CHECK = [
  [0.255, 0.545],
  [0.435, 0.720],
  [0.745, 0.315],
];

function draw(size, { maskable = false } = {}) {
  const buf = Buffer.alloc(size * size * 4);
  const aa = 1 / size;                    // largura da transicao ~1px
  const scale = maskable ? 0.62 : 1;      // zona segura dos icones maskable
  const stroke = 0.092 * scale;
  const pts = CHECK.map(([x, y]) => [
    0.5 + (x - 0.5) * scale,
    0.5 + (y - 0.5) * scale,
  ]);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = (x + 0.5) / size, v = (y + 0.5) / size;

      // fundo
      let bgA;
      if (maskable) {
        bgA = 1;
      } else {
        const d = sdRoundRect(u - 0.5, v - 0.5, 0.5, 0.5, 0.223);
        bgA = clamp01(0.5 - d / aa);
      }

      // cheque (uniao de dois segmentos com juntas redondas)
      const d1 = sdSegment(u, v, pts[0][0], pts[0][1], pts[1][0], pts[1][1]);
      const d2 = sdSegment(u, v, pts[1][0], pts[1][1], pts[2][0], pts[2][1]);
      const dc = Math.min(d1, d2) - stroke / 2;
      const fgA = clamp01(0.5 - dc / aa) * bgA;

      const i = (y * size + x) * 4;
      for (let c = 0; c < 3; c++) buf[i + c] = Math.round(BG[c] * (1 - fgA) + FG[c] * fgA);
      buf[i + 3] = Math.round(bgA * 255);
      // pre-multiplicacao nao se aplica: PNG usa alpha direto
      if (bgA > 0 && fgA > 0) {
        for (let c = 0; c < 3; c++) {
          const a = fgA / bgA;
          buf[i + c] = Math.round(BG[c] * (1 - a) + FG[c] * a);
        }
      }
    }
  }
  return png(size, size, buf);
}

const out = new URL("../icons/", import.meta.url);
const jobs = [
  ["icon-192.png", 192, {}],
  ["icon-512.png", 512, {}],
  ["maskable-512.png", 512, { maskable: true }],
  ["apple-touch-icon.png", 180, { maskable: true }],
  ["favicon-64.png", 64, {}],
];
for (const [name, size, opts] of jobs) {
  writeFileSync(new URL(name, out), draw(size, opts));
  console.log("icons/" + name);
}
