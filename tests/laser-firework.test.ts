import { describe, expect, it } from 'vitest';
import { ID, P } from '../src/elements/registry';
import { hexToRgb565, rgb565ToHex, rgb565ToPixel } from '../src/elements/color';
import { paintCircle } from '../src/sim/brush';
import { deserialize, fromBase64, gunzip, gzip, serialize, toBase64 } from '../src/io/save';
import { at, count, makeSim, put, run } from './helpers';
import type { Simulation } from '../src/sim/simulation';

function laser(sim: Simulation, x: number, y: number, dir: string, hex: string): number {
  const i = put(sim, x, y, `laser ${dir}`);
  sim.life[i] = hexToRgb565(hex);
  return i;
}

describe('colors', () => {
  it('RGB565 keeps pure colors and white', () => {
    for (const hex of ['#ffffff', '#000000', '#ff0000', '#00ff00', '#0000ff']) {
      expect(rgb565ToHex(hexToRgb565(hex))).toBe(hex);
    }
  });
});

describe('laser', () => {
  it('shines its color through empty space and glass up to the first obstacle', () => {
    const sim = makeSim(40, 10);
    laser(sim, 2, 5, 'right', '#00ff00');
    put(sim, 15, 5, 'glass');
    put(sim, 30, 5, 'stone');
    run(sim, 2);
    const green = rgb565ToPixel(hexToRgb565('#00ff00'));
    expect(sim.beam[5 * 40 + 3]).toBe(green);
    expect(sim.beam[5 * 40 + 20]).toBe(green); // behind the glass
    expect(sim.beam[5 * 40 + 29]).toBe(green);
    expect(sim.beam[5 * 40 + 31]).toBe(0); // blocked by stone
    expect(sim.beam[4 * 40 + 10]).toBe(0); // only its own row
  });

  it('points in all four directions', () => {
    const sim = makeSim(30, 30);
    laser(sim, 15, 15, 'up', '#ffffff');
    laser(sim, 5, 5, 'down', '#ffffff');
    laser(sim, 25, 10, 'left', '#ffffff');
    run(sim, 1);
    expect(sim.beam[2 * 30 + 15]).not.toBe(0);
    expect(sim.beam[20 * 30 + 5]).not.toBe(0);
    expect(sim.beam[10 * 30 + 1]).not.toBe(0);
  });

  it('beams disappear when the laser is erased', () => {
    const sim = makeSim(30, 10);
    const i = laser(sim, 2, 5, 'right', '#ff0000');
    run(sim, 2);
    expect(sim.beam[5 * 30 + 10]).not.toBe(0);
    sim.spawn(i, 0);
    run(sim, 1);
    expect(sim.beam.every((b) => b === 0)).toBe(true);
  });

  it('sets wood on fire and melts ice', () => {
    const sim = makeSim(40, 20);
    laser(sim, 2, 5, 'right', '#ff0000');
    for (let y = 3; y < 8; y++) for (let x = 20; x < 24; x++) put(sim, x, y, 'wood');
    laser(sim, 2, 15, 'right', '#0000ff');
    for (let x = 20; x < 24; x++) put(sim, x, 15, 'ice');
    put(sim, 19, 16, 'wall');
    let burned = false;
    for (let t = 0; t < 600 && !burned; t++) {
      sim.step();
      burned = count(sim, 'fire') > 0 || count(sim, 'wood') < 20;
    }
    expect(burned).toBe(true);
    run(sim, 400);
    expect(count(sim, 'ice')).toBeLessThan(4);
  });

  it('a wired laser only shines while current arrives', () => {
    const sim = makeSim(40, 10);
    laser(sim, 5, 5, 'right', '#ffffff');
    for (let x = 0; x < 5; x++) put(sim, x, 6, 'copper');
    put(sim, 5, 6, 'copper');
    run(sim, 20);
    expect(sim.beam[5 * 40 + 20]).toBe(0);
    put(sim, 0, 7, 'battery');
    run(sim, 20);
    expect(sim.beam[5 * 40 + 20]).not.toBe(0);
  });

  it('painting over a laser with another color recolors it', () => {
    const sim = makeSim(20, 10);
    const i = laser(sim, 5, 5, 'right', '#ff0000');
    const blue = hexToRgb565('#0000ff');
    paintCircle(sim, 5, 5, { kind: 'element', id: ID['laser right'], param: blue }, { radius: 0, replace: false });
    expect(sim.life[i]).toBe(blue);
    expect(at(sim, 5, 5)).toBe(ID['laser right']);
  });
});

describe('firework filling', () => {
  function launch(filling: string | null): Simulation {
    const sim = makeSim(60, 80);
    for (let x = 0; x < 60; x++) put(sim, x, 79, 'wall');
    const i = put(sim, 30, 78, 'firework');
    if (filling) sim.life[i] = ID[filling];
    sim.temp[i] = 300;
    run(sim, 120);
    return sim;
  }

  it('bursts into sparks by default', () => {
    const sim = launch(null);
    expect(count(sim, 'firework') + count(sim, 'rocket')).toBe(0);
    expect(count(sim, 'water')).toBe(0);
  });

  it('bursts into its filling', () => {
    const sim = launch('water');
    expect(count(sim, 'firework') + count(sim, 'rocket')).toBe(0);
    expect(count(sim, 'water')).toBeGreaterThan(20);
  });

  it('the brush stores the chosen filling', () => {
    const sim = makeSim(20, 20);
    paintCircle(sim, 10, 10, { kind: 'element', id: ID.firework, param: ID.sand }, { radius: 0, replace: false, solid: true });
    expect(sim.life[10 * 20 + 10]).toBe(ID.sand);
  });

  it('a firework pile at rest lets its chunk sleep', () => {
    const sim = makeSim(48, 48);
    for (let x = 0; x < 48; x++) put(sim, x, 47, 'wall');
    for (let y = 40; y < 47; y++) for (let x = 10; x < 20; x++) put(sim, x, y, 'firework');
    run(sim, 200);
    expect(sim.awakeCount()).toBe(0);
  });
});

describe('saving element ids in life', () => {
  it('remaps firework and rocket fillings when the element list is reordered', async () => {
    const a = makeSim(20, 20);
    const f = put(a, 3, 3, 'firework');
    a.life[f] = ID.water;
    const r = put(a, 8, 3, 'rocket');
    a.life[r] = 30 | (ID.acid << 6);
    put(a, 12, 3, 'laser right');
    a.life[12 + 3 * 20] = hexToRgb565('#123456');
    const file = await serialize(a);

    // Pretend the file came from a build with the element list reversed.
    const n = file.names.length;
    const raw = await gunzip(fromBase64(file.data));
    const size = a.size;
    const life = new Uint16Array(raw.buffer.slice(size * 3, size * 5));
    for (let i = 0; i < size; i++) {
      const t = raw[i];
      if (t === ID.firework) life[i] = n - 1 - life[i];
      if (t === ID.rocket) life[i] = (life[i] & 63) | ((n - 1 - (life[i] >> 6)) << 6);
      raw[i] = n - 1 - t;
    }
    raw.set(new Uint8Array(life.buffer), size * 3);
    const reversed = { ...file, names: [...file.names].reverse(), data: toBase64(await gzip(raw)) };

    const b = makeSim(5, 5);
    await deserialize(b, reversed);
    expect(Array.from(b.type)).toEqual(Array.from(a.type));
    expect(Array.from(b.life)).toEqual(Array.from(a.life));
    expect(P.n).toBe(n);
  });
});
