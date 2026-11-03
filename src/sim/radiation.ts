import { ID } from '../elements/ids';
import { P, GAS, CHARGE_MAX, RAD_BLOCK, RAD_KILL, RAD_MODERATE, RAD_MUTATE, RAD_FEED } from '../elements/props';
import type { Simulation } from './simulation';
import { explode } from './explosion';

/** 8 flight directions; a radiation particle stores its index in `shade`. */
const DIRS: readonly [number, number][] = [
  [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1],
];

/** Cells per tick a radiation particle travels. */
const SPEED = 3;

/**
 * Send one radiation particle from (x, y) in a random direction. If the
 * neighbouring cell is matter, it is hit right away (that's how radiation
 * travels inside a solid block of uranium).
 */
export function emitRadiation(sim: Simulation, x: number, y: number): void {
  const dir = sim.rng.int(8);
  const nx = x + DIRS[dir][0];
  const ny = y + DIRS[dir][1];
  if (!sim.inBounds(nx, ny)) return;
  const j = ny * sim.w + nx;
  const t = sim.type[j];
  if (t === 0) {
    sim.transform(j, ID.radiation, true);
    sim.shade[j] = dir;
  } else if (P.state[t] !== GAS) {
    hitMatter(sim, j, t, nx, ny);
  }
}

/** Charge conductors next to (x, y) — used by detectors and generators. */
export function pulse(sim: Simulation, x: number, y: number): void {
  for (const j of sim.neighbors4(x, y)) signal(sim, j);
}

/**
 * Send a signal into cell j (a wire or another logic part). It's set one
 * above the maximum so it becomes a regular pulse next tick — that way every
 * part reading it sees it exactly once, whatever the processing order.
 */
export function signal(sim: Simulation, j: number): void {
  if (j < 0 || sim.charge[j] !== 0) return;
  const t = sim.type[j];
  if ((P.conducts[t] && (t !== ID.switch || sim.life[j] !== 0)) || P.logic[t]) sim.charge[j] = CHARGE_MAX + 1;
}

/** Ticks a Geiger counter stays lit after a hit … */
const GEIGER_FLASH = 20;
/** … and below which a new hit lights it again. */
const GEIGER_REFIRE = GEIGER_FLASH / 2;
/** Largest counter (in cells) that lights up as one. */
const GEIGER_MAX_CELLS = 20000;
let geigerSeen = new Uint32Array(0);
let geigerStamp = 0;
let geigerStack = new Int32Array(0);

/**
 * Radiation hit the Geiger counter cell j: the whole connected counter
 * lights up, and every cell of it sends a pulse into touching wires.
 */
function triggerGeiger(sim: Simulation, j: number): void {
  if (sim.life[j] > GEIGER_REFIRE) return; // still lit from the last hit
  const { w, h, type, size } = sim;
  if (geigerSeen.length < size) {
    geigerSeen = new Uint32Array(size);
    geigerStack = new Int32Array(size);
    geigerStamp = 0;
  }
  const stamp = ++geigerStamp;
  let top = 0;
  geigerStack[top++] = j;
  geigerSeen[j] = stamp;
  let n = 0;
  while (top > 0 && n < GEIGER_MAX_CELLS) {
    const i = geigerStack[--top];
    n++;
    sim.life[i] = GEIGER_FLASH;
    sim.shade[i] = 2;
    sim.wake(i);
    const x = i % w;
    const y = (i - x) / w;
    pulse(sim, x, y);
    if (x > 0 && type[i - 1] === ID.geiger && geigerSeen[i - 1] !== stamp) { geigerSeen[i - 1] = stamp; geigerStack[top++] = i - 1; }
    if (x < w - 1 && type[i + 1] === ID.geiger && geigerSeen[i + 1] !== stamp) { geigerSeen[i + 1] = stamp; geigerStack[top++] = i + 1; }
    if (y > 0 && type[i - w] === ID.geiger && geigerSeen[i - w] !== stamp) { geigerSeen[i - w] = stamp; geigerStack[top++] = i - w; }
    if (y < h - 1 && type[i + w] === ID.geiger && geigerSeen[i + w] !== stamp) { geigerSeen[i + w] = stamp; geigerStack[top++] = i + w; }
  }
}

/**
 * Radiation hits matter at j. Returns true if it was absorbed, false if it
 * scattered off.
 */
