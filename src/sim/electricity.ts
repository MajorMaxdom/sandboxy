import { P, ID } from '../elements/registry';
import { CHARGE_MAX } from '../elements/props';
import type { Simulation } from './simulation';

const HEAD = CHARGE_MAX - 1;

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
  let any = false;

  for (let i = 0; i < size; i++) {
    if (charge[i] > 0) {
      charge[i]--;
      any = true;
    } else if (type[i] === battery) {
      any = true;
    }
  }
  if (!any) return;

  for (let i = 0; i < size; i++) {
    const c = charge[i];
    const t = type[i];
    if (c !== HEAD && t !== battery) continue;
    if (t !== battery && !P.conducts[t]) continue; // gate signals don't spread on their own
    if (t === sw && life[i] === 0) continue;
    const x = i % w;
    const y = (i - x) / w;
    for (let k = 0; k < 4; k++) {
      let j: number;
      if (k === 0) { if (y === 0) continue; j = i - w; }
      else if (k === 1) { if (y === h - 1) continue; j = i + w; }
      else if (k === 2) { if (x === 0) continue; j = i - 1; }
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
