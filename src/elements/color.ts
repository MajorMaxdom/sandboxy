/**
 * Colors stored in a cell's 16-bit `life` field as RGB565 (lasers), and
 * conversions to CSS hex and to the renderer's packed ABGR pixels.
 */

/** Default laser color (red) for cells without a stored color. */
export const DEFAULT_LASER = 0xf904; // #ff2020

export function hexToRgb565(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return ((r >> 3) << 11) | ((g >> 2) << 5) | (b >> 3);
}

function channels(v: number): [number, number, number] {
  const r = (v >> 11) & 31;
  const g = (v >> 5) & 63;
  const b = v & 31;
  // Expand to 8 bits, repeating the high bits so white stays white.
  return [(r << 3) | (r >> 2), (g << 2) | (g >> 4), (b << 3) | (b >> 2)];
}

export function rgb565ToHex(v: number): string {
  const [r, g, b] = channels(v);
  return '#' + ((r << 16) | (g << 8) | b).toString(16).padStart(6, '0');
}

/** Packed pixel for ImageData (little-endian ABGR). */
export function rgb565ToPixel(v: number, brightness = 1): number {
  const [r, g, b] = channels(v);
  const c = (x: number) => Math.min(255, Math.round(x * brightness));
  return ((255 << 24) | (c(b) << 16) | (c(g) << 8) | c(r)) >>> 0;
}

/** Lookup tables: RGB565 → packed pixel (full and dimmed), built lazily (64k entries each). */
const luts = new Map<number, Uint32Array>();
export function rgb565Lut(brightness = 1): Uint32Array {
  let lut = luts.get(brightness);
  if (!lut) {
    lut = new Uint32Array(65536);
    for (let v = 0; v < 65536; v++) lut[v] = rgb565ToPixel(v, brightness);
    luts.set(brightness, lut);
  }
  return lut;
}
