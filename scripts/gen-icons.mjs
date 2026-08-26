import fs from "node:fs"
import path from "node:path"
import zlib from "node:zlib"
import { fileURLToPath } from "node:url"

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const OUT = path.join(ROOT, "src-tauri", "icons")

const CRC_TABLE = (() => {
  const table = new Int32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c
  }
  return table
})()

function crc32(buf) {
  let crc = -1
  for (const b of buf) crc = CRC_TABLE[(crc ^ b) & 0xff] ^ (crc >>> 8)
  return (crc ^ -1) >>> 0
}

function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const typeBuf = Buffer.from(type, "ascii")
  const crcBuf = Buffer.alloc(4)
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])))
  return Buffer.concat([len, typeBuf, data, crcBuf])
}

function encodePng(width, height, rgba) {
  const raw = Buffer.alloc(height * (width * 4 + 1))
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4)
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8
  ihdr[9] = 6
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ])
}

const EMERALD = [16, 185, 129]
const WHITE = [255, 255, 255]
const DARK = [6, 78, 59]

function createCanvas(size) {
  return { size, buf: Buffer.alloc(size * size * 4) }
}

function setPixel(canvas, x, y, color) {
  if (x < 0 || y < 0 || x >= canvas.size || y >= canvas.size) return
  const i = (y * canvas.size + x) * 4
  canvas.buf[i] = color[0]
  canvas.buf[i + 1] = color[1]
  canvas.buf[i + 2] = color[2]
  canvas.buf[i + 3] = 255
}

function inRoundRect(x, y, x0, y0, x1, y1, r) {
  if (x < x0 || x > x1 || y < y0 || y > y1) return false
  const cx = Math.min(Math.max(x, x0 + r), x1 - r)
  const cy = Math.min(Math.max(y, y0 + r), y1 - r)
  const dx = x - cx
  const dy = y - cy
  return dx * dx + dy * dy <= r * r
}

function fillRoundRect(canvas, x0, y0, x1, y1, r, color) {
  for (let y = Math.floor(y0); y <= y1; y++) {
    for (let x = Math.floor(x0); x <= x1; x++) {
      if (inRoundRect(x, y, x0, y0, x1, y1, r)) setPixel(canvas, x, y, color)
    }
  }
}

function drawIcon(size) {
  const canvas = createCanvas(size)
  const m = Math.max(1, Math.round(size * 0.03))
  const bgRadius = Math.round(size * 0.21)
  fillRoundRect(canvas, m, m, size - m, size - m, bgRadius, EMERALD)

  const gx0 = Math.round(size * 0.3)
  const gx1 = Math.round(size * 0.7)
  const gy0 = Math.round(size * 0.22)
  const gy1 = Math.round(size * 0.78)
  const gRadius = Math.round(size * 0.07)
  fillRoundRect(canvas, gx0, gy0, gx1, gy1, gRadius, WHITE)

  const barH = Math.max(1, Math.round(size * 0.05))
  const barGap = barH * 2
  const bx0 = Math.round(size * 0.37)
  const bx1 = Math.round(size * 0.63)
  for (let i = 0; i < 3; i++) {
    const by0 = gy0 + Math.round(size * 0.12) + i * barGap
    fillRoundRect(canvas, bx0, by0, bx1, by0 + barH, barH / 2, DARK)
  }

  const dotCx = size / 2
  const dotCy = gy1 - Math.round(size * 0.11)
  const dotR = Math.round(size * 0.055)
  for (let y = dotCy - dotR; y <= dotCy + dotR; y++) {
    for (let x = dotCx - dotR; x <= dotCx + dotR; x++) {
      const dx = x - dotCx
      const dy = y - dotCy
      if (dx * dx + dy * dy <= dotR * dotR) setPixel(canvas, Math.round(x), Math.round(y), DARK)
    }
  }

  return canvas.buf
}

fs.mkdirSync(OUT, { recursive: true })

for (const size of [32, 128]) {
  fs.writeFileSync(path.join(OUT, `${size}x${size}.png`), encodePng(size, size, drawIcon(size)))
}

const png256 = encodePng(256, 256, drawIcon(256))
fs.writeFileSync(path.join(OUT, "icon.png"), png256)

const iconDir = Buffer.alloc(6)
iconDir.writeUInt16LE(0, 0)
iconDir.writeUInt16LE(1, 2)
iconDir.writeUInt16LE(1, 4)

const entry = Buffer.alloc(16)
entry[0] = 0
entry.writeUInt16LE(1, 4)
entry.writeUInt16LE(32, 6)
entry.writeUInt32LE(png256.length, 8)
entry.writeUInt32LE(22, 12)

fs.writeFileSync(path.join(OUT, "icon.ico"), Buffer.concat([iconDir, entry, png256]))

console.log(`Iconos generados en ${OUT}`)
