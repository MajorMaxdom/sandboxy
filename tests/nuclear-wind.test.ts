import { describe, expect, it } from 'vitest';
import { ID, P } from '../src/elements/registry';
import { at, count, makeSim, meanY, put, run } from './helpers';

/** Count Geiger counter flashes over `ticks`. */
function geigerHits(withLead: boolean): number {
  const sim = makeSim(40, 20);
  for (let x = 2; x < 10; x++) for (let y = 6; y < 14; y++) put(sim, x, y, 'uranium');
  if (withLead) for (let y = 0; y < 20; y++) for (let x = 14; x < 17; x++) put(sim, x, y, 'lead');
  for (let y = 0; y < 20; y++) put(sim, 22, y, 'geiger');
  let hits = 0;
  const prev = new Uint16Array(20);
  for (let t = 0; t < 1500; t++) {
    sim.step();
    for (let y = 0; y < 20; y++) {
      const l = sim.life[y * 40 + 22];
      if (l > prev[y]) hits++; // counter was re-armed by a hit
      prev[y] = l;
    }
  }
  return hits;
}

describe('radioactivity', () => {
  it('uranium emits radiation that a Geiger counter detects', () => {
    expect(geigerHits(false)).toBeGreaterThan(5);
  });

  it('lead shields radiation', () => {
    expect(geigerHits(true)).toBe(0);
  });

  it('a Geiger counter sends current into an adjacent wire', () => {
    const sim = makeSim(30, 10);
    for (let x = 0; x < 6; x++) for (let y = 3; y < 7; y++) put(sim, x, y, 'uranium');
    for (let y = 0; y < 10; y++) {
      put(sim, 10, y, 'geiger');
      put(sim, 11, y, 'copper');
    }
    let charged = false;
    for (let t = 0; t < 3000 && !charged; t++) {
      sim.step();
      for (let y = 0; y < 10; y++) if (sim.charge[y * 30 + 11] > 0) charged = true;
    }
    expect(charged).toBe(true);
  });

  it('a hit lights the whole connected Geiger counter and every wire touching it', () => {
    const sim = makeSim(40, 20);
    for (let x = 0; x < 6; x++) for (let y = 6; y < 14; y++) put(sim, x, y, 'uranium');
    // A 10×10 counter; a wire touches only its far (right) side.
    for (let x = 12; x < 22; x++) for (let y = 5; y < 15; y++) put(sim, x, y, 'geiger');
    for (let y = 0; y < 20; y++) put(sim, 22, y, 'copper');
    // A separate counter that isn't connected stays dark.
    for (let x = 30; x < 33; x++) for (let y = 0; y < 3; y++) put(sim, x, y, 'geiger');
    let allLit = false;
    let wire = false;
    for (let t = 0; t < 3000 && !(allLit && wire); t++) {
      sim.step();
      let lit = 0;
      for (let x = 12; x < 22; x++) for (let y = 5; y < 15; y++) if (sim.shade[y * 40 + x] === 2) lit++;
      if (lit === 100) allLit = true;
      for (let y = 0; y < 20; y++) if (sim.charge[y * 40 + 22] > 0) wire = true;
    }
    expect(allLit).toBe(true);
    expect(wire).toBe(true);
    for (let x = 30; x < 33; x++) for (let y = 0; y < 3; y++) expect(sim.shade[y * 40 + x]).toBe(0);
  });

  it('radiation kills plants', () => {
    const sim = makeSim(30, 10);
    for (let x = 0; x < 8; x++) for (let y = 2; y < 8; y++) put(sim, x, y, 'plutonium');
    for (let x = 12; x < 14; x++) for (let y = 2; y < 8; y++) put(sim, x, y, 'plant');
    run(sim, 2000);
    expect(count(sim, 'plant')).toBeLessThan(12);
  });

  it('a small lump of plutonium stays subcritical, a big one detonates', () => {
    const small = makeSim(60, 60);
    for (let x = 28; x < 33; x++) for (let y = 28; y < 33; y++) put(small, x, y, 'plutonium');
    run(small, 900);
    expect(count(small, 'plutonium')).toBe(25);

    const big = makeSim(120, 120);
    for (let x = 45; x < 75; x++) for (let y = 45; y < 75; y++) put(big, x, y, 'plutonium');
    run(big, 900);
    expect(count(big, 'plutonium')).toBeLessThan(900 * 0.5);
    expect(count(big, 'fallout')).toBeGreaterThan(0);
  });

  it('a big uranium block heats water to steam', () => {
    const sim = makeSim(30, 30);
    for (let x = 0; x < 30; x++) for (let y = 10; y < 30; y++) put(sim, x, y, 'uranium');
    for (let x = 0; x < 30; x++) for (let y = 5; y < 10; y++) put(sim, x, y, 'water');
    run(sim, 4000);
    expect(count(sim, 'steam')).toBeGreaterThan(0);
  });
});

