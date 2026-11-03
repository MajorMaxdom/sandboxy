import { describe, expect, it } from 'vitest';
import { ELEMENTS, ID, CATEGORIES, paletteElements } from '../src/elements/registry';
import { CHARGE_MAX } from '../src/elements/props';
import { hexToRgb565, rgb565ToPixel } from '../src/elements/color';
import { deserialize, serialize } from '../src/io/save';
import { at, count, makeSim, put, run } from './helpers';
import type { Simulation } from '../src/sim/simulation';

const beamAt = (sim: Simulation, x: number, y: number) => sim.beam[y * sim.w + x];
const px = (hex: string) => rgb565ToPixel(hexToRgb565(hex));

function laser(sim: Simulation, x: number, y: number, dir: string, hex = '#ffffff'): void {
  const i = put(sim, x, y, `laser ${dir}`);
  sim.life[i] = hexToRgb565(hex);
}

/** Number of fresh pulses arriving at cell (x, y) over `ticks`. */
function pulses(sim: Simulation, x: number, y: number, ticks: number): number {
  let n = 0;
  for (let t = 0; t < ticks; t++) {
    sim.step();
    if (sim.charge[y * sim.w + x] === CHARGE_MAX) n++;
  }
  return n;
}

describe('light: mirrors, filters, receivers', () => {
  it('mirrors turn the beam by 90°', () => {
    const sim = makeSim(30, 30);
    laser(sim, 2, 10, 'right');
    put(sim, 10, 10, 'mirror slash'); // right → up
    laser(sim, 2, 20, 'right');
    put(sim, 15, 20, 'mirror backslash'); // right → down
    run(sim, 2);
    expect(beamAt(sim, 10, 4)).not.toBe(0);
    expect(beamAt(sim, 12, 10)).toBe(0);
    expect(beamAt(sim, 15, 26)).not.toBe(0);
    expect(beamAt(sim, 18, 20)).toBe(0);
  });

  it('a beam bounces around a square of mirrors back to its laser', () => {
    const sim = makeSim(20, 20);
    // right → up → left → down → right, ending at the laser itself.
    laser(sim, 8, 15, 'right');
    put(sim, 15, 15, 'mirror slash');
    put(sim, 15, 5, 'mirror backslash');
    put(sim, 5, 5, 'mirror slash');
    put(sim, 5, 15, 'mirror backslash');
    run(sim, 3);
    expect(beamAt(sim, 15, 10)).not.toBe(0);
    expect(beamAt(sim, 10, 5)).not.toBe(0);
    expect(beamAt(sim, 5, 10)).not.toBe(0);
    expect(beamAt(sim, 7, 15)).not.toBe(0);
  });

  it('a color filter passes only its own color', () => {
    const sim = makeSim(30, 10);
    laser(sim, 1, 2, 'right', '#ffffff');
    const f1 = put(sim, 10, 2, 'color filter');
    sim.life[f1] = hexToRgb565('#ff0000');
    laser(sim, 1, 6, 'right', '#0000ff');
    const f2 = put(sim, 10, 6, 'color filter');
    sim.life[f2] = hexToRgb565('#ff0000');
    run(sim, 2);
    expect(beamAt(sim, 5, 2)).toBe(px('#ffffff'));
    expect(beamAt(sim, 20, 2)).toBe(px('#ff0000')); // white → red
    expect(beamAt(sim, 5, 6)).not.toBe(0);
    expect(beamAt(sim, 20, 6)).toBe(0); // blue swallowed
  });

  it('a lit solar cell powers a wire', () => {
    const sim = makeSim(30, 6);
    put(sim, 20, 2, 'solar cell');
    for (let y = 3; y < 6; y++) put(sim, 20, y, 'copper');
    expect(pulses(sim, 20, 4, 60)).toBe(0);
    laser(sim, 2, 2, 'right');
    expect(pulses(sim, 20, 4, 60)).toBeGreaterThan(3);
  });

  it('a light sensor makes a light barrier', () => {
    const sim = makeSim(30, 6);
    put(sim, 20, 2, 'light sensor');
    for (let y = 3; y < 6; y++) put(sim, 20, y, 'copper');
    laser(sim, 2, 2, 'right');
    expect(pulses(sim, 20, 4, 60)).toBeGreaterThan(3);
    put(sim, 10, 2, 'stone'); // block the beam
    run(sim, 10);
    expect(pulses(sim, 20, 4, 60)).toBe(0);
  });
});

