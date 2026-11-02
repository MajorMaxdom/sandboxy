import { describe, expect, it } from 'vitest';
import { count, makeSim, put, run } from './helpers';

describe('temperature', () => {
  it('heat flows from hot to cold and total stays bounded', () => {
    const sim = makeSim(10, 1);
    for (let x = 0; x < 10; x++) put(sim, x, 0, 'metal');
    sim.temp[0] = 1000;
    run(sim, 200);
    expect(sim.temp[9]).toBeGreaterThan(30);
    for (let x = 0; x < 10; x++) expect(sim.temp[x]).toBeLessThan(1000);
  });

  it('ice next to a heater melts and boils away', () => {
    const sim = makeSim(10, 10);
    for (let x = 0; x < 10; x++) put(sim, x, 9, 'heater');
    for (let x = 2; x < 8; x++) put(sim, x, 8, 'ice');
    run(sim, 3000);
    expect(count(sim, 'ice')).toBe(0);
  });

  it('ice lasts a while at room temperature', () => {
    const sim = makeSim(10, 10);
    for (let x = 3; x < 7; x++) for (let y = 6; y < 10; y++) put(sim, x, y, 'ice');
    run(sim, 120); // 2 seconds
    expect(count(sim, 'ice')).toBeGreaterThan(10);
  });

  it('a cooler freezes water', () => {
    const sim = makeSim(8, 8);
    for (let x = 0; x < 8; x++) put(sim, x, 7, 'cooler');
    for (let x = 0; x < 8; x++) for (let y = 4; y < 7; y++) put(sim, x, y, 'water');
    run(sim, 2000);
    expect(count(sim, 'ice')).toBeGreaterThan(10);
  });

  it('sand melts into glass under extreme heat and solidifies again', () => {
    const sim = makeSim(5, 5);
    put(sim, 2, 4, 'sand');
    sim.temp[4 * 5 + 2] = 2500;
    run(sim, 20);
    expect(count(sim, 'molten glass') + count(sim, 'glass')).toBe(1);
    run(sim, 3000);
    expect(count(sim, 'glass')).toBe(1);
  });

  it('lava melts a metal plate', () => {
    const sim = makeSim(30, 20);
    for (let x = 5; x < 25; x++) put(sim, x, 15, 'metal');
    for (let x = 8; x < 22; x++) for (let y = 10; y < 15; y++) put(sim, x, y, 'lava');
    run(sim, 80);
    expect(count(sim, 'metal')).toBeLessThan(15);
    expect(count(sim, 'molten metal')).toBeGreaterThan(5);
  });

  it('steam condenses back to water', () => {
    const sim = makeSim(6, 10);
    for (let x = 0; x < 6; x++) put(sim, x, 9, 'steam');
    run(sim, 6000);
    expect(count(sim, 'water')).toBeGreaterThan(0);
  });
});