describe('wind', () => {
  it('global wind blows smoke to the side', () => {
    const sim = makeSim(60, 20);
    for (let y = 15; y < 20; y++) for (let x = 28; x < 32; x++) put(sim, x, y, 'smoke');
    sim.wind = 5;
    run(sim, 60);
    let sumX = 0;
    let n = 0;
    for (let i = 0; i < sim.size; i++) if (sim.type[i] === ID.smoke) { sumX += i % 60; n++; }
    expect(sumX / n).toBeGreaterThan(36);
  });

  it('heavy powder barely moves in the wind', () => {
    const sim = makeSim(60, 10);
    for (let x = 0; x < 60; x++) put(sim, x, 9, 'wall');
    for (let x = 28; x < 32; x++) put(sim, x, 8, 'gravel');
    sim.wind = 5;
    run(sim, 100);
    for (let x = 28; x < 32; x++) expect(at(sim, x, 8)).toBe(ID.gravel);
  });

  it('a fan pushes sand along its beam, a wall stops it', () => {
    const sim = makeSim(60, 12);
    for (let x = 0; x < 60; x++) put(sim, x, 11, 'wall');
    put(sim, 2, 10, 'fan right');
    for (let x = 5; x < 9; x++) put(sim, x, 10, 'ash');
    put(sim, 30, 10, 'wall');
    run(sim, 400);
    let maxX = 0;
    for (let i = 0; i < sim.size; i++) if (sim.type[i] === ID.ash) maxX = Math.max(maxX, i % 60);
    expect(maxX).toBeGreaterThan(15);
    expect(maxX).toBeLessThan(30);
  });

  it('a fan blowing up lifts smoke and light dust faster', () => {
    const sim = makeSim(10, 40);
    put(sim, 5, 39, 'fan up');
    for (let y = 24; y < 38; y += 2) put(sim, 5, y, 'ash');
    const before = meanY(sim, 'ash');
    run(sim, 60);
    expect(meanY(sim, 'ash')).toBeLessThan(before - 3);
  });

  it('fan strength: a stronger fan blows further and harder', () => {
    const meanX = (level: number) => {
      const sim = makeSim(80, 30, 7);
      for (let y = 10; y < 30; y++) for (let x = 0; x < 3; x++) sim.life[put(sim, x, y, 'fan right')] = level;
      for (let y = 12; y < 28; y++) for (let x = 6; x < 30; x++) if ((x + y) % 2) put(sim, x, y, 'smoke');
      run(sim, 60);
      let sum = 0;
      let n = 0;
      for (let i = 0; i < sim.size; i++) if (sim.type[i] === ID.smoke) { sum += i % 80; n++; }
      return sum / n;
    };
    const weak = meanX(1);
    const normal = meanX(5);
    const strong = meanX(10);
    expect(normal).toBeGreaterThan(weak + 5);
    expect(strong).toBeGreaterThan(normal + 3);
  });

  it('a fan sucks gas in at the back and blows it out the front', () => {
    const sim = makeSim(60, 30, 3);
    // A fan wall, 3 cells thick and as high as the world: the only way
    // across is through the fans.
    for (let y = 0; y < 30; y++) for (let x = 28; x < 31; x++) put(sim, x, y, 'fan right');
    for (let y = 2; y < 28; y++) for (let x = 2; x < 20; x++) if ((x + y) % 3 === 0) put(sim, x, y, 'smoke');
    const behind = () => {
      let n = 0;
      for (let i = 0; i < sim.size; i++) if (sim.type[i] === ID.smoke && i % 60 < 28) n++;
      return n;
    };
    const start = behind();
    run(sim, 120);
    expect(behind()).toBeLessThan(start * 0.5);
    let front = 0;
    for (let i = 0; i < sim.size; i++) if (sim.type[i] === ID.smoke && i % 60 > 30) front++;
    expect(front).toBeGreaterThan(start * 0.3);
  });

  it('gas also passes through a long fan bar', () => {
    const sim = makeSim(200, 30, 3);
    // A 160 cell long "fan right" bar, as painted with a line; steam behind its left end.
    for (let y = 14; y < 18; y++) for (let x = 20; x < 180; x++) put(sim, x, y, 'fan right');
    for (let y = 13; y < 19; y++) for (let x = 8; x < 18; x++) if ((x + y) % 2) put(sim, x, y, 'smoke');
    run(sim, 60);
    let front = 0;
    for (let i = 0; i < sim.size; i++) if (sim.type[i] === ID.smoke && i % 200 >= 180) front++;
    expect(front).toBeGreaterThan(5);
  });

  it('sand and water do not pass through a fan', () => {
    const sim = makeSim(30, 20, 3);
    for (let y = 0; y < 20; y++) put(sim, 15, y, 'fan right');
    for (let y = 10; y < 20; y++) for (let x = 5; x < 15; x++) put(sim, x, y, y < 15 ? 'sand' : 'water');
    run(sim, 200);
    let across = 0;
    for (let i = 0; i < sim.size; i++) if ((sim.type[i] === ID.sand || sim.type[i] === ID.water) && i % 30 > 15) across++;
    expect(across).toBe(0);
  });

  it('a fan painted without a strength uses the default (5)', () => {
    expect(P.defaultParam[ID['fan right']]).toBe(5);
  });

  it('a wind turbine generates current only when there is wind', () => {
    const turbine = (wind: number) => {
      const sim = makeSim(10, 5);
      put(sim, 4, 2, 'wind turbine');
      put(sim, 5, 2, 'copper');
      sim.wind = wind;
      let pulses = 0;
      for (let t = 0; t < 300; t++) {
        sim.step();
        if (sim.charge[2 * 10 + 5] === 5) pulses++;
      }
      return pulses;
    };
    expect(turbine(0)).toBe(0);
    expect(turbine(5)).toBeGreaterThan(5);
  });

  it('a steam turbine makes current from steam and a lamp lights up', () => {
    const sim = makeSim(10, 10);
    put(sim, 4, 3, 'steam turbine');
    put(sim, 5, 3, 'lamp');
    let lit = false;
    for (let t = 0; t < 300 && !lit; t++) {
      if (sim.type[4 * 10 + 4] === 0) put(sim, 4, 4, 'steam');
      sim.step();
      if (sim.shade[3 * 10 + 5] === 2) lit = true;
    }
    expect(lit).toBe(true);
  });
});

describe('generator blocks', () => {
  it('a long steam turbine powers a wire attached at the far end', () => {
    const sim = makeSim(30, 10);
    for (let x = 2; x < 20; x++) put(sim, x, 3, 'steam turbine');
    put(sim, 20, 3, 'lamp');
    let lit = false;
    for (let t = 0; t < 400 && !lit; t++) {
      if (sim.type[4 * 30 + 3] === 0) put(sim, 3, 4, 'steam'); // steam only at the left end
      sim.step();
      if (sim.shade[3 * 30 + 20] === 2) lit = true;
    }
    expect(lit).toBe(true);
  });
});