describe('fire and chemistry', () => {
  function woodLeft(fill: string | null): number {
    const sim = makeSim(30, 30);
    for (let x = 0; x < 30; x++) for (let y = 0; y < 30; y++) if (x === 0 || y === 0 || x === 29 || y === 29) put(sim, x, y, 'wall');
    if (fill) for (let y = 1; y < 29; y++) for (let x = 1; x < 29; x++) put(sim, x, y, fill);
    for (let y = 20; y < 28; y++) for (let x = 10; x < 20; x++) put(sim, x, y, 'wood');
    sim.temp[27 * 30 + 15] = 800;
    run(sim, 200);
    return count(sim, 'wood');
  }

  it('oxygen makes wood burn much faster, CO₂ puts it out', () => {
    const air = woodLeft(null);
    const oxygen = woodLeft('oxygen');
    const co2 = woodLeft('co2');
    expect(oxygen).toBeLessThan(air * 0.6);
    expect(co2).toBeGreaterThan(75);
    expect(co2).toBeGreaterThan(air);
  });

  it('CO₂ sinks below air and oxygen hardly rises', () => {
    const sim = makeSim(10, 40);
    for (let x = 0; x < 10; x++) put(sim, x, 5, 'co2');
    run(sim, 400);
    let sum = 0;
    for (let i = 0; i < sim.size; i++) if (sim.type[i] === ID.co2) sum += Math.floor(i / 10);
    expect(sum / count(sim, 'co2')).toBeGreaterThan(25);
  });

  it('lye neutralises acid into salt water', () => {
    const sim = makeSim(20, 20);
    for (let x = 0; x < 20; x++) put(sim, x, 19, 'wall');
    for (let x = 5; x < 15; x++) put(sim, x, 18, 'acid');
    for (let x = 5; x < 15; x++) put(sim, x, 10, 'lye');
    run(sim, 300);
    expect(count(sim, 'salt water')).toBeGreaterThanOrEqual(4); // 4–16 across seeds
    expect(count(sim, 'wall')).toBe(20);
  });

  it('alcohol burns with a blue flame', () => {
    const sim = makeSim(20, 20);
    for (let x = 0; x < 20; x++) put(sim, x, 19, 'wall');
    for (let y = 16; y < 19; y++) for (let x = 5; x < 15; x++) put(sim, x, y, 'alcohol');
    run(sim, 30);
    for (let i = 0; i < sim.size; i++) if (sim.type[i] === ID.alcohol) { sim.temp[i] = 600; break; }
    let blue = 0;
    for (let t = 0; t < 200; t++) {
      sim.step();
      blue = Math.max(blue, count(sim, 'blue fire'));
    }
    expect(blue).toBeGreaterThan(3);
  });

  it('honey spreads much more slowly than water', () => {
    const width = (key: string) => {
      const sim = makeSim(80, 20);
      for (let x = 0; x < 80; x++) put(sim, x, 19, 'wall');
      for (let y = 10; y < 19; y++) for (let x = 37; x < 43; x++) put(sim, x, y, key);
      run(sim, 150);
      let min = 80;
      let max = 0;
      for (let i = 0; i < sim.size; i++) if (sim.type[i] === ID[key]) { min = Math.min(min, i % 80); max = Math.max(max, i % 80); }
      return max - min;
    };
    expect(width('honey')).toBeLessThan(width('water') * 0.6);
  });
});

describe('new solids', () => {
  it('wax melts when warm and sets again when it cools', () => {
    const sim = makeSim(20, 20);
    for (let x = 0; x < 20; x++) put(sim, x, 19, 'wall');
    const i = put(sim, 10, 10, 'wax');
    sim.temp[i] = 100;
    run(sim, 30);
    expect(count(sim, 'molten wax')).toBe(1);
    run(sim, 3000);
    expect(count(sim, 'wax')).toBe(1);
  });

  it('clay bakes into brick', () => {
    const sim = makeSim(10, 10);
    for (let x = 0; x < 10; x++) put(sim, x, 9, 'wall');
    for (let x = 3; x < 7; x++) put(sim, x, 8, 'clay');
    for (let k = 0; k < 400; k++) {
      for (let x = 3; x < 7; x++) sim.temp[8 * 10 + x] = 1000;
      sim.step();
    }
    expect(count(sim, 'brick')).toBe(4);
  });

  it('rubber insulates electricity and resists acid', () => {
    const sim = makeSim(20, 10);
    put(sim, 1, 5, 'battery');
    put(sim, 2, 5, 'copper');
    put(sim, 3, 5, 'rubber');
    for (let x = 4; x < 8; x++) put(sim, x, 5, 'copper');
    for (let x = 10; x < 15; x++) put(sim, x, 9, 'rubber');
    for (let x = 10; x < 15; x++) put(sim, x, 8, 'acid');
    let charged = false;
    for (let t = 0; t < 100; t++) {
      sim.step();
      if (sim.charge[5 * 20 + 6] > 0) charged = true;
    }
    expect(charged).toBe(false);
    expect(count(sim, 'rubber')).toBe(6);
  });

  it('paper burns much faster than wood', () => {
    const left = (key: string) => {
      const sim = makeSim(30, 20);
      for (let y = 5; y < 15; y++) for (let x = 5; x < 25; x++) put(sim, x, y, key);
      sim.temp[14 * 30 + 15] = 800;
      run(sim, 200);
      return count(sim, key);
    };
    expect(left('paper')).toBeLessThan(left('wood') * 0.5);
  });
});