export function hitMatter(sim: Simulation, j: number, t: number, x: number, y: number): boolean {
  const rng = sim.rng;
  switch (P.radResp[t]) {
    case RAD_BLOCK:
      return true;
    case RAD_KILL:
      if (rng.next() < 0.3) sim.transform(j, ID.ash);
      return true;
    case RAD_MUTATE:
      if (rng.next() < 0.3) {
        sim.transform(j, ID['mutant plant']);
        sim.life[j] = 20;
      }
      return true;
    case RAD_FEED:
      sim.life[j] = Math.min(60, sim.life[j] + 8);
      sim.wake(j);
      return true;
    case RAD_MODERATE:
      if (rng.next() < 0.3) {
        sim.temp[j] += 3;
        if (rng.next() < 0.02) sim.transform(j, ID.hydrogen); // radiolysis
        return true;
      }
      return false;
  }
  if (t === ID.geiger) {
    triggerGeiger(sim, j);
    return true;
  }
  const fc = P.fissionChance[t];
  if (fc > 0) {
    if (rng.next() < fc) {
      sim.temp[j] += P.fissionHeat[t];
      sim.life[j] = Math.min(65535, sim.life[j] + P.fissionExcite[t]);
      sim.wake(j);
    }
    return true;
  }
  if (rng.next() < 0.35) {
    sim.temp[j] += 10;
    return true;
  }
  return false;
}

/** Update for a flying radiation particle. */
export function moveRadiation(sim: Simulation, i: number, x: number, y: number): boolean {
  const { w, type } = sim;
  let cur = i;
  let cx = x;
  let cy = y;
  const [dx, dy] = DIRS[sim.shade[i] & 7];
  for (let s = 0; s < SPEED; s++) {
    const nx = cx + dx;
    const ny = cy + dy;
    if (!sim.inBounds(nx, ny)) {
      sim.transform(cur, ID.empty, true);
      return true;
    }
    const j = ny * w + nx;
    const t = type[j];
    if (t === 0 || P.state[t] === GAS) {
      sim.swap(cur, j); // shade (= direction) travels along
      cur = j;
      cx = nx;
      cy = ny;
      continue;
    }
    if (t === ID.radiation) return true;
    if (hitMatter(sim, j, t, nx, ny)) {
      sim.transform(cur, ID.empty, true);
    } else {
      sim.shade[cur] = sim.rng.int(8); // scattered
    }
    return true;
  }
  return true;
}

/**
 * Update for fissile material: an excited nucleus (life > 0) releases
 * radiation and calms down again. Too much excitation at once = critical.
 */
export function fissileUpdate(nukeAt: number) {
  return (sim: Simulation, i: number, x: number, y: number): boolean => {
    const l = sim.life[i];
    if (l === 0) return false;
    if (nukeAt > 0 && l >= nukeAt) {
      nuke(sim, x, y);
      return true;
    }
    // Strongly excited nuclei release several neutrons per tick.
    for (let e = l * 0.007; e > 0; e--) if (e >= 1 || sim.rng.next() < e) emitRadiation(sim, x, y);
    sim.life[i] = l - 1;
    return false;
  };
}

/** Nuclear explosion: huge blast, heat, a burst of radiation and fallout. */
export function nuke(sim: Simulation, cx: number, cy: number): void {
  const { w, rng } = sim;
  const R = 28;
  // Use up nearby fissile material so one detonation doesn't trigger dozens.
  for (let dy = -R; dy <= R; dy++) {
    for (let dx = -R; dx <= R; dx++) {
      if (dx * dx + dy * dy > R * R) continue;
      const x = cx + dx;
      const y = cy + dy;
      if (!sim.inBounds(x, y)) continue;
      const j = y * w + x;
      if (P.fissionChance[sim.type[j]] > 0) sim.transform(j, rng.next() < 0.5 ? ID.fallout : ID.empty);
    }
  }
  explode(sim, cx, cy, R);
  const reach = R * 1.6;
  for (let n = 0; n < 400; n++) {
    const a = rng.next() * Math.PI * 2;
    const d = rng.next() * reach;
    const x = Math.round(cx + Math.cos(a) * d);
    const y = Math.round(cy + Math.sin(a) * d);
    if (!sim.inBounds(x, y)) continue;
    const j = y * w + x;
    if (sim.type[j] !== 0) continue;
    if (rng.next() < 0.5) {
      sim.transform(j, ID.radiation, true);
      sim.shade[j] = rng.int(8);
    } else {
      sim.transform(j, ID.fallout);
    }
  }
}
