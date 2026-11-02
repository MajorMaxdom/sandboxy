import { describe, expect, it } from 'vitest';
import { ID } from '../src/elements/registry';
import { count, makeSim, put, run } from './helpers';
import type { Simulation } from '../src/sim/simulation';

/** A 16×14 heap of `key` on a wall floor, lit at the bottom. */
function heap(key: string): Simulation {
  const sim = makeSim(40, 40);
  for (let x = 0; x < 40; x++) put(sim, x, 39, 'wall');
  for (let y = 25; y < 39; y++) for (let x = 12; x < 28; x++) put(sim, x, y, key);
  sim.temp[38 * 40 + 20] = 1000;
  return sim;
}

function maxTemp(sim: Simulation): number {
  let m = -Infinity;
  for (let i = 0; i < sim.size; i++) if (sim.temp[i] > m) m = sim.temp[i];
  return m;
}

describe('burning stays within its heat', () => {
  it('a burning wood pile never gets much hotter than its flames', () => {
    const sim = heap('wood');
    let max = 0;
    for (let t = 0; t < 1500; t++) {
      sim.step();
      max = Math.max(max, maxTemp(sim));
    }
    expect(count(sim, 'wood')).toBeLessThan(224); // it did burn
    expect(max).toBeLessThan(1200);
  });

  it('chained explosions do not stack heat beyond the blast core', () => {
    const sim = heap('gunpowder');
    let max = 0;
    for (let t = 0; t < 30; t++) {
      sim.step();
      max = Math.max(max, maxTemp(sim));
    }
    expect(max).toBeLessThanOrEqual(2600);
  });
});

describe('coal', () => {
  it('burns down slowly as hot ember and leaves ash', () => {
    const sim = heap('coal');
    run(sim, 1800); // 30 s
    expect(count(sim, 'ember')).toBeGreaterThan(100);
    const max = maxTemp(sim);
    expect(max).toBeGreaterThan(1000);
    expect(max).toBeLessThan(1300);
    run(sim, 1800); // 60 s: still glowing
    expect(count(sim, 'ember')).toBeGreaterThan(100);
    run(sim, 6000);
    expect(count(sim, 'ember') + count(sim, 'coal')).toBe(0);
    expect(count(sim, 'ash')).toBeGreaterThan(50);
  });

  it('ember sets neighbouring wood on fire', () => {
    const sim = makeSim(30, 20);
    for (let x = 0; x < 30; x++) put(sim, x, 19, 'wall');
    for (let x = 10; x < 20; x++) put(sim, x, 18, 'ember');
    for (let x = 10; x < 20; x++) for (let y = 15; y < 18; y++) put(sim, x, y, 'wood');
    run(sim, 600);
    expect(count(sim, 'wood')).toBeLessThan(30);
  });

  it('water puts ember out and turns it back into coal', () => {
    const sim = makeSim(30, 20);
    for (let x = 0; x < 30; x++) put(sim, x, 19, 'wall');
    for (let x = 10; x < 20; x++) put(sim, x, 18, 'ember');
    for (let x = 10; x < 20; x++) for (let y = 10; y < 13; y++) put(sim, x, y, 'water');
    run(sim, 200);
    expect(count(sim, 'ember')).toBe(0);
    expect(count(sim, 'coal')).toBe(10);
    expect(sim.type[18 * 30 + 15]).toBe(ID.coal);
  });
});
