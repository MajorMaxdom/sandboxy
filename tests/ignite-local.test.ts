import { describe, expect, it } from 'vitest';
import { ID } from '../src/elements/registry';
import { makeSim, put } from './helpers';

describe('heat and flames stay where they are', () => {
  it('lava dropped on an oil pool ignites it only near the lava', () => {
    const W = 215;
    const H = 230;
    const sim = makeSim(W, H);
    for (let y = 170; y < H; y++) for (let x = 0; x < W; x++) put(sim, x, y, 'water');
    for (let y = 120; y < 170; y++) for (let x = 0; x < W; x++) put(sim, x, y, 'oil');
    for (let t = 0; t < 60; t++) sim.step();
    for (let y = 100; y < 104; y++) for (let x = 40; x < 44; x++) put(sim, x, y, 'lava');
    // The fire front may only advance from the lava, so every hot cell must
    // have had a hot cell close by in the previous tick.
    let jumps = 0;
    for (let t = 0; t < 120; t++) {
      const hot = new Uint8Array(sim.size);
      for (let i = 0; i < sim.size; i++) if (sim.temp[i] > 150) hot[i] = 1;
      sim.step();
      for (let i = 0; i < sim.size; i++) {
        if (hot[i] || sim.temp[i] <= 150) continue;
        const x = i % W;
        const y = (i - x) / W;
        let near = false;
        for (let dy = -6; dy <= 6 && !near; dy++) {
          for (let dx = -6; dx <= 6; dx++) {
            const xx = x + dx;
            const yy = y + dy;
            if (xx >= 0 && yy >= 0 && xx < W && yy < H && hot[yy * W + xx]) { near = true; break; }
          }
        }
        if (!near) jumps++;
      }
    }
    expect(jumps).toBe(0);
  });

  it('a steam bubble rises through water instead of being shoved sideways', () => {
    const sim = makeSim(20, 60);
    for (let y = 0; y < 60; y++) { put(sim, 0, y, 'glass'); put(sim, 19, y, 'glass'); }
    for (let x = 0; x < 20; x++) put(sim, x, 59, 'glass');
    for (let y = 20; y < 59; y++) for (let x = 1; x < 19; x++) { put(sim, x, y, 'water'); sim.temp[y * 20 + x] = 99; }
    const i = put(sim, 10, 57, 'steam');
    sim.temp[i] = 150;
    for (let t = 0; t < 20; t++) sim.step();
    let top = 99;
    for (let j = 0; j < sim.size; j++) if (sim.type[j] === ID.steam) top = Math.min(top, Math.floor(j / 20));
    expect(top).toBeLessThan(45);
  });
});
