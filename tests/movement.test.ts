import { describe, expect, it } from 'vitest';
import { ID } from '../src/elements/registry';
import { at, count, makeSim, meanY, put, run } from './helpers';

describe('movement', () => {
  it('sand falls to the floor', () => {
    const sim = makeSim(5, 10);
    put(sim, 2, 0, 'sand');
    run(sim, 20);
    expect(at(sim, 2, 9)).toBe(ID.sand);
    expect(count(sim, 'sand')).toBe(1);
  });

  it('static elements stay put', () => {
    const sim = makeSim(5, 10);
    put(sim, 2, 3, 'stone');
    run(sim, 20);
    expect(at(sim, 2, 3)).toBe(ID.stone);
  });

  it('sand piles up instead of stacking in a column', () => {
    const sim = makeSim(21, 12);
    for (let k = 0; k < 30; k++) {
      put(sim, 10, 0, 'sand');
      run(sim, 3);
    }
    run(sim, 60);
    expect(count(sim, 'sand')).toBe(30);
    // A single column would be 30 tall, higher than the 12-row world
    let widest = 0;
    for (let x = 0; x < sim.w; x++) if (at(sim, x, 11) === ID.sand) widest++;
    expect(widest).toBeGreaterThan(3);
  });

  it('water spreads out flat', () => {
    const sim = makeSim(20, 10);
    for (let y = 0; y < 8; y++) put(sim, 10, y, 'water');
    run(sim, 200);
    expect(count(sim, 'water')).toBe(8);
    for (let x = 0; x < sim.w; x++) expect(at(sim, x, 8)).toBe(0);
  });

  it('sand sinks through water', () => {
    const sim = makeSim(3, 10);
    for (let y = 5; y < 10; y++) for (let x = 0; x < 3; x++) put(sim, x, y, 'water');
    put(sim, 1, 0, 'sand');
    run(sim, 100);
    expect(meanY(sim, 'sand')).toBe(9);
  });

  it('oil floats on water', () => {
    const sim = makeSim(4, 10);
    for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) put(sim, x, y + 2, 'water');
    for (let y = 0; y < 2; y++) for (let x = 0; x < 4; x++) put(sim, x, y + 6, 'oil');
    run(sim, 400);
    expect(meanY(sim, 'oil')).toBeLessThan(meanY(sim, 'water'));
  });

  it('light gases rise, chlorine sinks', () => {
    const sim = makeSim(5, 20);
    put(sim, 2, 10, 'hydrogen');
    put(sim, 1, 10, 'chlorine');
    run(sim, 150);
    expect(meanY(sim, 'hydrogen')).toBeLessThan(5);
    expect(meanY(sim, 'chlorine')).toBeGreaterThan(15);
  });
});