describe('logic', () => {
  /** Gate at (5,4), output wire to the right, clocks wired to top/bottom on request. */
  function gate(key: string, top: boolean, bottom: boolean): number {
    const sim = makeSim(12, 9);
    put(sim, 5, 4, key);
    for (let x = 6; x < 10; x++) put(sim, x, 4, 'copper');
    if (top) { put(sim, 5, 0, 'clock'); for (let y = 1; y < 4; y++) put(sim, 5, y, 'copper'); }
    if (bottom) { put(sim, 5, 8, 'clock'); for (let y = 5; y < 8; y++) put(sim, 5, y, 'copper'); }
    return pulses(sim, 8, 4, 150);
  }

  it('OR gate fires with either input', () => {
    expect(gate('or gate', true, false)).toBeGreaterThan(2);
    expect(gate('or gate', false, true)).toBeGreaterThan(2);
    expect(gate('or gate', true, true)).toBeGreaterThan(2);
    expect(gate('or gate', false, false)).toBe(0);
  });

  it('XOR gate fires with exactly one input', () => {
    expect(gate('xor gate', true, false)).toBeGreaterThan(2);
    expect(gate('xor gate', false, true)).toBeGreaterThan(2);
    expect(gate('xor gate', true, true)).toBe(0);
    expect(gate('xor gate', false, false)).toBe(0);
  });

  it('flipflop toggles with each pulse from the left', () => {
    const sim = makeSim(20, 3);
    const ff = put(sim, 5, 1, 'flipflop');
    for (let x = 6; x < 10; x++) put(sim, x, 1, 'copper');
    expect(pulses(sim, 8, 1, 40)).toBe(0);
    // One pulse from the left: switch a wire on briefly.
    put(sim, 4, 1, 'copper');
    sim.charge[1 * 20 + 4] = CHARGE_MAX + 1;
    run(sim, 3);
    expect(sim.life[ff] & 1).toBe(1);
    expect(pulses(sim, 8, 1, 40)).toBeGreaterThan(2);
    sim.charge[1 * 20 + 4] = CHARGE_MAX + 1;
    run(sim, 20);
    expect(sim.life[ff] & 1).toBe(0);
    expect(pulses(sim, 8, 1, 40)).toBe(0);
  });
});

describe('tech', () => {
  it('a faucet pours its chosen element, wired only under power', () => {
    const sim = makeSim(20, 20);
    const f = put(sim, 5, 2, 'faucet');
    sim.life[f] = ID.oil;
    const g = put(sim, 14, 2, 'faucet');
    sim.life[g] = ID.sand;
    put(sim, 15, 2, 'copper'); // wired, no power
    run(sim, 100);
    expect(count(sim, 'oil')).toBeGreaterThan(10);
    expect(count(sim, 'sand')).toBe(0);
  });

  it('a conveyor belt carries sand sideways', () => {
    const sim = makeSim(40, 10);
    for (let x = 5; x < 35; x++) put(sim, x, 8, 'conveyor right');
    for (let x = 0; x < 40; x++) put(sim, x, 9, 'wall');
    put(sim, 6, 7, 'sand');
    run(sim, 80);
    let x = -1;
    for (let i = 0; i < sim.size; i++) if (sim.type[i] === ID.sand) x = i % 40;
    expect(x).toBeGreaterThan(20);
  });
});

