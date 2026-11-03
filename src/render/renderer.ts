import { P, packColor } from '../elements/registry';
import { CHARGE_MAX, GAS, LIGHT_PASS, LIGHT_FILTER } from '../elements/props';
import { rgb565Lut } from '../elements/color';
import type { Simulation } from '../sim/simulation';

export type ViewMode = 'normal' | 'heat' | 'pressure';

/** What to outline on top of the world (brush cursor, shape preview). */
export type Overlay =
  | { kind: 'brush'; x: number; y: number; r: number }
  | { kind: 'line'; x0: number; y0: number; x1: number; y1: number; r: number }
  | { kind: 'rect'; x0: number; y0: number; x1: number; y1: number };

const T_MIN = -273;
const T_MAX = 6000;

/** Temperature → color lookup table, 1 entry per degree. */
function buildHeatLut(): Uint32Array {
  const stops: [number, [number, number, number]][] = [
    [-273, [255, 255, 255]],
    [-150, [120, 200, 255]],
    [-20, [30, 80, 220]],
    [20, [20, 20, 60]],
    [100, [110, 30, 140]],
    [400, [220, 30, 40]],
    [1000, [255, 130, 0]],
    [2000, [255, 230, 60]],
    [6000, [255, 255, 255]],
  ];
  const lut = new Uint32Array(T_MAX - T_MIN + 1);
  let s = 0;
  for (let t = T_MIN; t <= T_MAX; t++) {
    while (s < stops.length - 2 && t > stops[s + 1][0]) s++;
    const [t0, c0] = stops[s];
    const [t1, c1] = stops[s + 1];
    const f = Math.min(1, Math.max(0, (t - t0) / (t1 - t0)));
    lut[t - T_MIN] = packColor(
      c0[0] + (c1[0] - c0[0]) * f,
      c0[1] + (c1[1] - c0[1]) * f,
      c0[2] + (c1[2] - c0[2]) * f,
    );
  }
  return lut;
}

const HEAT_LUT = buildHeatLut();
const CHARGE_COLOR = packColor(255, 250, 170);
const CHARGE_DIM = packColor(240, 210, 90);

function dim(c: number): number {
  const r = (c & 255) * 0.35;
  const g = ((c >> 8) & 255) * 0.35;
  const b = ((c >> 16) & 255) * 0.35;
  return packColor(r, g, b);
}
const HEAT_LUT_DIM = HEAT_LUT.map(dim);

/** Average of two packed colors (light shining through gas or glass). */
function mix(a: number, b: number): number {
  return (((a >>> 1) & 0x7f7f7f7f) + ((b >>> 1) & 0x7f7f7f7f)) | 0xff000000;
}

export class Renderer {
  private ctx: CanvasRenderingContext2D;
  private img!: ImageData;
  private buf!: Uint32Array;
  mode: ViewMode = 'normal';

  constructor(private canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('Canvas 2D context not available');
    this.ctx = ctx;
  }

  resize(w: number, h: number): void {
    this.canvas.width = w;
    this.canvas.height = h;
    this.img = this.ctx.createImageData(w, h);
    this.buf = new Uint32Array(this.img.data.buffer);
  }

