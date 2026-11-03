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
