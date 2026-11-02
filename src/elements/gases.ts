import type { ElementDef } from '../sim/types';
import { ID } from './ids';

export const gases: ElementDef[] = [
  {
    key: 'smoke',
    label: 'Rauch',
    category: 'gases',
    color: ['#3c3c3c', '#363636', '#444444', '#303030'],
    state: 'gas',
    density: 6,
    conductivity: 0.05,
    lifespan: [100, 260],
    decayInto: 'empty',
    description: 'Steigt auf und löst sich langsam auf.',
  },
  {
    key: 'steam',
    label: 'Dampf',
    category: 'gases',
    color: ['#c9d6e3', '#bccad8', '#d6e1ec', '#b2c1d0'],
    state: 'gas',
    density: 5,
    defaultTemp: 110,
    conductivity: 0.1,
    heatCap: 1.5,
    cooling: 0.002,
    tempLow: 95,
    stateLow: 'water',
    transitionChance: 0.01,
    description: 'Kondensiert beim Abkühlen wieder zu Wasser.',
  },
  {
    key: 'methane',
    label: 'Methan',
    category: 'gases',
    color: ['#9db08a', '#93a681', '#a7ba94', '#899c78'],
    state: 'gas',
    density: 4,
    conductivity: 0.05,
    burn: { ignite: 300, chance: 0.04, into: 'fire', heat: 800, spread: 0.1 },
    description: 'Brennbares Gas. Brennt langsam mit einer wandernden Flammenfront.',
  },
  {
    key: 'hydrogen',
    label: 'Wasserstoff',
    category: 'gases',
    color: ['#e3d9ff', '#d8ccfa', '#ece5ff', '#cdbff2'],
    state: 'gas',
    density: 1,
    conductivity: 0.1,
    explode: { ignite: 300, radius: 2 },
    reactions: { chlorine: { into: 'acid', otherInto: 'empty', chance: 0.03 } },
    description: 'Leichtestes Gas. Explodiert schlagartig. Mit Chlor entsteht Säure.',
  },
  {
    key: 'chlorine',
    label: 'Chlorgas',
    category: 'gases',
    color: ['#c7d94a', '#bccf3f', '#d1e356', '#b1c436'],
    state: 'gas',
    density: 18,
    conductivity: 0.05,
    reactions: {
      plant: { otherInto: 'empty', chance: 0.05 },
      vine: { otherInto: 'empty', chance: 0.05 },
      fungus: { otherInto: 'empty', chance: 0.05 },
      seed: { otherInto: 'empty', chance: 0.05 },
    },
    description: 'Schwerer als Luft, sinkt ab. Tötet Pflanzen.',
  },
  {
    key: 'propane',
    label: 'Propan',
    category: 'gases',
    color: ['#b8c4d8', '#adb9ce', '#c3cee0', '#a2afc4'],
    state: 'gas',
    density: 16,
    conductivity: 0.05,
    burn: { ignite: 280, chance: 0.2, into: ['fire', 'fire', 'smoke'], heat: 1000, spread: 0.3 },
    description: 'Schwerer als Luft, sammelt sich am Boden. Brennt zügig.',
  },
  {
    key: 'cloud',
    label: 'Wolke',
    category: 'gases',
    windFactor: 0.5,
    color: ['#d9dde3', '#cfd4db', '#e3e6ea', '#c5cad2'],
    state: 'static',
    density: 1,
    conductivity: 0.05,
    update(sim, i, x, y) {
      const rng = sim.rng;
      // Drift slowly sideways.
      if (rng.next() < 0.02) {
        const nx = x + (rng.next() < 0.5 ? -1 : 1);
        if (nx >= 0 && nx < sim.w && sim.type[i + nx - x] === 0) {
          sim.swap(i, i + nx - x);
          return true;
        }
      }
      // Rain, or snow when it's freezing.
      if (rng.next() < 0.004 && y + 1 < sim.h && sim.type[i + sim.w] === 0) {
        sim.spawn(i + sim.w, sim.temp[i] < 0 ? ID.snow : ID.water);
      }
      return false;
    },
    description: 'Schwebt und lässt es regnen. Bei Frost schneit es.',
  },
  {
    key: 'oxygen',
    label: 'Sauerstoff',
    category: 'gases',
    color: ['#2a3a52', '#2e4058', '#26364c', '#324660'],
    state: 'gas',
    density: 11,
    conductivity: 0.05,
    // Flames race through it.
    reactions: { fire: { into: 'fire', chance: 0.03 }, 'blue fire': { into: 'fire', chance: 0.03 } },
    description: 'Facht Feuer an: Flammen laufen hindurch, daneben brennt alles viel schneller und heißer. Pflanzen machen ihn aus CO₂.',
  },
  {
    key: 'co2',
    label: 'CO₂',
    category: 'gases',
    color: ['#3a3d42', '#36393e', '#3f4247', '#323539'],
    state: 'gas',
    density: 15,
    conductivity: 0.05,
    reactions: {
      fire: { otherInto: 'smoke', chance: 0.5 },
      'blue fire': { otherInto: 'smoke', chance: 0.5 },
      plant: { into: 'oxygen', chance: 0.01 },
    },
    description: 'Schwerer als Luft, sammelt sich am Boden und erstickt Feuer und Glut.',
  },
];