  draw(sim: Simulation, overlay: Overlay | null = null): void {
    const { type, shade, temp, charge } = sim;
    const buf = this.buf;
    const colors = P.colors;
    const glow = P.glow;
    const lightsUp = P.lightsUp;
    const size = sim.size;

    if (this.mode === 'pressure') {
      // Red = overpressure, blue = suction; solid cells grey, air flow brightens.
      const { pres, airU, airV, w, aw } = sim;
      for (let i = 0; i < size; i++) {
        const id = type[i];
        if (id !== 0 && P.state[id] === 1) {
          buf[i] = colors[id * 4 + (shade[i] & 3)] & 0xff3f3f3f | 0xff000000;
          continue;
        }
        const x = i % w;
        const a = (((i - x) / w) >> 1) * aw + (x >> 1);
        const p = pres[a] * 140;
        const f = Math.min(255, (Math.abs(airU[a]) + Math.abs(airV[a])) * 400);
        const r = Math.min(255, 20 + Math.max(0, p) + f * 0.3);
        const b = Math.min(255, 30 + Math.max(0, -p) + f * 0.3);
        const g = Math.min(255, 20 + f * 0.5);
        buf[i] = packColor(r, g, b);
      }
    } else if (this.mode === 'heat') {
      for (let i = 0; i < size; i++) {
        let t = temp[i] | 0;
        if (t < T_MIN) t = T_MIN;
        else if (t > T_MAX) t = T_MAX;
        buf[i] = type[i] === 0 ? HEAT_LUT_DIM[t - T_MIN] : HEAT_LUT[t - T_MIN];
      }
    } else {
      const beam = sim.beam;
      const ownColor = P.ownColor;
      const life = sim.life;
      const own = rgb565Lut();
      const ownDim = rgb565Lut(0.5);
      const defaultParam = P.defaultParam;
      const state = P.state;
      const light = P.light;
      for (let i = 0; i < size; i++) {
        const id = type[i];
        const c = charge[i];
        const b = beam[i];
        if (b !== 0) {
          // Laser light: pure over empty space, mixed into gas, glass and filters.
          const base = ownColor[id] ? (ownColor[id] === 2 ? ownDim : own)[life[i] || defaultParam[id]] : colors[id * 4 + (shade[i] & 3)];
          buf[i] = id === 0 ? b : state[id] === GAS || light[id] === LIGHT_PASS || light[id] === LIGHT_FILTER ? mix(base, b) : base;
        } else if (ownColor[id]) {
          buf[i] = (ownColor[id] === 2 ? ownDim : own)[life[i] || defaultParam[id]];
        } else if (c > 0 && id !== 0 && !lightsUp[id]) {
          buf[i] = c >= CHARGE_MAX - 2 ? CHARGE_COLOR : CHARGE_DIM;
        } else if (glow[id]) {
          buf[i] = colors[id * 4 + ((Math.random() * 4) | 0)];
        } else {
          buf[i] = colors[id * 4 + (shade[i] & 3)]; // & 3: shade may carry other data (radiation direction)
        }
      }
    }
    if (overlay) this.drawOverlay(overlay, sim.w, sim.h);
    this.ctx.putImageData(this.img, 0, 0);
  }

  /**
   * Outline the brush or the shape being dragged, in grid coordinates.
   * Rasterised into the pixel buffer instead of drawn with canvas paths:
   * mixing putImageData with vector drawing makes Safari sync the canvas
   * between CPU and GPU every frame, which cost most of the frame on iPhones.
   */
  private drawOverlay(o: Overlay, w: number, h: number): void {
    const buf = this.buf;
    const blend = (x: number, y: number, a: number): void => {
      if (x < 0 || y < 0 || x >= w || y >= h) return;
      const i = y * w + x;
      const c = buf[i];
      const r = c & 255;
      const g = (c >> 8) & 255;
      const b = (c >> 16) & 255;
      buf[i] = packColor(r + (255 - r) * a, g + (255 - g) * a, b + (255 - b) * a);
    };
    if (o.kind === 'brush') {
      // Border of the brush footprint (same shape as paintCircle).
      const r = Math.max(0, Math.round(o.r));
      const r2 = r * r + r;
      const inside = (dx: number, dy: number) => dx * dx + dy * dy <= r2;
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          if (!inside(dx, dy)) continue;
          const edge = !inside(dx + 1, dy) || !inside(dx - 1, dy) || !inside(dx, dy + 1) || !inside(dx, dy - 1);
          if (edge) blend(o.x + dx, o.y + dy, 0.55);
        }
      }
    } else if (o.kind === 'line') {
      // Every cell within the brush radius of the segment.
      const r = Math.max(0, Math.round(o.r)) + 0.5;
      const x0 = Math.max(0, Math.floor(Math.min(o.x0, o.x1) - r));
      const x1 = Math.min(w - 1, Math.ceil(Math.max(o.x0, o.x1) + r));
      const y0 = Math.max(0, Math.floor(Math.min(o.y0, o.y1) - r));
      const y1 = Math.min(h - 1, Math.ceil(Math.max(o.y0, o.y1) + r));
      const ex = o.x1 - o.x0;
      const ey = o.y1 - o.y0;
      const len2 = ex * ex + ey * ey;
      for (let y = y0; y <= y1; y++) {
        for (let x = x0; x <= x1; x++) {
          const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((x - o.x0) * ex + (y - o.y0) * ey) / len2));
          const dx = x - (o.x0 + ex * t);
          const dy = y - (o.y0 + ey * t);
          if (dx * dx + dy * dy <= r * r) blend(x, y, 0.35);
        }
      }
    } else {
      const xa = Math.min(o.x0, o.x1);
      const xb = Math.max(o.x0, o.x1);
      const ya = Math.min(o.y0, o.y1);
      const yb = Math.max(o.y0, o.y1);
      for (let y = Math.max(0, ya); y <= Math.min(h - 1, yb); y++) {
        for (let x = Math.max(0, xa); x <= Math.min(w - 1, xb); x++) {
          blend(x, y, x === xa || x === xb || y === ya || y === yb ? 0.55 : 0.25);
        }
      }
    }
  }
}
