import { P, LIQUID, GAS, AIR_DENSITY } from '../elements/props';
import type { Simulation } from './simulation';

/** Can a falling powder/liquid `id` move into cell j? */
function canSink(sim: Simulation, id: number, j: number): boolean {
  const t = sim.type[j];
  if (t === 0) return true;
  const st = P.state[t];
  if (st === GAS) return true;
  if (st === LIQUID && P.density[t] < P.density[id]) {
    if (sim.rng.next() < 0.5) return true;
    sim.wake(j); // could still sink later
    return false;
  }
  return false;
}

/** Gravity in cells/tick², and terminal fall speed. */
const GRAVITY = 0.2;
const MAX_SPEED = 6;

/**
 * Ballistic motion for powders and liquids: free fall accelerates, and
 * particles flung by an explosion fly along their velocity. Moves cell by
 * cell along the path and stops at the first obstacle. Returns true if the
 * particle moved.
 */
function moveBallistic(sim: Simulation, i: number, x: number, y: number, id: number): boolean {
  const { w, h, vx, vy } = sim;
  let fvx = vx[i];
  let fvy = vy[i];
  const freeBelow = y < h - 1 && isFree(sim, id, i + w);
  if (fvx === 0 && fvy >= 0 && !freeBelow) {
    vy[i] = 0;
    return false;
  }
  fvy += GRAVITY;
  // Starting to fall from rest: begin at one cell per tick (but never cancel upward flight).
  if (freeBelow && fvy >= 0 && fvy < 1) fvy = 1;
  if (fvy > MAX_SPEED) fvy = MAX_SPEED;
  fvx *= 0.98; // air drag
  if (Math.abs(fvx) < 0.05) fvx = 0;

  const steps = Math.max(1, Math.ceil(Math.max(Math.abs(fvx), Math.abs(fvy))));
  const sx = fvx / steps;
  const sy = fvy / steps;
  let fx = x + 0.5;
  let fy = y + 0.5;
  let cur = i;
  let cx = x;
  let cy = y;
  let hit = false;
  for (let s = 0; s < steps; s++) {
    fx += sx;
    fy += sy;
    const nx = Math.floor(fx);
    const ny = Math.floor(fy);
    if (nx === cx && ny === cy) continue;
    if (nx < 0 || ny < 0 || nx >= w || ny >= h) {
      hit = true;
      break;
    }
    let j = ny * w + nx;
    if (!canSink(sim, id, j)) {
      // Glide along the obstacle: try moving on just one axis.
      const alt1 = cy * w + nx;
      const alt2 = ny * w + cx;
      if (nx !== cx && ny !== cy && canSink(sim, id, alt1)) {
        j = alt1;
        fy = cy + 0.5;
      } else if (nx !== cx && ny !== cy && canSink(sim, id, alt2)) {
        j = alt2;
        fx = cx + 0.5;
      } else {
        hit = true;
        break;
      }
    }
    sim.swap(cur, j);
    cur = j;
    cx = j % w;
    cy = (j - cx) / w;
  }
  if (hit) {
    // Landing: lose vertical speed, keep a bit of sideways momentum.
    vx[cur] = Math.abs(fvx) > 1 ? fvx * 0.4 : 0;
    vy[cur] = 0;
  } else {
    vx[cur] = fvx;
    vy[cur] = fvy;
  }
  return cur !== i;
}

/** Deterministic version of canSink, for deciding whether we're falling. */
function isFree(sim: Simulation, id: number, j: number): boolean {
  const t = sim.type[j];
  if (t === 0) return true;
  const st = P.state[t];
  return st === GAS || (st === LIQUID && P.density[t] < P.density[id]);
}

export function movePowder(sim: Simulation, i: number, x: number, y: number, id: number): boolean {
  const { w, h } = sim;
  if (moveBallistic(sim, i, x, y, id)) return true;
  if (y >= h - 1) return false;
  const below = i + w;
  if (canSink(sim, id, below)) {
    sim.swap(i, below);
    return true;
  }
  const dir = sim.rng.next() < 0.5 ? -1 : 1;
  for (let k = 0; k < 2; k++) {
    const d = k === 0 ? dir : -dir;
    const nx = x + d;
    if (nx < 0 || nx >= w) continue;
    const j = below + d;
    if (canSink(sim, id, j)) {
      sim.swap(i, j);
      return true;
    }
  }
  return false;
}

export function moveLiquid(sim: Simulation, i: number, x: number, y: number, id: number): boolean {
  const { w, h, type, rng } = sim;
  if (moveBallistic(sim, i, x, y, id)) return true;
  const hasBelow = y < h - 1;
  if (hasBelow) {
    const below = i + w;
    if (canSink(sim, id, below)) {
      sim.swap(i, below);
      return true;
    }
    const dir = rng.next() < 0.5 ? -1 : 1;
    for (let k = 0; k < 2; k++) {
      const d = k === 0 ? dir : -dir;
      const nx = x + d;
      if (nx < 0 || nx >= w) continue;
      const j = below + d;
      if (canSink(sim, id, j)) {
        sim.swap(i, j);
        return true;
      }
    }
  }

  const visc = P.viscosity[id];
  if (visc > 0 && rng.next() < visc) {
    sim.wake(i); // might still flow sideways next tick
    return false;
  }

  // Spread sideways up to `dispersion` cells, stopping early above a drop.
  const disp = P.dispersion[id];
  const dir = rng.next() < 0.5 ? -1 : 1;
  for (let k = 0; k < 2; k++) {
    const d = k === 0 ? dir : -dir;
    let target = -1;
    for (let s = 1; s <= disp; s++) {
      const nx = x + d * s;
      if (nx < 0 || nx >= w) break;
      const j = i + d * s;
      const t = type[j];
      if (t !== 0 && P.state[t] !== GAS) break;
      target = j;
      if (hasBelow && type[j + w] === 0) break;
    }
    if (target >= 0) {
      sim.swap(i, target);
      return true;
    }
  }
  return false;
}

export function moveGas(sim: Simulation, i: number, x: number, y: number, id: number): boolean {
  const { w, type, rng } = sim;
  const rising = P.density[id] < AIR_DENSITY;
  const vy = rising ? -1 : 1;

  const r = rng.next();
  let dx: number;
  let dy: number;
  if (r < 0.45) { dx = 0; dy = vy; }
  else if (r < 0.6) { dx = -1; dy = vy; }
  else if (r < 0.75) { dx = 1; dy = vy; }
  else if (r < 0.875) { dx = -1; dy = 0; }
  else { dx = 1; dy = 0; }

  const nx = x + dx;
  const ny = y + dy;
  if (!sim.inBounds(nx, ny)) return false;
  const j = ny * w + nx;
  const t = type[j];
  if (t === 0) {
    sim.swap(i, j);
    return true;
  }
  // Buoyancy between different gases.
  if (dy === vy && t !== id && P.state[t] === GAS) {
    const other = P.density[t];
    const mine = P.density[id];
    if ((rising ? other > mine : other < mine) && rng.next() < 0.5) {
      sim.swap(i, j);
      return true;
    }
  }
  return false;
}
