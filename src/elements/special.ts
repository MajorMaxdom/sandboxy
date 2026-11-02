import type { ElementDef } from '../sim/types';
import { ID } from './ids';

function isProtected(t: number): boolean {
  return t === 0 || t === ID.wall || t === ID.clone || t === ID.void;
}

export const special: ElementDef[] = [
  {
    key: 'heater',
    label: 'Heizer',
    category: 'special',
    color: ['#d94a3a', '#cc4234', '#e35546', '#bf3a2d'],
    state: 'static',
    density: 5000,
    conductivity: 0.8,
    acidProof: true,
    update(sim, i) {
      sim.temp[i] = 600;
    },
    description: 'Hält konstant 600 °C.',
  },
  {
    key: 'cooler',
    label: 'Kühler',
    category: 'special',
    color: ['#3a8fd9', '#3485cc', '#4699e3', '#2e7abf'],
    state: 'static',
    density: 5000,
    conductivity: 0.8,
    acidProof: true,
    update(sim, i) {
      sim.temp[i] = -100;
    },
    description: 'Hält konstant −100 °C.',
  },
  {
    key: 'clone',
    label: 'Klon',
    category: 'special',
    color: ['#c9b03a', '#bca434', '#d6bd46', '#ae972e'],
    state: 'static',
    density: 5000,
    conductivity: 0,
    acidProof: true,
    indestructible: true,
    update(sim, i, x, y) {
      const stored = sim.life[i];
      if (stored === 0) {
        for (const j of sim.neighbors4(x, y)) {
          const t = sim.type[j];
          if (!isProtected(t)) {
            sim.life[i] = t;
            break;
          }
        }
        return false;
      }
      if (sim.rng.next() < 0.25) {
        const j = sim.randomNeighbor4(x, y);
        if (j >= 0 && sim.type[j] === 0) sim.spawn(j, stored);
      }
      return false;
    },
    description: 'Merkt sich das erste Element, das es berührt, und erzeugt es endlos.',
  },
  {
    key: 'void',
    label: 'Void',
    category: 'special',
    color: ['#0a0a0d', '#0d0d12', '#08080a', '#111116'],
    state: 'static',
    density: 5000,
    conductivity: 0,
    acidProof: true,
    indestructible: true,
    update(sim, _i, x, y) {
      for (const j of sim.neighbors4(x, y)) {
        if (!isProtected(sim.type[j])) {
          sim.transform(j, ID.empty, true);
          sim.temp[j] = sim.ambient;
        }
      }
      return false;
    },
    description: 'Vernichtet alles, was es berührt.',
  },
  {
    key: 'virus',
    label: 'Virus',
    category: 'special',
    color: ['#b026ff', '#9a1fe0', '#c74dff', '#8a17c9'],
    state: 'static',
    density: 100,
    conductivity: 0.2,
    lifespan: [80, 160],
    decayInto: 'empty',
    tempHigh: 120,
    stateHigh: 'empty',
    update(sim, _i, x, y) {
      if (sim.rng.next() < 0.15) {
        const j = sim.randomNeighbor4(x, y);
        if (j >= 0) {
          const t = sim.type[j];
          if (!isProtected(t) && t !== ID.virus) sim.transform(j, ID.virus);
        }
      }
      return false;
    },
    description: 'Befällt alles, was es berührt, und stirbt danach ab. Hitze tötet es.',
  },
];
