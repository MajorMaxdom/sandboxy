import { describe, expect, it } from 'vitest';
import { ID } from '../src/elements/registry';
import { blowCircle, paintCircle } from '../src/sim/brush';
import { makeSim, put } from './helpers';

describe('tools', () => {
  it('the wind tool blows smoke the way the brush is dragged', () => {
    const sim = makeSim(60, 20, 5);
    for (let y = 8; y < 12; y++) for (let x = 20; x < 26; x++) put(sim, x, y, 'smoke');
    const meanX = () => {
      let s = 0;
      let n = 0;
      for (let i = 0; i < sim.size; i++) if (sim.type[i] === ID.smoke) { s += i % 60; n++; }
      return s / n;
    };
    const before = meanX();
    for (let t = 0; t < 20; t++) {
      blowCircle(sim, 23, 10, 3, 0, 3); // dragging right, 3 cells per frame
      sim.step();
    }
    expect(meanX()).toBeGreaterThan(before + 8);
  });

  it('the wind tool does not move walls or metal', () => {
    const sim = makeSim(30, 10, 5);
    for (let x = 0; x < 30; x++) put(sim, x, 9, 'wall');
    for (let x = 10; x < 15; x++) put(sim, x, 8, 'metal');
    for (let t = 0; t < 20; t++) {
      blowCircle(sim, 12, 8, 4, 0, 4);
      sim.step();
    }
    for (let x = 10; x < 15; x++) expect(sim.type[8 * 30 + x]).toBe(ID.metal);
  });

  it('the heat tool melts the ice it touches, the cool tool freezes water', () => {
    const sim = makeSim(20, 10, 5);
    for (let x = 0; x < 20; x++) put(sim, x, 9, 'wall');
    const ice = put(sim, 5, 8, 'ice');
    for (let t = 0; t < 40 && sim.type[ice] === ID.ice; t++) {
      paintCircle(sim, 5, 8, { kind: 'heat' }, { radius: 0, replace: false });
      sim.step();
    }
    expect(sim.type[ice]).not.toBe(ID.ice);
    put(sim, 14, 8, 'wall');
    put(sim, 16, 8, 'wall');
    const water = put(sim, 15, 8, 'water');
    for (let t = 0; t < 40 && sim.type[water] === ID.water; t++) {
      paintCircle(sim, 15, 8, { kind: 'cool' }, { radius: 0, replace: false });
      sim.step();
    }
    expect(sim.type[water]).toBe(ID.ice);
  });
});