describe('life', () => {
  it('grass spreads over dirt and then lets its chunks sleep', () => {
    const sim = makeSim(64, 20);
    for (let y = 15; y < 20; y++) for (let x = 0; x < 64; x++) put(sim, x, y, 'dirt');
    put(sim, 32, 15, 'grass');
    sim.type[15 * 64 + 32] = ID.grass;
    run(sim, 5000);
    let top = 0;
    for (let x = 0; x < 64; x++) if (at(sim, x, 15) === ID.grass) top++;
    expect(top).toBe(64);
    expect(at(sim, 10, 17)).toBe(ID.dirt); // only the surface
    run(sim, 20);
    expect(sim.awakeCount()).toBe(0);
  });

  it('moss creeps over stone next to water', () => {
    const sim = makeSim(30, 20);
    for (let y = 10; y < 20; y++) for (let x = 0; x < 30; x++) put(sim, x, y, 'stone');
    for (let x = 10; x < 20; x++) put(sim, x, 9, 'water');
    for (let x = 0; x < 30; x++) put(sim, x, 8, 'wall');
    put(sim, 9, 9, 'moss');
    run(sim, 3000);
    expect(count(sim, 'moss')).toBeGreaterThan(5);
  });

  it('algae grow in water (with a limit) and fish eat them', () => {
    const sim = makeSim(30, 30);
    for (let y = 0; y < 30; y++) for (let x = 0; x < 30; x++) put(sim, x, y, y === 29 || x === 0 || x === 29 ? 'wall' : 'water');
    put(sim, 15, 28, 'algae');
    run(sim, 4000);
    const grown = count(sim, 'algae');
    expect(grown).toBeGreaterThan(10);
    expect(grown).toBeLessThan(28 * 28 * 0.6);
    for (let x = 3; x < 27; x += 3) put(sim, x, 10, 'fish');
    run(sim, 4000);
    expect(count(sim, 'algae')).toBeLessThan(grown);
  });

  it('a spider clings to the ceiling and spins web', () => {
    const sim = makeSim(40, 30);
    for (let x = 0; x < 40; x++) put(sim, x, 0, 'wall');
    put(sim, 20, 1, 'spider');
    run(sim, 3000);
    expect(count(sim, 'spider')).toBe(1);
    expect(count(sim, 'web')).toBeGreaterThan(5);
  });
});

describe('special', () => {
  it('a black hole pulls sand in and swallows it', () => {
    const sim = makeSim(40, 40);
    put(sim, 20, 20, 'black hole');
    for (let y = 8; y < 12; y++) for (let x = 15; x < 25; x++) put(sim, x, y, 'sand');
    run(sim, 600);
    expect(count(sim, 'sand')).toBeLessThan(20);
    expect(count(sim, 'black hole')).toBe(1);
  });

  it('antimatter annihilates matter but walls hold it', () => {
    const sim = makeSim(30, 30);
    for (let x = 0; x < 30; x++) put(sim, x, 29, 'wall');
    for (let y = 20; y < 29; y++) for (let x = 2; x < 12; x++) put(sim, x, y, 'stone');
    for (let x = 4; x < 9; x++) put(sim, x, 5, 'antimatter');
    for (let x = 20; x < 24; x++) put(sim, x, 28, 'antimatter'); // straight onto the wall
    run(sim, 200);
    expect(count(sim, 'stone')).toBeLessThan(90);
    expect(count(sim, 'wall')).toBe(30);
    expect(count(sim, 'antimatter')).toBeGreaterThanOrEqual(4);
  });

  it('a converter turns what touches it into the chosen element', () => {
    const sim = makeSim(20, 20);
    for (let x = 5; x < 15; x++) {
      const c = put(sim, x, 15, 'converter');
      sim.life[c] = ID.gold;
    }
    for (let y = 5; y < 10; y++) put(sim, 10, y, 'sand');
    run(sim, 300);
    expect(count(sim, 'gold')).toBeGreaterThan(2);
  });

  it('portals carry sand to the exit of the same channel only', () => {
    const sim = makeSim(60, 30);
    const blue = hexToRgb565('#3fa9ff');
    const red = hexToRgb565('#ff0000');
    const pin = put(sim, 10, 20, 'portal in');
    sim.life[pin] = blue;
    const outBlue = put(sim, 40, 5, 'portal out');
    sim.life[outBlue] = blue;
    const outRed = put(sim, 20, 5, 'portal out');
    sim.life[outRed] = red;
    for (let x = 0; x < 60; x++) put(sim, x, 29, 'wall');
    for (let y = 2; y < 12; y++) put(sim, 10, y, 'sand');
    run(sim, 300);
    let nearBlue = 0;
    let nearRed = 0;
    for (let i = 0; i < sim.size; i++) {
      if (sim.type[i] !== ID.sand) continue;
      const x = i % 60;
      if (Math.abs(x - 40) < 8) nearBlue++;
      if (Math.abs(x - 20) < 6) nearRed++;
    }
    expect(nearBlue).toBeGreaterThan(5);
    expect(nearRed).toBe(0);
  });
});

describe('bookkeeping', () => {
  it('every palette element has a description and the expected count', () => {
    let n = 0;
    for (const c of CATEGORIES) {
      for (const d of paletteElements(c.key)) {
        n++;
        expect(d.description, d.key).toBeTruthy();
      }
    }
    expect(n).toBe(139);
    expect(ELEMENTS.length).toBeLessThan(256);
  });

  it('element ids in life survive a save for converter and faucet', async () => {
    const a = makeSim(10, 10);
    const c = put(a, 2, 2, 'converter');
    a.life[c] = ID.gold;
    const f = put(a, 5, 2, 'faucet');
    a.life[f] = ID.honey;
    const b = makeSim(5, 5);
    await deserialize(b, JSON.parse(JSON.stringify(await serialize(a))));
    expect(b.life[c]).toBe(ID.gold);
    expect(b.life[f]).toBe(ID.honey);
  });
});
