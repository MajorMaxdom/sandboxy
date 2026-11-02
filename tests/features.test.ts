import { describe, expect, it } from 'vitest';
import { ID } from '../src/elements/registry';
import { CHARGE_MAX } from '../src/elements/props';
import { floodFill, paintRect } from '../src/sim/brush';
import { DEMOS } from '../src/io/demos';
import { History } from '../src/ui/history';
import { at, count, makeSim, meanY, put, run } from './helpers';

describe('velocity', () => {
  it('falling sand accelerates beyond one cell per tick', () => {
    const sim = makeSim(5, 80);
    put(sim, 2, 0, 'sand');
    run(sim, 20);
    // Constant 1 cell/tick would reach y=20; accelerating gets much further.
    expect(meanY(sim, 'sand')).toBeGreaterThan(35);
  });

  it('explosions fling debris through the air', () => {
    const sim = makeSim(80, 60);
    for (let x = 0; x < 80; x++) put(sim, x, 59, 'wall');
    for (let x = 5; x < 75; x++) for (let y = 54; y < 59; y++) put(sim, x, y, 'sand');
    put(sim, 40, 53, 'c4');
    sim.temp[53 * 80 + 40] = 1000;
    let minY = 60;
    for (let t = 0; t < 30; t++) {
      sim.step();
      for (let i = 0; i < sim.size; i++) if (sim.type[i] === ID.sand) minY = Math.min(minY, Math.floor(i / 80));
    }
    expect(minY).toBeLessThan(45); // sand flew up
  });
});

describe('air pressure', () => {
  it('a blast creates a pressure wave that travels and fades', () => {
    const sim = makeSim(100, 40);
    sim.addPressure(50, 20, 4, 5);
    run(sim, 20);
    expect(Math.abs(sim.presAt(70, 20))).toBeGreaterThan(0.01); // reached 20 cells away
    run(sim, 3000);
    expect(sim.airActive).toBe(false); // calmed down
  });

  it('walls block the pressure wave', () => {
    const sim = makeSim(100, 40);
    for (let y = 0; y < 40; y++) put(sim, 60, y, 'wall');
    sim.addPressure(50, 20, 4, 5);
    run(sim, 30);
    expect(sim.presAt(75, 20)).toBe(0);
  });

  it('a fan drives smoke through a pipe around a corner', () => {
    const sim = makeSim(60, 40);
    // L-shaped pipe: horizontal along y=30..33, then up along x=50..53
    for (let x = 5; x <= 49; x++) put(sim, x, 29, 'wall');
    for (let x = 5; x <= 54; x++) put(sim, x, 34, 'wall');
    for (let y = 5; y <= 34; y++) put(sim, 54, y, 'wall');
    for (let y = 5; y <= 29; y++) put(sim, 49, y, 'wall');
    for (let y = 30; y <= 33; y++) { put(sim, 4, y, 'wall'); put(sim, 5, y, 'fan right'); }
    // Smoke is heavier than air here so it doesn't simply rise by itself
    for (let x = 8; x < 20; x++) for (let y = 30; y <= 33; y++) put(sim, x, y, 'chlorine');
    let maxInRiser = 0;
    for (let t = 0; t < 400; t++) {
      sim.step();
      let inRiser = 0;
      for (let y = 5; y < 29; y++) for (let x = 50; x < 54; x++) if (at(sim, x, y) === ID.chlorine) inRiser++;
      maxInRiser = Math.max(maxInRiser, inRiser);
    }
    expect(maxInRiser).toBeGreaterThan(3);
  });
});

