import { describe, expect, it } from 'vitest';
import { deserialize, serialize } from '../src/io/save';
import { makeSim, put, run } from './helpers';
import pkg from '../package.json';

describe('save / load', () => {
  it('round-trips a scene', async () => {
    const a = makeSim(40, 30);
    for (let x = 0; x < 40; x++) put(a, x, 29, 'stone');
    for (let x = 5; x < 15; x++) put(a, x, 5, 'sand');
    for (let x = 20; x < 30; x++) put(a, x, 10, 'lava');
    run(a, 50);

    const file = await serialize(a);
    const json = JSON.parse(JSON.stringify(file));

    const b = makeSim(10, 10);
    await deserialize(b, json);
    expect(b.w).toBe(40);
    expect(b.h).toBe(30);
    expect(Array.from(b.type)).toEqual(Array.from(a.type));
    for (let i = 0; i < a.size; i++) expect(Math.abs(b.temp[i] - a.temp[i])).toBeLessThanOrEqual(0.5);
    expect(Array.from(b.life)).toEqual(Array.from(a.life));
  });

  it('records the app version from package.json', async () => {
    const file = await serialize(makeSim(5, 5));
    expect(file.appVersion).toBe(pkg.version);
  });

  it('rejects garbage', async () => {
    const sim = makeSim(10, 10);
    await expect(deserialize(sim, { foo: 1 } as never)).rejects.toThrow();
  });
});
