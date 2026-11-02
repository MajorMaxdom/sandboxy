import { describe, expect, it } from 'vitest';
import { ID, P } from '../src/elements/registry';
import { CHARGE_MAX } from '../src/elements/props';
import { paintCircle, paintLine } from '../src/sim/brush';
import { at, count, makeSim, put, run } from './helpers';

describe('reactions', () => {
  it('every element reference resolves and reactions are mirrored', () => {
    // salt declares water → salt water; water should see the mirrored reaction.
    const idx = P.reactTable[ID.water * P.n + ID.salt];
    expect(idx).toBeGreaterThanOrEqual(0);
    expect(P.reactions[idx].into).toBe(ID['salt water']);
  });

  it('lava meeting water makes stone and steam', () => {
    const sim = makeSim(10, 10);
    for (let x = 0; x < 10; x++) for (let y = 7; y < 10; y++) put(sim, x, y, 'water');
    for (let x = 0; x < 10; x++) put(sim, x, 6, 'lava');
    run(sim, 300);
    expect(count(sim, 'stone')).toBeGreaterThan(0);
    expect(count(sim, 'lava')).toBe(0);
  });

  it('salt dissolves in water', () => {
    const sim = makeSim(6, 6);
    for (let x = 0; x < 6; x++) for (let y = 3; y < 6; y++) put(sim, x, y, 'water');
    put(sim, 3, 0, 'salt');
    run(sim, 600);
    expect(count(sim, 'salt')).toBe(0);
    expect(count(sim, 'salt water')).toBeGreaterThan(0);
  });

  it('wood burns to fire, smoke and ash', () => {
    const sim = makeSim(12, 12);
    for (let x = 3; x < 9; x++) for (let y = 8; y < 12; y++) put(sim, x, y, 'wood');
    for (let x = 3; x < 9; x++) put(sim, x, 7, 'fire');
    run(sim, 2000);
    expect(count(sim, 'wood')).toBeLessThan(24);
  });

  it('acid dissolves stone but not glass', () => {
    const sim = makeSim(6, 8);
    for (let x = 0; x < 6; x++) put(sim, x, 7, 'glass');
    for (let x = 0; x < 6; x++) put(sim, x, 6, 'stone');
    for (let x = 0; x < 6; x++) for (let y = 2; y < 5; y++) put(sim, x, y, 'acid');
    run(sim, 1000);
    expect(count(sim, 'stone')).toBeLessThan(6);
    expect(count(sim, 'glass')).toBe(6);
  });

  it('gunpowder explodes in a chain reaction', () => {
    const sim = makeSim(30, 10);
    for (let x = 0; x < 30; x++) put(sim, x, 9, 'gunpowder');
    sim.temp[9 * 30 + 0] = 1000;
    run(sim, 100);
    expect(count(sim, 'gunpowder')).toBe(0);
  });

  it('electricity runs along a metal wire and sets off C-4', () => {
    const sim = makeSim(30, 5);
    put(sim, 0, 2, 'battery');
    for (let x = 1; x < 28; x++) put(sim, x, 2, 'metal');
    put(sim, 28, 2, 'c4');
    run(sim, 20);
    expect(count(sim, 'c4')).toBe(1); // pulse still travelling
    run(sim, 30);
    expect(count(sim, 'c4')).toBe(0);
    expect(count(sim, 'metal')).toBeGreaterThan(5); // far end of the wire survives
  });

  it('a brush-painted circuit detonates a C-4 block', () => {
    const sim = makeSim(320, 154);
    const y = 131;
    paintCircle(sim, 16, y, { kind: 'element', id: ID.battery }, { radius: 3, replace: false });
    paintLine(sim, 160, y - 6, 160, y + 6, { kind: 'element', id: ID.c4 }, { radius: 6, replace: false });
    paintLine(sim, 16, y, 160, y, { kind: 'element', id: ID.metal }, { radius: 1, replace: false });
    run(sim, 300);
    expect(count(sim, 'c4')).toBe(0);
  });

  it('a lit fuse burns down and sets off gunpowder', () => {
    const sim = makeSim(10, 40);
    for (let y = 5; y < 35; y++) put(sim, 5, y, 'fuse');
    for (let x = 3; x < 8; x++) for (let y = 35; y < 40; y++) put(sim, x, y, 'gunpowder');
    for (let y = 35; y < 40; y++) {
      put(sim, 2, y, 'wall'); // keep the pile from slumping away from the fuse
      put(sim, 8, y, 'wall');
    }
    put(sim, 5, 4, 'fire');
    sim.temp[5 * 10 + 5] = 300; // light the top
    run(sim, 3000);
    expect(count(sim, 'fuse')).toBe(0);
    expect(count(sim, 'gunpowder')).toBe(0);
  });

  it('busy particles are processed every tick, not every other one', () => {
    const sim = makeSim(3, 3);
    const i = put(sim, 1, 2, 'heater'); // always busy, so never asleep
    let processed = 0;
    for (let t = 0; t < 10; t++) {
      sim.step();
      if (sim.clock[i] === sim.parity) processed++;
    }
    expect(processed).toBe(10);
  });

  it('spark painted onto metal charges it and the pulse moves away', () => {
    const sim = makeSim(10, 3);
    for (let x = 0; x < 10; x++) put(sim, x, 1, 'metal');
    sim.charge[1 * 10 + 0] = CHARGE_MAX;
    run(sim, 5);
    expect(sim.charge[1 * 10 + 5]).toBeGreaterThan(0);
    run(sim, 20);
    for (let x = 0; x < 10; x++) expect(sim.charge[10 + x]).toBe(0);
  });

  it('seeds sprout into plants on dirt', () => {
    const sim = makeSim(10, 20);
    for (let x = 0; x < 10; x++) put(sim, x, 19, 'dirt');
    put(sim, 5, 18, 'seed');
    run(sim, 2000);
    expect(count(sim, 'plant')).toBeGreaterThan(3);
  });

  it('clone copies what touches it', () => {
    const sim = makeSim(10, 10);
    put(sim, 5, 5, 'clone');
    put(sim, 5, 4, 'sand'); // resting on top of the clone
    run(sim, 200);
    expect(count(sim, 'sand')).toBeGreaterThan(5);
    expect(at(sim, 5, 5)).toBe(ID.clone);
  });
});

describe('sleeping chunks', () => {
  it('a settled sand pile lets its chunks fall asleep and wakes up when disturbed', () => {
    const sim = makeSim(64, 64);
    for (let x = 0; x < 64; x++) for (let y = 50; y < 64; y++) put(sim, x, y, 'sand');
    run(sim, 20);
    expect(sim.awakeCount()).toBe(0);
    sim.spawn(60 * 64 + 10, 0); // dig a hole
    run(sim, 1);
    expect(sim.awakeCount()).toBeGreaterThan(0);
    run(sim, 200);
    expect(at(sim, 10, 63)).toBe(ID.sand);
  });
});
