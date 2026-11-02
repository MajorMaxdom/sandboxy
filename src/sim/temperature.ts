import { P } from '../elements/props';
import type { Simulation } from './simulation';

/** Heat flow per tick between two cells = this × min(conductivity) × ΔT. */
const FLOW = 0.2;

/**
 * Diffuses heat between neighbouring cells (energy-conserving via heat
 * capacity), lets everything drift slowly back to ambient temperature, and
 * applies phase transitions (melting, freezing, boiling, condensing).
 */
export function temperaturePass(sim: Simulation): void {
  const { w, h, type, temp, rng } = sim;
  const amb = sim.ambient;
  const { cond, cap, cool, tHigh, tLow, toHigh, toLow, transChance, byproduct, actTemp } = P;

  for (let y = 0; y < h; y++) {
    const row = y * w;
    for (let x = 0; x < w; x++) {
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
