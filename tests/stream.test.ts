import { describe, expect, it } from 'vitest';
import { makeSim, put } from './helpers';

/** Paint `key` into a small brush at the top every tick, like holding the mouse still. */
function pour(key: string): number[] {
  const sim = makeSim(60, 110);
  for (let x = 0; x < 60; x++) put(sim, x, 109, 'wall');
  for (let t = 0; t < 40; t++) {
    for (let y = 5; y < 9; y++) for (let x = 28; x < 32; x++) if (!sim.type[y * 60 + x]) put(sim, x, y, key);
    sim.step();
  }
  // Rows of the falling column without any particle. Right below the brush a
  // short gap is fine: the stream falls faster than a 4-row brush refills.
  const gaps: number[] = [];
  for (let y = 20; y < 95; y++) {
    let any = false;
    for (let x = 20; x < 40; x++) if (sim.type[y * 60 + x]) any = true;
    if (!any) gaps.push(y);
  }
  return gaps;
}

describe('falling streams', () => {
  it('a poured water stream stays connected instead of tearing into bars', () => {
    expect(pour('water')).toEqual([]);
  });

  it('a poured sand stream stays connected too', () => {
    expect(pour('sand')).toEqual([]);
  });
});

/** Empty cells with a particle directly above and below: the gaps between bands. */
function gapsBetweenRows(sim: ReturnType<typeof makeSim>): number {
  let n = 0;
  for (let y = 1; y < sim.h - 1; y++) {
    for (let x = 0; x < sim.w; x++) {
      const i = y * sim.w + x;
      if (!sim.type[i] && sim.type[i - sim.w] && sim.type[i + sim.w]) n++;
    }
  }
  return n;
}

describe('flowing slopes', () => {
  it('a growing sand pile has no bands of overhanging rows', () => {
    const sim = makeSim(160, 150);
    let worst = 0;
    for (let t = 0; t < 1500; t++) {
      for (let y = 5; y < 10; y++) for (let x = 78; x < 83; x++) if (!sim.type[y * 160 + x] && (x + y + t) % 2 === 0) put(sim, x, y, 'sand');
      sim.step();
      if (t >= 600 && t % 100 === 0) worst = Math.max(worst, gapsBetweenRows(sim));
    }
    // With strictly alternating row directions this was around 90–100.
    expect(worst).toBeLessThan(45);
  });
});
