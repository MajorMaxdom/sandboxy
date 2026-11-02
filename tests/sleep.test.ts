import { describe, expect, it } from 'vitest';
import { ID } from '../src/elements/registry';
import { count, makeSim, put, run } from './helpers';
import type { Simulation } from '../src/sim/simulation';

function meanX(sim: Simulation, key: string): number {
  const id = ID[key];
  let sum = 0;
  let n = 0;
  for (let i = 0; i < sim.size; i++) if (sim.type[i] === id) { sum += i % sim.w; n++; }
  return n ? sum / n : -1;
}

/** Fill the bottom `rows` rows completely with `key`. */
function floor(sim: Simulation, rows: number, key: string): void {
  for (let y = sim.h - rows; y < sim.h; y++) for (let x = 0; x < sim.w; x++) put(sim, x, y, key);
}

describe('sleeping chunks and global wind', () => {
  it('wind still picks up light dust that had already gone to sleep', () => {
    const sim = makeSim(96, 32);
    floor(sim, 2, 'wall');
    for (let x = 10; x < 16; x++) for (let y = 24; y < 30; y++) put(sim, x, y, 'ash');
    run(sim, 200);
    expect(sim.awakeCount()).toBe(0);
    const before = meanX(sim, 'ash');
    sim.wind = 5;
    run(sim, 300);
    expect(meanX(sim, 'ash')).toBeGreaterThan(before + 10);
  });

  it('a settled scene keeps sleeping in the wind when nothing can be blown', () => {
    const sim = makeSim(64, 48);
    floor(sim, 10, 'sand');
    run(sim, 100);
    sim.wind = 3;
    run(sim, 60);
    expect(sim.awakeCount()).toBe(0);
  });
});

describe('sleeping chunks and temperature', () => {
  it('heat spreads into resting chunks in every direction', () => {
    const sim = makeSim(80, 80);
    for (let y = 0; y < 80; y++) for (let x = 0; x < 80; x++) put(sim, x, y, 'stone');
    run(sim, 5);
    // Heat a block directly (as the heat brush does), without waking anything.
    for (let y = 38; y < 42; y++) for (let x = 38; x < 42; x++) sim.temp[y * 80 + x] = 1000;
    run(sim, 400);
    const t = (x: number, y: number) => sim.temp[y * 80 + x];
    const left = t(26, 40);
    const right = t(53, 40);
    const up = t(40, 26);
    const down = t(40, 53);
    for (const v of [left, right, up, down]) expect(v).toBeGreaterThan(22);
    // Roughly symmetric: skipping chunks must not favour a direction.
    expect(Math.max(left, right, up, down) / Math.min(left, right, up, down)).toBeLessThan(1.5);
  });

  it('ice that warmed up melts even in a resting chunk', () => {
    const sim = makeSim(48, 48);
    floor(sim, 4, 'wall');
    for (let x = 20; x < 24; x++) put(sim, x, 43, 'ice');
    run(sim, 3);
    for (let i = 0; i < sim.size; i++) if (sim.type[i] === ID.ice) sim.temp[i] = 20;
    run(sim, 200);
    expect(count(sim, 'ice')).toBe(0);
  });

  it('a scene at room temperature does no heat work', () => {
    const sim = makeSim(64, 64);
    floor(sim, 8, 'stone');
    run(sim, 50);
    sim.step();
    expect(Array.from(sim.thermal).filter((f) => f & 2).length).toBe(0);
  });
});
