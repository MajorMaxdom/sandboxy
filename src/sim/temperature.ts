import { P } from '../elements/props';
import type { Simulation } from './simulation';

/** Heat flow per tick between two cells = this × min(conductivity) × ΔT. */
const FLOW = 0.2;
/** Cells this close to ambient count as settled. */
const SETTLED = 0.5;

const CHUNK_SHIFT = 4;
const CHUNK = 1 << CHUNK_SHIFT;

/**
 * Does chunk (cx, cy) need heat simulation? Yes if it's awake, or if any
 * cell is off ambient, has a phase transition pending or is hot enough to
 * ignite. Exits at the first such cell, so busy chunks cost little.
 */
function chunkNeedsHeat(sim: Simulation, cx: number, cy: number): boolean {
  const { w, h, type, temp } = sim;
  const amb = sim.ambient;
  const { tHigh, tLow, actTemp } = P;
  const x0 = cx << CHUNK_SHIFT;
  const y0 = cy << CHUNK_SHIFT;
  const x1 = Math.min(w, x0 + CHUNK);
  const y1 = Math.min(h, y0 + CHUNK);
  for (let y = y0; y < y1; y++) {
    const row = y * w;
    for (let x = x0; x < x1; x++) {
      const i = row + x;
      const t = temp[i];
      const d = t - amb;
      if (d > SETTLED || d < -SETTLED) return true;
      const a = type[i];
      if (t > tHigh[a] || t < tLow[a] || t >= actTemp[a]) return true;
    }
  }
  return false;
}

/**
 * Diffuses heat between neighbouring cells (energy-conserving via heat
 * capacity), lets everything drift slowly back to ambient temperature, and
 * applies phase transitions (melting, freezing, boiling, condensing).
 *
 * Chunks where everything sits at ambient temperature are skipped, unless a
 * neighbour on the right or below needs heat: each cell exchanges heat with
 * its right and lower neighbour, so that chunk must run for heat to flow in.
 */
export function temperaturePass(sim: Simulation): void {
  const { w, h, type, temp, rng, cw, ch, awake, thermal } = sim;
  const amb = sim.ambient;
  const { cond, cap, cool, tHigh, tLow, toHigh, toLow, transChance, byproduct, actTemp } = P;

  for (let cy = 0; cy < ch; cy++) {
    for (let cx = 0; cx < cw; cx++) {
      const c = cy * cw + cx;
      thermal[c] = awake[c] || chunkNeedsHeat(sim, cx, cy) ? 1 : 0;
    }
  }
  // Second flag bit: run this chunk (needs heat itself, or its right/lower neighbour does).
  for (let cy = 0; cy < ch; cy++) {
    for (let cx = 0; cx < cw; cx++) {
      const c = cy * cw + cx;
      if ((thermal[c] & 1) || (cx < cw - 1 && thermal[c + 1] & 1) || (cy < ch - 1 && thermal[c + cw] & 1)) thermal[c] |= 2;
    }
  }

  for (let y = 0; y < h; y++) {
    const row = y * w;
    const crow = (y >> CHUNK_SHIFT) * cw;
    for (let cx = 0; cx < cw; cx++) {
      if (!(thermal[crow + cx] & 2)) continue;
      const xEnd = Math.min(w, (cx + 1) << CHUNK_SHIFT);
      for (let x = cx << CHUNK_SHIFT; x < xEnd; x++) {
        const i = row + x;
        const a = type[i];
        const ca = cond[a];

        if (ca > 0) {
          if (x < w - 1) {
            const j = i + 1;
            const b = type[j];
            const cb = cond[b];
            if (cb > 0) {
              const diff = temp[j] - temp[i];
              if (diff > 0.05 || diff < -0.05) {
                const f = (ca < cb ? ca : cb) * FLOW * diff;
                temp[i] += f / cap[a];
                temp[j] -= f / cap[b];
              }
            }
          }
          if (y < h - 1) {
            const j = i + w;
            const b = type[j];
            const cb = cond[b];
            if (cb > 0) {
              const diff = temp[j] - temp[i];
              if (diff > 0.05 || diff < -0.05) {
                const f = (ca < cb ? ca : cb) * FLOW * diff;
                temp[i] += f / cap[a];
                temp[j] -= f / cap[b];
              }
            }
          }
        }

        let t = temp[i];
        t += (amb - t) * cool[a];
        temp[i] = t;
        if (t >= actTemp[a]) sim.wake(i);

        if (t > tHigh[a]) {
          if (rng.next() < transChance[a]) {
            sim.transform(i, toHigh[a], true);
            const bp = byproduct[a];
            if (bp >= 0) sim.spawnNearby(x, y, bp);
          }
        } else if (t < tLow[a]) {
          if (rng.next() < transChance[a]) sim.transform(i, toLow[a], true);
        }
      }
    }
  }
}