describe('logic', () => {
  const lampLit = (sim: ReturnType<typeof makeSim>, x: number, y: number) => sim.shade[y * sim.w + x] === 2;

  it('a switch interrupts the circuit', () => {
    const sim = makeSim(20, 3);
    put(sim, 0, 1, 'battery');
    for (let x = 1; x < 5; x++) put(sim, x, 1, 'copper');
    put(sim, 5, 1, 'switch');
    for (let x = 6; x < 10; x++) put(sim, x, 1, 'copper');
    put(sim, 10, 1, 'lamp');
    run(sim, 60);
    expect(lampLit(sim, 10, 1)).toBe(true);
    sim.life[1 * 20 + 5] = 0; // switch off
    run(sim, 60);
    expect(lampLit(sim, 10, 1)).toBe(false);
  });

  it('a diode only lets current through left to right', () => {
    const forward = makeSim(20, 3);
    put(forward, 0, 1, 'battery');
    for (let x = 1; x < 5; x++) put(forward, x, 1, 'copper');
    put(forward, 5, 1, 'diode');
    for (let x = 6; x < 9; x++) put(forward, x, 1, 'copper');
    put(forward, 9, 1, 'lamp');
    run(forward, 80);
    expect(lampLit(forward, 9, 1)).toBe(true);

    const backward = makeSim(20, 3);
    put(backward, 19, 1, 'battery');
    for (let x = 15; x < 19; x++) put(backward, x, 1, 'copper');
    put(backward, 14, 1, 'diode');
    for (let x = 11; x < 14; x++) put(backward, x, 1, 'copper');
    put(backward, 10, 1, 'lamp');
    run(backward, 80);
    expect(lampLit(backward, 10, 1)).toBe(false);
  });

  it('a delay passes a pulse on half a second later', () => {
    const sim = makeSim(20, 3);
    for (let x = 0; x < 4; x++) put(sim, x, 1, 'copper');
    put(sim, 4, 1, 'delay');
    for (let x = 5; x < 9; x++) put(sim, x, 1, 'copper');
    sim.charge[1 * 20 + 0] = CHARGE_MAX;
    let arrived = -1;
    for (let t = 0; t < 80 && arrived < 0; t++) {
      sim.step();
      if (sim.charge[1 * 20 + 7] > 0) arrived = t;
    }
    expect(arrived).toBeGreaterThan(25);
    expect(arrived).toBeLessThan(45);
  });

  it('NOT gate outputs only while its input is silent', () => {
    const sim = makeSim(20, 3);
    put(sim, 3, 1, 'not gate');
    for (let x = 4; x < 7; x++) put(sim, x, 1, 'copper');
    put(sim, 7, 1, 'lamp');
    run(sim, 40);
    expect(lampLit(sim, 7, 1)).toBe(true);
    // Now feed the input continuously from a battery
    put(sim, 0, 1, 'battery');
    put(sim, 1, 1, 'copper');
    put(sim, 2, 1, 'copper');
    run(sim, 60);
    expect(lampLit(sim, 7, 1)).toBe(false);
  });

  it('AND gate fires only with both inputs', () => {
    const build = (top: boolean, bottom: boolean) => {
      const sim = makeSim(12, 9);
      put(sim, 5, 4, 'and gate');
      for (let x = 6; x < 9; x++) put(sim, x, 4, 'copper');
      put(sim, 9, 4, 'lamp');
      if (top) { put(sim, 5, 0, 'clock'); for (let y = 1; y < 4; y++) put(sim, 5, y, 'copper'); }
      if (bottom) { put(sim, 5, 8, 'clock'); for (let y = 5; y < 8; y++) put(sim, 5, y, 'copper'); }
      let lit = false;
      for (let t = 0; t < 120; t++) { sim.step(); if (lampLit(sim, 9, 4)) lit = true; }
      return lit;
    };
    expect(build(true, true)).toBe(true);
    expect(build(true, false)).toBe(false);
    expect(build(false, true)).toBe(false);
  });

  it('a wired fan only blows while powered', () => {
    const smokeX = (powered: boolean) => {
      const sim = makeSim(60, 10);
      for (let x = 0; x < 60; x++) put(sim, x, 9, 'wall');
      put(sim, 3, 8, 'fan right');
      put(sim, 2, 8, 'copper');
      if (powered) put(sim, 1, 8, 'battery');
      for (let x = 6; x < 10; x++) put(sim, x, 8, 'ash');
      run(sim, 300);
      let maxX = 0;
      for (let i = 0; i < sim.size; i++) if (sim.type[i] === ID.ash) maxX = Math.max(maxX, i % 60);
      return maxX;
    };
    expect(smokeX(false)).toBeLessThan(12);
    expect(smokeX(true)).toBeGreaterThan(15);
  });
});

describe('life & mutation', () => {
  it('radiation turns plants into mutant plants', () => {
    const sim = makeSim(40, 12);
    for (let x = 0; x < 8; x++) for (let y = 2; y < 10; y++) put(sim, x, y, 'plutonium');
    for (let x = 12; x < 15; x++) for (let y = 2; y < 10; y++) put(sim, x, y, 'plant');
    let mutants = 0;
    for (let t = 0; t < 1500 && mutants === 0; t++) {
      sim.step();
      if (t % 50 === 0) mutants = count(sim, 'mutant plant');
    }
    expect(mutants).toBeGreaterThan(0);
  });

  it('bacteria eat an oil slick', () => {
    const sim = makeSim(30, 20);
    for (let x = 0; x < 30; x++) for (let y = 14; y < 20; y++) put(sim, x, y, 'water');
    for (let x = 0; x < 30; x++) for (let y = 12; y < 14; y++) put(sim, x, y, 'oil');
    for (let x = 5; x < 8; x++) put(sim, x, 10, 'bacteria');
    run(sim, 3000);
    expect(count(sim, 'oil')).toBeLessThan(20);
  });

  it('worms turn ash into soil', () => {
    const sim = makeSim(20, 20);
    for (let x = 0; x < 20; x++) for (let y = 10; y < 20; y++) put(sim, x, y, 'dirt');
    for (let x = 0; x < 20; x++) put(sim, x, 9, 'ash');
    for (let x = 2; x < 18; x += 3) put(sim, x, 12, 'worm');
    run(sim, 3000);
    expect(count(sim, 'ash')).toBeLessThan(15);
  });

  it('birds stay in the air', () => {
    const sim = makeSim(60, 40);
    for (let x = 0; x < 60; x++) put(sim, x, 39, 'wall');
    for (let k = 0; k < 10; k++) put(sim, 5 + k * 5, 10, 'bird');
    run(sim, 600);
    expect(count(sim, 'bird')).toBe(10);
    expect(meanY(sim, 'bird')).toBeLessThan(36);
  });
});

