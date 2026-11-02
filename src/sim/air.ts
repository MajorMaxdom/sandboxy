import { P, STATIC } from '../elements/props';
import type { Simulation } from './simulation';

/** Air flow → wind strength felt by particles. */
export const AIR_WIND_SCALE = 3;

/** Wave speed factor per substep (< 0.7 for stability in 2D). */
const C = 0.6;
/** Substeps per tick → waves travel about C × SUBSTEPS cells per tick. */
const SUBSTEPS = 2;
/** Flow damping per tick; < 1 so currents settle instead of ringing forever. */
const FLOW_DAMP = 0.99;
/** Pressure relaxation per tick. */
const PRES_DAMP = 0.997;
/** Below this everywhere, the air is considered calm and the pass is skipped. */
const CALM = 0.002;
/** Width (in air cells) of the wave-absorbing border. */
const SPONGE = 3;

/**
 * Linearised air dynamics on a staggered grid: pressure differences
 * accelerate the flow between cells, flow moves "air" and changes pressure.
 * Gives pressure waves that travel ~1 cell per tick, reflect from walls and
 * follow pipes. Solid (static) cells block air; the world border is closed.
 */
export function airPass(sim: Simulation): void {
  markBlocked(sim);
  let maxAbs = 0;
  for (let s = 0; s < SUBSTEPS; s++) maxAbs = airSubstep(sim, s === SUBSTEPS - 1);
  if (maxAbs < CALM) {
    sim.pres.fill(0);
    sim.airU.fill(0);
    sim.airV.fill(0);
    sim.airActive = false;
  }
}

/** An air cell is solid if any of its 2×2 grid cells is static (keeps thin walls airtight). */
function markBlocked(sim: Simulation): void {
  const { w, h, type, aw, airBlocked } = sim;
  const state = P.state;
  airBlocked.fill(0);
  for (let y = 0; y < h; y++) {
    const row = y * w;
    const arow = (y >> 1) * aw;
    for (let x = 0; x < w; x++) {
      if (state[type[row + x]] === STATIC) airBlocked[arow + (x >> 1)] = 1;
    }
  }
}

function airSubstep(sim: Simulation, last: boolean): number {
  const { aw, ah, pres, airU, airV, airBlocked, w, type } = sim;
  let maxAbs = 0;

  // 1) Flow through faces, driven by the pressure difference.
  for (let y = 0; y < ah; y++) {
    const row = y * aw;
    for (let x = 0; x < aw; x++) {
      const a = row + x;
      const solid = airBlocked[a];
      if (x < aw - 1 && !solid && !airBlocked[a + 1]) airU[a] = (airU[a] + (pres[a] - pres[a + 1]) * C) * FLOW_DAMP;
      else airU[a] = 0;
      if (y < ah - 1 && !solid && !airBlocked[a + aw]) airV[a] = (airV[a] + (pres[a] - pres[a + aw]) * C) * FLOW_DAMP;
      else airV[a] = 0;
    }
  }

  // 2) Pressure changes by what flows in and out.
  for (let y = 0; y < ah; y++) {
    const row = y * aw;
    for (let x = 0; x < aw; x++) {
      const a = row + x;
      if (airBlocked[a]) {
        pres[a] = 0;
        continue;
      }
      const out = airU[a] - (x > 0 ? airU[a - 1] : 0) + airV[a] - (y > 0 ? airV[a - aw] : 0);
      // The world's edge behaves like open sky: a soft border swallows waves.
      const edge = x < SPONGE || y < SPONGE || x >= aw - SPONGE || y >= ah - SPONGE;
      const p = (pres[a] - out * C) * (edge ? 0.85 : PRES_DAMP);
      pres[a] = p;
      const flow = Math.abs(airU[a]) + Math.abs(airV[a]);
      const m = Math.abs(p) + flow;
      if (m > maxAbs) maxAbs = m;
      // Strong currents move particles even in sleeping chunks.
      if (last && flow > 0.05) {
        const i = y * 2 * w + x * 2;
        if (type[i] !== 0) sim.wake(i);
      }
    }
  }
  return maxAbs;
}
