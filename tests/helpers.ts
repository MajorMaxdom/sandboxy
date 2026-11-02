import { ID } from '../src/elements/registry';
import { Simulation } from '../src/sim/simulation';

export function makeSim(w: number, h: number, seed = 42): Simulation {
  return new Simulation(w, h, seed);
}

export function put(sim: Simulation, x: number, y: number, key: string): number {
  const i = y * sim.w + x;
  sim.spawn(i, ID[key]);
  return i;
}

export function at(sim: Simulation, x: number, y: number): number {
  return sim.type[y * sim.w + x];
}

export function count(sim: Simulation, key: string): number {
  const id = ID[key];
  let n = 0;
  for (let i = 0; i < sim.size; i++) if (sim.type[i] === id) n++;
  return n;
}

export function run(sim: Simulation, ticks: number): void {
  for (let t = 0; t < ticks; t++) sim.step();
}

/** Lowest row (largest y) containing `key`, or -1. */
export function meanY(sim: Simulation, key: string): number {
  const id = ID[key];
  let sum = 0;
  let n = 0;
  for (let i = 0; i < sim.size; i++) {
    if (sim.type[i] === id) {
      sum += Math.floor(i / sim.w);
      n++;
    }
  }
  return n ? sum / n : -1;
}
