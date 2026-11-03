import { describe, expect, it } from 'vitest';
import { ID } from '../src/elements/registry';
import { deserialize, serialize } from '../src/io/save';
import { count, makeSim, put, run } from './helpers';

describe('pipes', () => {
  it('a pipe sucks water in at its start and lets it out at its end', () => {
    const sim = makeSim(60, 30);
    for (let x = 0; x < 60; x++) put(sim, x, 29, 'wall');
    // Basin on the left, pipe from inside it up and over to the right.
    for (let y = 18; y < 29; y++) { put(sim, 0, y, 'wall'); put(sim, 14, y, 'wall'); }
    for (let y = 20; y < 29; y++) for (let x = 1; x < 14; x++) put(sim, x, y, 'water');
    for (let y = 27; y >= 10; y--) put(sim, 7, y, 'pipe up'); // starts under water
    for (let x = 7; x < 40; x++) put(sim, x, 9, 'pipe right');
    run(sim, 600);
    let right = 0;
    for (let i = 0; i < sim.size; i++) if (sim.type[i] === ID.water && i % 60 > 40) right++;
    expect(right).toBeGreaterThan(30);
  });

  it('a pipe carries sand and gas too, and shows what is inside', () => {
    const sim = makeSim(40, 20);
    for (let x = 5; x < 30; x++) put(sim, x, 10, 'pipe right');
    for (let x = 0; x < 6; x++) put(sim, x, 11, 'wall');
    put(sim, 4, 10, 'sand');
    run(sim, 3);
    let inside = 0;
    for (let i = 0; i < sim.size; i++) if (sim.type[i] === ID['pipe right'] && sim.life[i] === ID.sand) inside++;
    expect(inside).toBe(1);
    run(sim, 40);
    expect(count(sim, 'sand')).toBe(1); // came out at the end
  });

  it('pipe contents survive saving and loading', async () => {
    const a = makeSim(20, 5);
    const i = put(a, 5, 2, 'pipe right');
    a.life[i] = ID.oil;
    const b = makeSim(5, 5);
    await deserialize(b, await serialize(a));
    expect(b.type[i]).toBe(ID['pipe right']);
    expect(b.life[i]).toBe(ID.oil);
  });
});

describe('pumps', () => {
  it('a pump lifts water up a pipe into a higher basin', () => {
    const sim = makeSim(40, 40);
    for (let x = 0; x < 40; x++) put(sim, x, 39, 'wall');
    for (let y = 30; y < 39; y++) for (let x = 0; x < 15; x++) put(sim, x, y, 'water');
    for (let y = 30; y < 39; y++) put(sim, 15, y, 'wall');
    // Upper basin
    for (let x = 22; x < 38; x++) put(sim, x, 12, 'wall');
    put(sim, 22, 11, 'wall');
    put(sim, 37, 11, 'wall');
    put(sim, 5, 37, 'pump up'); // under water, sucks from below, pushes up into the pipe
    for (let y = 36; y >= 5; y--) put(sim, 5, y, 'pipe up');
    for (let x = 5; x < 30; x++) put(sim, x, 4, 'pipe right');
    run(sim, 900);
    // The upper basin is full (one row) and the rest spilled over it to the
    // right: the left basin got pumped empty, over the 15 cell high wall.
    let upper = 0;
    let left = 0;
    for (let i = 0; i < sim.size; i++) {
      if (sim.type[i] !== ID.water) continue;
      if (Math.floor(i / 40) < 12) upper++;
      if (i % 40 < 15) left++;
    }
    expect(upper).toBeGreaterThanOrEqual(14);
    expect(left).toBeLessThan(10);
  });

  it('a pump pushes liquid up a column of water', () => {
    const sim = makeSim(10, 30);
    for (let y = 0; y < 30; y++) { put(sim, 3, y, 'wall'); put(sim, 5, y, 'wall'); }
    for (let y = 20; y < 28; y++) put(sim, 4, y, 'water'); // column in a 1-wide tube
    put(sim, 4, 28, 'pump up');
    put(sim, 4, 29, 'water'); // supply below the pump
    const top = () => { for (let y = 0; y < 30; y++) if (sim.type[y * 10 + 4] === ID.water) return y; return 99; };
    const before = top();
    run(sim, 2);
    expect(top()).toBeLessThan(before);
    expect(sim.type[29 * 10 + 4]).toBe(0); // the supply was used up
  });
});

describe('drawing direction', () => {
  it('painting a pipe in another direction over a pipe turns it and keeps its content', async () => {
    const { paintLine } = await import('../src/sim/brush');
    const sim = makeSim(20, 20);
    const i = put(sim, 5, 5, 'pipe right');
    sim.life[i] = ID.water;
    paintLine(sim, 5, 5, 5, 10, { kind: 'element', id: ID['pipe down'] }, { radius: 0, replace: false, solid: true, reorient: true });
    expect(sim.type[i]).toBe(ID['pipe down']);
    expect(sim.life[i]).toBe(ID.water);
    expect(sim.type[10 * 20 + 5]).toBe(ID['pipe down']);
    // Without reorient (normal painting) existing cells are left alone.
    paintLine(sim, 5, 5, 5, 6, { kind: 'element', id: ID['pipe up'] }, { radius: 0, replace: false, solid: true });
    expect(sim.type[i]).toBe(ID['pipe down']);
  });

  it('an L-shaped pipe carries water round the corner', () => {
    const sim = makeSim(40, 30);
    for (let x = 5; x < 20; x++) put(sim, x, 5, 'pipe right');
    for (let y = 5; y < 20; y++) put(sim, 20, y, 'pipe down'); // corner cell (20,5) points down
    for (let x = 0; x < 5; x++) put(sim, x, 6, 'wall');
    put(sim, 4, 5, 'water');
    run(sim, 80);
    expect(count(sim, 'water')).toBe(1);
    let y = -1;
    for (let k = 0; k < sim.size; k++) if (sim.type[k] === ID.water) y = Math.floor(k / 40);
    expect(y).toBeGreaterThan(20); // came out of the bottom end and fell
  });
});
