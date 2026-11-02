import { P, ID } from '../elements/registry';
import { CHARGE_MAX } from '../elements/props';
import type { Simulation } from './simulation';

const HEAD = CHARGE_MAX - 1;

/** Reused list of cells that spread current this tick. */
let active = new Int32Array(0);

/**
 * Electricity travels as pulses through conductors, one cell per tick.
 * A freshly powered cell has charge CHARGE_MAX; it counts down each tick.
 * Cells at HEAD (powered last tick) power idle neighbours; cells still
 * counting down are refractory, so pulses never flow backwards.
 */
export function electricityPass(sim: Simulation): void {
  const { w, h, type, charge, temp } = sim;
  const size = sim.size;
  const battery = ID.battery;
  const sw = ID.switch;
  const life = sim.life;
  // Count down all charges and collect the cells that may push current on:
  // pulse heads and batteries (in index order, as before).
  if (active.length < size) active = new Int32Array(size);
  let n = 0;
  for (let i = 0; i < size; i++) {
    const c = charge[i];
    if (c > 0) {
      charge[i] = c - 1;
      if (c - 1 === HEAD) active[n++] = i;
      else if (type[i] === battery) active[n++] = i;
    } else if (type[i] === battery) {
      active[n++] = i;
    }
  }

  for (let k = 0; k < n; k++) {
    const i = active[k];
    const c = charge[i];
    const t = type[i];
    if (t !== battery && !P.conducts[t]) continue; // gate signals don't spread on their own
    if (t === sw && life[i] === 0) continue;
    const x = i % w;
    const y = (i - x) / w;
    for (let d = 0; d < 4; d++) {
      let j: number;
      if (d === 0) { if (y === 0) continue; j = i - w; }
      else if (d === 1) { if (y === h - 1) continue; j = i + w; }
      else if (d === 2) { if (x === 0) continue; j = i - 1; }
      else { if (x === w - 1) continue; j = i + 1; }
      const nt = type[j];
      if (nt === 0) continue;
      if (P.conducts[nt] && (nt !== sw || life[j] !== 0)) {
        if (charge[j] === 0) charge[j] = CHARGE_MAX;
      } else if (c === HEAD && nt !== battery && !P.logic[nt]) {
        // Current detonates explosives and heats whatever touches the wire.
        const ign = P.explIgnite[nt];
        if (ign !== Infinity) temp[j] = Math.max(temp[j], ign + 50);
        else temp[j] += P.resist[t] * 5; // copper stays cool, titanium glows
      }
    }
    if (c === HEAD) temp[i] += P.resist[t];
  }
}
