import { P, ID } from '../elements/registry';
import { GAS } from '../elements/props';
import type { Simulation } from './simulation';

/**
 * Check one random neighbour against the precomputed reaction table.
 * Returns true if this cell changed.
 */
export function react(sim: Simulation, i: number, x: number, y: number, id: number): boolean {
  const j = sim.randomNeighbor4(x, y);
  if (j < 0) return false;
  const other = sim.type[j];
  if (other === 0) return false;
  const ri = P.reactTable[id * P.n + other];
  if (ri < 0) return false;
  const r = P.reactions[ri];
  if (sim.rng.next() >= r.chance) return false;
  if (r.otherInto >= 0) sim.transform(j, r.otherInto);
  if (r.into >= 0) {
    sim.transform(i, r.into);
    return true;
  }
  return false;
}

/**
 * A flammable cell above its ignition temperature: heats itself up, throws
 * flames at free neighbours, and eventually burns away. Returns true if the
 * cell was consumed.
 */
export function burn(sim: Simulation, i: number, x: number, y: number, id: number): boolean {
  const rng = sim.rng;
  const r = rng.next();
  const chance = P.burnChance[id];
  const heat = P.burnHeat[id];
  // Solids/powders must reach full burning heat before they can burn away,
  // which gives the flames time to creep on to the next piece (fuses!).
  const hotEnough = P.state[id] === GAS || chance >= 1 || sim.temp[i] >= heat * 0.9;
  if (hotEnough && r < chance) {
    const into = P.burnInto[id];
    sim.transform(i, into[rng.int(into.length)]);
    if (sim.temp[i] < heat) sim.temp[i] = heat;
    return true;
  }
  if (r < chance + P.burnSpread[id]) {
    const j = sim.randomNeighbor8(x, y);
    if (j >= 0 && sim.type[j] === 0) sim.transform(j, ID.fire);
  }
  // Fire creeps directly into touching flammables, and sets off explosives.
  for (const j of sim.neighbors4(x, y)) {
    const t = sim.type[j];
    const expl = P.explIgnite[t];
    if (expl !== Infinity) sim.temp[j] = Math.max(sim.temp[j], expl + 50);
    // Heat flammable neighbours, but never beyond this fire's own heat:
    // otherwise burning cells push each other up without limit.
    else if (P.burnIgnite[t] !== Infinity && sim.temp[j] < heat) sim.temp[j] = Math.min(heat, sim.temp[j] + 25);
  }
  const t = sim.temp[i] + 20;
  sim.temp[i] = t > heat ? Math.max(sim.temp[i], heat) : t;
  return false;
}
