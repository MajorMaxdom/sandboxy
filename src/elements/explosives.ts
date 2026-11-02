import type { ElementDef } from '../sim/types';
import type { Simulation } from '../sim/simulation';
import { nuke } from '../sim/radiation';
import { ID } from './ids';
import { P, GAS, STATIC } from './props';

/** Burst of same-colored sparkles around (cx, cy). */
function burst(sim: Simulation, cx: number, cy: number): void {
  const { w, rng } = sim;
  const color = rng.int(4);
  const center = cy * w + cx;
  sim.transform(center, ID.sparkle);
  sim.shade[center] = color;
  const r = 5 + rng.int(6);
  for (let n = 0; n < 45; n++) {
    const a = rng.next() * Math.PI * 2;
    const d = r * (0.3 + 0.7 * rng.next());
    const x = Math.round(cx + Math.cos(a) * d);
    const y = Math.round(cy + Math.sin(a) * d);
    if (!sim.inBounds(x, y)) continue;
    const j = y * w + x;
    if (sim.type[j] !== 0) continue;
    sim.transform(j, ID.sparkle);
    sim.shade[j] = color;
  }
}

export const explosives: ElementDef[] = [
  {
    key: 'gunpowder',
    label: 'Schießpulver',
    category: 'explosives',
    color: ['#3a3a3a', '#2f2f2f', '#454545', '#262626'],
    state: 'powder',
    density: 130,
    conductivity: 0.3,
    explode: { ignite: 220, radius: 3 },
    description: 'Explodiert bei Hitze in einer Kettenreaktion.',
  },
  {
    key: 'nitro',
    label: 'Nitroglycerin',
    category: 'explosives',
    color: ['#d6e88a', '#cadc7c', '#e0f098', '#bdcf70'],
    state: 'liquid',
    density: 160,
    dispersion: 3,
    conductivity: 0.3,
    explode: { ignite: 160, radius: 7 },
    description: 'Flüssiger, sehr empfindlicher Sprengstoff.',
  },
  {
    key: 'c4',
    label: 'C-4',
    category: 'explosives',
    color: ['#e8e0c8', '#ddd5bc', '#f0e9d4', '#d2caaf'],
    state: 'static',
    density: 1600,
    conductivity: 0.2,
    explode: { ignite: 400, radius: 11 },
    description: 'Formbarer Sprengstoff. Mit Funken oder Strom zünden.',
  },
  {
    key: 'thermite',
    label: 'Thermit',
    category: 'explosives',
    color: ['#8a4b3a', '#7d4233', '#975444', '#703a2c'],
    state: 'powder',
    density: 170,
    conductivity: 0.3,
    burn: { ignite: 900, chance: 0.03, into: ['molten metal', 'fire', 'fire'], heat: 3000, spread: 0.3 },
    description: 'Brennt mit 3000 °C und schmilzt Metall. Braucht viel Hitze zum Zünden.',
  },
  {
    key: 'fuse',
    label: 'Zündschnur',
    category: 'explosives',
    color: ['#6e3b2a', '#633424', '#7a4331', '#562d1f'],
    state: 'static',
    density: 600,
    conductivity: 0.7,
    burn: { ignite: 150, chance: 0.03, into: ['fire', 'fire', 'smoke'], heat: 600, spread: 0.2 },
    description: 'Brennt langsam und gleichmäßig ab.',
  },
  {
    key: 'bomb',
    label: 'Bombe',
    category: 'explosives',
    color: ['#22262e', '#1c2027', '#2a2f38', '#171a20'],
    state: 'powder',
    density: 400,
    conductivity: 0.3,
    paintChance: 0.02,
    explode: { ignite: 300, radius: 14 },
    update(sim, i, _x, y) {
      if (y + 1 >= sim.h) {
        sim.temp[i] = 1000;
        return false;
      }
      const below = sim.type[i + sim.w];
      if (below !== 0 && below !== ID.bomb && P.state[below] !== GAS) {
        sim.temp[i] = 1000;
      }
      return false;
    },
    description: 'Fällt und explodiert beim Aufprall.',
  },
  {
    key: 'firework',
    label: 'Feuerwerk',
    category: 'explosives',
    color: ['#d6304a', '#2f7fd6', '#e0b02a', '#2fb85a'],
    state: 'powder',
    density: 120,
    conductivity: 0.3,
    burn: { ignite: 180, chance: 1, into: 'rocket', heat: 400, spread: 0 },
    description: 'Anzünden: Die Rakete steigt auf und zerplatzt in bunte Funken.',
  },
  {
    key: 'rocket',
    label: 'Rakete',
    category: 'hidden',
    color: ['#fff3c4', '#ffe9a0', '#ffffff', '#ffdf80'],
    state: 'static',
    density: 120,
    conductivity: 0.1,
    initLife: [25, 50],
    glow: true,
    update(sim, i, x, y) {
      const { w, type, rng } = sim;
      const left = sim.life[i];
      if (left <= 1) {
        burst(sim, x, y);
        return true;
      }
      let cur = i;
      let cx = x;
      let cy = y;
      for (let s = 0; s < 2; s++) {
        // A little wobble on the way up.
        const nx = rng.next() < 0.1 ? Math.max(0, Math.min(w - 1, cx + (rng.next() < 0.5 ? -1 : 1))) : cx;
        const ny = cy - 1;
        const t = ny >= 0 ? type[ny * w + nx] : -1;
        // Bores through loose stuff (e.g. the rest of the firework pile); bursts at solids.
        if (t < 0 || (P.state[t] === STATIC && t !== ID.sparkle && t !== ID.rocket)) {
          burst(sim, cx, cy);
          return true;
        }
        sim.swap(cur, ny * w + nx);
        cur = ny * w + nx;
        cx = nx;
        cy = ny;
      }
      sim.life[cur] = left - 1;
      if (rng.next() < 0.6 && type[cur + w] === 0) sim.transform(cur + w, ID.smoke);
      return true;
    },
  },
  {
    key: 'sparkle',
    label: 'Funkenregen',
    category: 'hidden',
    windFactor: 0.6,
    color: ['#ff4d6a', '#4da6ff', '#ffd24d', '#4dff88'],
    state: 'static',
    density: 1,
    conductivity: 0.1,
    lifespan: [30, 80],
    decayInto: 'empty',
    update(sim, i, x, y) {
      const { w, h, type, rng } = sim;
      const r = rng.next();
      if (r < 0.35 && y + 1 < h && type[i + w] === 0) {
        sim.swap(i, i + w);
      } else if (r < 0.5) {
        const nx = x + (rng.next() < 0.5 ? -1 : 1);
        if (nx >= 0 && nx < w && type[i + nx - x] === 0) sim.swap(i, i + nx - x);
      }
      return true;
    },
  },
  {
    key: 'atom bomb',
    label: 'Atombombe',
    category: 'explosives',
    color: ['#3d4a2a', '#344024', '#465530', '#2c361e'],
    state: 'powder',
    density: 400,
    conductivity: 0.3,
    paintChance: 0.01,
    update(sim, i, x, y) {
      const below = y + 1 < sim.h ? sim.type[i + sim.w] : -1;
      const landed = below === -1 || (below !== 0 && below !== ID['atom bomb'] && P.state[below] !== GAS);
      if (landed || sim.temp[i] > 1000) {
        nuke(sim, x, y);
        return true;
      }
      return false;
    },
    description: 'Fällt und löst beim Aufprall eine Atomexplosion mit Strahlung und Fallout aus.',
  },
];
