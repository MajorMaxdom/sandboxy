import { P, ID } from '../elements/registry';
import { CHARGE_MAX, POWDER, LIQUID } from '../elements/props';
import type { Simulation } from './simulation';

export type Tool =
  /** param: the element's toolbar option (laser color, firework filling), stored in `life`. */
  | { kind: 'element'; id: number; param?: number }
  | { kind: 'erase' }
  | { kind: 'heat' }
  | { kind: 'cool' }
  /** Wind gust in the direction the brush is dragged (see blowCircle). */
  | { kind: 'wind' }
  | { kind: 'toggle' };

export interface BrushOptions {
  radius: number;
  /** Paint over existing particles instead of only into empty cells. */
  replace: boolean;
  /** Fill every cell (shapes) instead of the speckled spray of loose stuff. */
  solid?: boolean;
}

export function paintCircle(sim: Simulation, cx: number, cy: number, tool: Tool, opt: BrushOptions): void {
  const r = Math.max(0, Math.round(opt.radius));
  const r2 = r * r + r; // slightly rounder circles at small radii
  const { w, type, temp, rng } = sim;

  for (let dy = -r; dy <= r; dy++) {
    for (let dx = -r; dx <= r; dx++) {
      if (dx * dx + dy * dy > r2) continue;
      const x = cx + dx;
      const y = cy + dy;
      if (!sim.inBounds(x, y)) continue;
      const j = y * w + x;
      const t = type[j];

      switch (tool.kind) {
        case 'element': {
          const id = tool.id;
          if (id === ID.spark && P.conducts[t]) {
            if (sim.charge[j] === 0) sim.charge[j] = CHARGE_MAX;
            break;
          }
          const param = tool.param;
          if (t === id) {
            // Same element, other setting: e.g. recolor a laser.
            if (param !== undefined && sim.life[j] !== param) {
              sim.life[j] = param;
              sim.wake(j);
            }
            break;
          }
          if (t !== 0 && !opt.replace) break;
          if (!opt.solid && rng.next() > P.paintChance[id]) break;
          sim.spawn(j, id);
          if (param !== undefined) sim.life[j] = param;
          break;
        }
        case 'erase':
          if (t !== 0) sim.spawn(j, 0);
          break;
        case 'heat':
          temp[j] = Math.min(temp[j] + 12, 9000);
          break;
        case 'cool':
          temp[j] = Math.max(temp[j] - 12, -273);
          break;
        case 'toggle':
          if (t === ID.switch) {
            sim.life[j] = sim.life[j] ? 0 : 1;
            sim.wake(j);
          }
          break;
      }
    }
  }
}

/** Paint along a line so fast strokes don't leave gaps. */
export function paintLine(
  sim: Simulation,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  tool: Tool,
  opt: BrushOptions,
): void {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const dist = Math.max(Math.abs(dx), Math.abs(dy));
  const step = Math.max(1, Math.floor(opt.radius / 2));
  const n = Math.max(1, Math.ceil(dist / step));
  for (let s = 0; s <= n; s++) {
    const t = n === 0 ? 0 : s / n;
    paintCircle(sim, Math.round(x0 + dx * t), Math.round(y0 + dy * t), tool, opt);
  }
}

/** Filled rectangle between two corners. */
export function paintRect(
  sim: Simulation,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  tool: Tool,
  opt: BrushOptions,
): void {
  const one = { ...opt, radius: 0 };
  for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++) {
    for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++) paintCircle(sim, x, y, tool, one);
  }
}

/**
 * Flood fill: apply the tool to the connected area of the same element as
 * the clicked cell (e.g. all the empty space inside a container).
 */
export function floodFill(sim: Simulation, x: number, y: number, tool: Tool, opt: BrushOptions): number {
  if (!sim.inBounds(x, y)) return 0;
  const { w, h, type } = sim;
  const target = type[y * w + x];
  if (tool.kind === 'element' && tool.id === target) return 0;
  const seen = new Uint8Array(sim.size);
  const queue = new Int32Array(sim.size);
  let head = 0;
  let tail = 0;
  queue[tail++] = y * w + x;
  seen[y * w + x] = 1;
  const one = { ...opt, radius: 0, replace: true, solid: true };
  while (head < tail) {
    const i = queue[head++];
    const cx = i % w;
    const cy = (i - cx) / w;
    paintCircle(sim, cx, cy, tool, one);
    if (cx > 0 && !seen[i - 1] && type[i - 1] === target) { seen[i - 1] = 1; queue[tail++] = i - 1; }
    if (cx < w - 1 && !seen[i + 1] && type[i + 1] === target) { seen[i + 1] = 1; queue[tail++] = i + 1; }
    if (cy > 0 && !seen[i - w] && type[i - w] === target) { seen[i - w] = 1; queue[tail++] = i - w; }
    if (cy < h - 1 && !seen[i + w] && type[i + w] === target) { seen[i + w] = 1; queue[tail++] = i + w; }
  }
  return tail;
}

/** Strongest gust the wind tool makes (cells per tick of wind). */
const GUST_MAX = 8;
/** Wind per cell of brush movement per frame. */
const GUST_PER_CELL = 1.5;
/** Share of the gust that becomes velocity of sand, water and the like … */
const GUST_SHOVE = 0.15;
/** … plus a little lift, so piles get swept up instead of only pressed together. */
const GUST_LIFT = 0.25;
const GUST_MAX_SPEED = 4;

function clampSpeed(v: number): number {
  return v > GUST_MAX_SPEED ? GUST_MAX_SPEED : v < -GUST_MAX_SPEED ? -GUST_MAX_SPEED : v;
}

/**
 * Wind tool: blow (wx, wy) = how far the brush moved since the last frame,
 * over a circle a bit wider than the brush. Particles read it next tick.
 */
export function blowCircle(sim: Simulation, cx: number, cy: number, wx: number, wy: number, radius: number): void {
  const len = Math.hypot(wx, wy);
  if (len === 0) return;
  const g = Math.min(GUST_MAX, len * GUST_PER_CELL) / len;
  const gx = wx * g;
  const gy = wy * g;
  const r = Math.round(radius) * 2 + 3;
  const { w, windX, windY } = sim;
  for (let dy = -r; dy <= r; dy++) {
    for (let dx = -r; dx <= r; dx++) {
      const d2 = dx * dx + dy * dy;
      if (d2 > r * r || !sim.inBounds(cx + dx, cy + dy)) continue;
      const j = (cy + dy) * w + cx + dx;
      const f = 1 - Math.sqrt(d2) / (r + 1);
      windX[j] += gx * f;
      windY[j] += gy * f;
      const t = sim.type[j];
      if (t === 0) continue;
      sim.wake(j);
      // Wind alone hardly moves sand or water: give loose powders and
      // liquids a shove (they fly ballistically, see movement.ts).
      const st = P.state[t];
      if (st === POWDER || st === LIQUID) {
        const k = GUST_SHOVE * f;
        sim.vx[j] = clampSpeed(sim.vx[j] + gx * k);
        sim.vy[j] = clampSpeed(sim.vy[j] + gy * k - (gy <= 0 ? GUST_LIFT * f : 0));
      }
    }
  }
}
