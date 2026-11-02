import type { ElementDef } from '../sim/types';
import { ID } from './ids';
import { P, GAS } from './props';

export const liquids: ElementDef[] = [
  {
    key: 'water',
    label: 'Wasser',
    category: 'liquids',
    radiation: 'moderate',
    color: ['#2f6fd6', '#2a66c9', '#3678e0', '#285fbd'],
    state: 'liquid',
    density: 100,
    dispersion: 5,
    conductivity: 0.6,
    heatCap: 4,
    conducts: true,
    tempHigh: 100,
    stateHigh: 'steam',
    tempLow: 0,
    stateLow: 'ice',
    transitionChance: 0.1,
    acidProof: true,
    description: 'Fließt, kocht bei 100 °C und gefriert bei 0 °C.',
  },
  {
    key: 'salt water',
    label: 'Salzwasser',
    category: 'liquids',
    radiation: 'moderate',
    color: ['#3d7fc4', '#3776b8', '#4688cf', '#336eab'],
    state: 'liquid',
    density: 103,
    dispersion: 5,
    conductivity: 0.6,
    heatCap: 4,
    conducts: true,
    tempHigh: 102,
    stateHigh: 'salt',
    highByproduct: 'steam',
    tempLow: -18,
    stateLow: 'ice',
    transitionChance: 0.1,
    acidProof: true,
    description: 'Leitet Strom. Beim Verdampfen bleibt Salz zurück.',
  },
  {
    key: 'oil',
    label: 'Öl',
    category: 'liquids',
    color: ['#3b2a1a', '#33241a', '#45311e', '#2e2016'],
    state: 'liquid',
    density: 80,
    dispersion: 3,
    conductivity: 0.2,
    heatCap: 2,
    burn: { ignite: 230, chance: 0.04, into: ['fire', 'fire', 'smoke'], heat: 800, spread: 0.4 },
    description: 'Schwimmt auf Wasser und brennt gut.',
  },
  {
    key: 'lava',
    label: 'Lava',
    category: 'liquids',
    color: ['#ff5a1f', '#f04a14', '#ff7a2e', '#e03c10'],
    state: 'liquid',
    density: 250,
    dispersion: 2,
    viscosity: 0.6,
    defaultTemp: 1800,
    conductivity: 0.5,
    heatCap: 3,
    cooling: 0.0002,
    tempLow: 850,
    stateLow: 'stone',
    transitionChance: 0.1,
    glow: true,
    reactions: { water: { into: 'obsidian', chance: 0.03 } },
    description: 'Sehr heiß (1800 °C). Kühlt zu Stein ab, mit Wasser auch zu Obsidian. Schmilzt Metall.',
  },
  {
    key: 'acid',
    label: 'Säure',
    category: 'liquids',
    color: ['#8cff3a', '#7ef02e', '#9aff4d', '#70e024'],
    state: 'liquid',
    density: 110,
    dispersion: 4,
    conductivity: 0.4,
    heatCap: 2,
    acidProof: true,
    tempHigh: 200,
    stateHigh: 'smoke',
    update(sim, i, x, y) {
      const j = sim.randomNeighbor4(x, y);
      if (j < 0) return false;
      const t = sim.type[j];
      if (t === 0 || P.acidProof[t] || P.state[t] === GAS) return false;
      if (t === ID.salt) {
        if (sim.rng.next() < 0.05) {
          sim.transform(j, ID.chlorine);
          sim.transform(i, ID.empty);
          return true;
        }
        return false;
      }
      if (sim.rng.next() < 0.08) {
        sim.transform(j, sim.rng.next() < 0.15 ? ID.smoke : ID.empty);
        if (sim.rng.next() < 0.35) {
          sim.transform(i, ID.empty);
          return true;
        }
      }
      return false;
    },
    description: 'Zersetzt fast alles, außer Glas und Wand. Mit Salz entsteht Chlorgas.',
  },
  {
    key: 'mud',
    label: 'Schlamm',
    category: 'liquids',
    color: ['#5a3d22', '#50361e', '#644427', '#4a321c'],
    state: 'liquid',
    density: 160,
    dispersion: 1,
    viscosity: 0.8,
    conductivity: 0.3,
    heatCap: 3,
    tempHigh: 100,
    stateHigh: 'dirt',
    highByproduct: 'steam',
    transitionChance: 0.05,
    description: 'Zäh. Trocknet bei Hitze wieder zu Erde.',
  },
  {
    key: 'molten glass',
    label: 'Flüssiges Glas',
    category: 'liquids',
    color: ['#ffb347', '#ffa733', '#ffbf5c', '#f59c2a'],
    state: 'liquid',
    density: 240,
    dispersion: 1,
    viscosity: 0.85,
    defaultTemp: 1800,
    conductivity: 0.3,
    heatCap: 2,
    cooling: 0.0003,
    tempLow: 1400,
    stateLow: 'glass',
    transitionChance: 0.1,
    glow: true,
    description: 'Erstarrt unter 1400 °C zu Glas.',
  },
  {
    key: 'liquid nitrogen',
    label: 'Flüssigstickstoff',
    category: 'liquids',
    color: ['#d8f3ff', '#c9ecfb', '#e6f8ff', '#bfe5f5'],
    state: 'liquid',
    density: 81,
    dispersion: 5,
    defaultTemp: -196,
    conductivity: 0.6,
    heatCap: 3,
    cooling: 0,
    tempHigh: -160,
    stateHigh: 'empty',
    transitionChance: 0.05,
    description: '−196 °C kalt. Friert alles ein und verdampft.',
  },
  {
    key: 'gasoline',
    label: 'Benzin',
    category: 'liquids',
    color: ['#f2e394', '#e8d985', '#f7eca7', '#ddcd78'],
    state: 'liquid',
    density: 72,
    dispersion: 6,
    conductivity: 0.2,
    heatCap: 1.5,
    burn: { ignite: 180, chance: 0.12, into: ['fire', 'fire', 'smoke'], heat: 900, spread: 0.5 },
    description: 'Dünnflüssig und leicht entzündlich. Brennt viel schneller als Öl.',
  },
];
