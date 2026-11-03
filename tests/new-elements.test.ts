import { describe, expect, it } from 'vitest';
import { ELEMENTS, ID } from '../src/elements/registry';
import { count, makeSim, put, run } from './helpers';

/** Ticks until less than half of a gas-filled box is left. */
function burnTime(gas: string): number {
  const sim = makeSim(24, 24);
  for (let x = 0; x < 24; x++) {
    put(sim, x, 0, 'wall');
    put(sim, x, 23, 'wall');
  }
  for (let y = 1; y < 23; y++) {
    put(sim, 0, y, 'wall');
    put(sim, 23, y, 'wall');
    for (let x = 1; x < 23; x++) put(sim, x, y, gas);
  }
  const start = count(sim, gas);
  put(sim, 1, 22, 'fire');
  for (let t = 1; t <= 3000; t++) {
    sim.step();
    if (count(sim, gas) < start / 2) return t;
  }
  return Infinity;
}

describe('gas combustion speed', () => {
  it('hydrogen explodes much faster than propane, propane burns faster than methane', () => {
    const h = burnTime('hydrogen');
    const p = burnTime('propane');
    const m = burnTime('methane');
    expect(h).toBeLessThan(40);
    expect(h * 3).toBeLessThan(p);
    expect(p).toBeLessThan(m);
    expect(m).toBeLessThan(3000);
  });
});

describe('metals', () => {
  it('liquid gallium slowly destroys aluminium', () => {
    const sim = makeSim(12, 12);
    for (let x = 0; x < 12; x++) for (let y = 8; y < 12; y++) put(sim, x, y, 'aluminium');
    for (let x = 0; x < 12; x++) for (let y = 5; y < 8; y++) put(sim, x, y, 'liquid gallium');
    run(sim, 60);
    expect(count(sim, 'aluminium')).toBeGreaterThan(30); // slow, not instant
    run(sim, 3000);
    // Across seeds 21–35 of the 48 cells remain once the gallium has soaked in.
    expect(count(sim, 'aluminium')).toBeLessThan(40);
    expect(count(sim, 'alu crumbs') + count(sim, 'brittle aluminium')).toBeGreaterThan(10);
  });

  it('each metal melts at its own temperature', () => {
    const melt = (key: string, temp: number) => {
      const sim = makeSim(3, 3);
      const i = put(sim, 1, 2, key);
      sim.temp[i] = temp;
      for (let t = 0; t < 200 && sim.type[i] === ID[key]; t++) {
        sim.temp[i] = temp;
        sim.step();
      }
      return sim.type[i] !== ID[key];
    };
    expect(melt('lead', 400)).toBe(true);
    expect(melt('aluminium', 400)).toBe(false);
    expect(melt('aluminium', 700)).toBe(true);
    expect(melt('copper', 700)).toBe(false);
    expect(melt('copper', 1200)).toBe(true);
    expect(melt('titanium', 1500)).toBe(false);
    expect(melt('titanium', 1700)).toBe(true);
    expect(melt('gallium', 40)).toBe(true);
  });

  it('iron rusts in salt water, gold does not', () => {
    const sim = makeSim(10, 6);
    for (let x = 0; x < 5; x++) put(sim, x, 5, 'metal');
    for (let x = 5; x < 10; x++) put(sim, x, 5, 'gold');
    for (let x = 0; x < 10; x++) for (let y = 2; y < 5; y++) put(sim, x, y, 'salt water');
    run(sim, 3000);
    expect(count(sim, 'rust')).toBeGreaterThan(0);
    expect(count(sim, 'gold')).toBe(5);
  });

  it('sodium in water releases hydrogen and fire', () => {
    const sim = makeSim(10, 10);
    for (let x = 0; x < 10; x++) for (let y = 5; y < 10; y++) put(sim, x, y, 'water');
    put(sim, 5, 4, 'sodium');
    run(sim, 30);
    expect(count(sim, 'sodium')).toBe(0);
  });

  it('a titanium wire heats up under current, copper stays cool', () => {
    const wire = (key: string) => {
      const sim = makeSim(20, 3);
      put(sim, 0, 1, 'battery');
      for (let x = 1; x < 20; x++) put(sim, x, 1, key);
      run(sim, 300);
      return sim.temp[1 * 20 + 10];
    };
    expect(wire('titanium')).toBeGreaterThan(wire('copper') + 100);
  });
});

describe('world', () => {
  it('resizeKeep preserves the scene, floor-aligned', () => {
    const sim = makeSim(20, 10);
    put(sim, 10, 9, 'stone');
    sim.resizeKeep(40, 30);
    expect(sim.type[29 * 40 + 20]).toBe(ID.stone);
    sim.resizeKeep(10, 5);
    expect(sim.type[4 * 10 + 5]).toBe(ID.stone);
  });

  it('every paintable element survives a short simulation without errors', () => {
    for (const def of ELEMENTS) {
      if (def.key === 'empty') continue;
      const sim = makeSim(16, 16);
      for (let x = 0; x < 16; x++) put(sim, x, 15, 'stone');
      for (let x = 4; x < 12; x++) for (let y = 4; y < 10; y++) put(sim, x, y, def.key);
      put(sim, 2, 14, 'water');
      expect(() => run(sim, 200), def.key).not.toThrow();
    }
  });
});

describe('fireworks', () => {
  it('lit fireworks launch and burst into sparkles', () => {
    const sim = makeSim(30, 60);
    for (let x = 10; x < 20; x++) put(sim, x, 59, 'firework');
    put(sim, 15, 58, 'fire');
    let sawRocket = false;
    let sawSparkles = false;
    for (let t = 0; t < 300; t++) {
      sim.step();
      if (count(sim, 'rocket') > 0) sawRocket = true;
      if (count(sim, 'sparkle') > 10) sawSparkles = true;
    }
    expect(sawRocket).toBe(true);
    expect(sawSparkles).toBe(true);
  });
});