describe('tools', () => {
  it('flood fill fills a closed container', () => {
    const sim = makeSim(20, 20);
    paintRect(sim, 5, 5, 14, 5, { kind: 'element', id: ID.wall }, { radius: 0, replace: true, solid: true });
    paintRect(sim, 5, 14, 14, 14, { kind: 'element', id: ID.wall }, { radius: 0, replace: true, solid: true });
    paintRect(sim, 5, 5, 5, 14, { kind: 'element', id: ID.wall }, { radius: 0, replace: true, solid: true });
    paintRect(sim, 14, 5, 14, 14, { kind: 'element', id: ID.wall }, { radius: 0, replace: true, solid: true });
    const n = floodFill(sim, 10, 10, { kind: 'element', id: ID.stone }, { radius: 0, replace: false });
    expect(n).toBe(64);
    expect(count(sim, 'stone')).toBe(64);
    expect(at(sim, 2, 2)).toBe(0);
  });

  it('undo and redo restore the scene', () => {
    const sim = makeSim(20, 20);
    const h = new History(sim, () => {});
    h.record();
    put(sim, 3, 3, 'stone');
    expect(count(sim, 'stone')).toBe(1);
    h.undo();
    expect(count(sim, 'stone')).toBe(0);
    h.redo();
    expect(count(sim, 'stone')).toBe(1);
  });
});

describe('demos', () => {
  for (const d of DEMOS) {
    it(`demo "${d.label}" builds and runs`, () => {
      const sim = makeSim(320, 150);
      const settings = d.build(sim);
      sim.wind = settings.wind;
      expect(sim.countParticles()).toBeGreaterThan(100);
      expect(() => run(sim, 300)).not.toThrow();
    });
  }
});

describe('demo content', () => {
  it('the aquarium actually contains fish', () => {
    const sim = makeSim(320, 150);
    DEMOS.find((d) => d.key === 'aquarium')!.build(sim);
    expect(count(sim, 'fish')).toBeGreaterThan(10);
  });
});

describe('ignition', () => {
  it('a burning fuse sets off a big block of C-4', () => {
    const sim = makeSim(30, 30);
    for (let x = 10; x < 15; x++) for (let y = 20; y < 26; y++) put(sim, x, y, 'c4');
    for (let y = 8; y < 20; y++) put(sim, 12, y, 'fuse');
    put(sim, 12, 7, 'fire');
    sim.temp[8 * 30 + 12] = 300;
    run(sim, 1500);
    expect(count(sim, 'c4')).toBe(0);
  });
});

describe('demo behaviour', () => {
  it('the reactor demo lights its lamps', () => {
    const sim = makeSim(315, 140);
    DEMOS.find((d) => d.key === 'reactor')!.build(sim);
    let lit = false;
    for (let t = 0; t < 900 && !lit; t++) {
      sim.step();
      if (t % 10 === 0) for (let i = 0; i < sim.size; i++) if (sim.type[i] === ID.lamp && sim.shade[i] === 2) { lit = true; break; }
    }
    expect(lit).toBe(true);
  });

  for (const seed of [1, 2, 3]) {
    it(`the airflow demo detonates its C-4 (seed ${seed})`, () => {
      const sim = makeSim(315, 140, seed);
      DEMOS.find((d) => d.key === 'airflow')!.build(sim);
      run(sim, 600);
      expect(count(sim, 'c4')).toBe(0);
    });
  }
});

describe('clear', () => {
  it('leaves no leftover data that could render as stray pixels', () => {
    const sim = makeSim(60, 40);
    for (let x = 0; x < 10; x++) for (let y = 10; y < 20; y++) put(sim, x, y, 'plutonium');
    run(sim, 200); // lots of radiation flying around (direction stored in shade 0–7)
    sim.clear();
    expect(sim.countParticles()).toBe(0);
    for (let i = 0; i < sim.size; i++) expect(sim.shade[i]).toBeLessThan(4);
  });
});
