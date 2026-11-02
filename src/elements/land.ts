import type { ElementDef } from '../sim/types';
import { ID } from './ids';

/** Temperature glowing coal holds while it burns down. */
const EMBER_TEMP = 1100;

export const land: ElementDef[] = [
  {
    key: 'sand',
    label: 'Sand',
    category: 'land',
    color: ['#e3c47a', '#d9b86a', '#ebd08e', '#cfae62'],
    state: 'powder',
    density: 160,
    conductivity: 0.25,
    heatCap: 1.2,
    tempHigh: 1700,
    stateHigh: 'molten glass',
    description: 'Rieselt zu Haufen. Schmilzt bei 1700 °C zu flüssigem Glas.',
  },
  {
    key: 'dirt',
    label: 'Erde',
    category: 'land',
    color: ['#6b4a2b', '#5e4026', '#765232', '#634428'],
    state: 'powder',
    density: 150,
    conductivity: 0.2,
    heatCap: 1.3,
    reactions: { water: { into: 'mud', otherInto: 'empty', chance: 0.02 } },
    description: 'Wird mit Wasser zu Schlamm. Samen keimen darauf.',
  },
  {
    key: 'gravel',
    label: 'Kies',
    category: 'land',
    color: ['#8a8580', '#77726d', '#9b968f', '#6b6661'],
    state: 'powder',
    density: 180,
    conductivity: 0.3,
    heatCap: 1.4,
    tempHigh: 1200,
    stateHigh: 'lava',
    description: 'Schwerer als Sand. Schmilzt zu Lava.',
  },
  {
    key: 'salt',
    label: 'Salz',
    category: 'land',
    color: ['#f2f2f2', '#e6e6e6', '#ffffff', '#dcdcdc'],
    state: 'powder',
    density: 140,
    conductivity: 0.3,
    reactions: {
      water: { into: 'empty', otherInto: 'salt water', chance: 0.04 },
      ice: { otherInto: 'water', chance: 0.01 },
      snow: { otherInto: 'water', chance: 0.02 },
    },
    description: 'Löst sich in Wasser zu Salzwasser. Taut Eis und Schnee.',
  },
  {
    key: 'snow',
    label: 'Schnee',
    category: 'land',
    color: ['#f4f8ff', '#e8f0fb', '#ffffff', '#dde8f5'],
    state: 'powder',
    density: 50,
    defaultTemp: -8,
    conductivity: 0.15,
    heatCap: 4,
    tempHigh: 3,
    stateHigh: 'water',
    transitionChance: 0.03,
    description: 'Leicht und kalt. Schmilzt über 3 °C.',
  },
  {
    key: 'ash',
    label: 'Asche',
    category: 'land',
    color: ['#5a5a5a', '#4d4d4d', '#666666', '#424242'],
    state: 'powder',
    density: 50,
    conductivity: 0.1,
    description: 'Bleibt übrig, wenn Dinge verbrennen.',
  },
  {
    key: 'cement',
    label: 'Zement',
    category: 'land',
    color: ['#b5b2a8', '#a8a59b', '#c2bfb5', '#9e9b91'],
    state: 'powder',
    density: 155,
    conductivity: 0.3,
    reactions: { water: { into: 'stone', otherInto: 'empty', chance: 0.01 } },
    description: 'Härtet mit Wasser zu Stein aus.',
  },
  {
    key: 'coal',
    label: 'Kohle',
    category: 'land',
    color: ['#222222', '#1a1a1a', '#2b2b2b', '#151515'],
    state: 'powder',
    density: 140,
    conductivity: 0.2,
    heatCap: 2,
    windFactor: 0,
    // Once it's red hot it turns into glowing ember, which does the long burn.
    burn: { ignite: 350, chance: 0.02, into: 'ember', heat: EMBER_TEMP, spread: 0.03 },
    description: 'Brennt sehr langsam und heiß ab: Angezündet wird sie zu Glut, die über eine Minute bei 1100 °C glüht. Wasser löscht sie.',
  },
  {
    key: 'ember',
    label: 'Glut',
    category: 'hidden',
    color: ['#ff6a1a', '#d93d0b', '#ffa040', '#b8320a'],
    state: 'powder',
    density: 140,
    conductivity: 0.3,
    heatCap: 2,
    windFactor: 0,
    defaultTemp: EMBER_TEMP,
    lifespan: [3600, 7200],
    decayInto: 'ash',
    glow: true,
    update(sim, i, x, y) {
      const { w, type, rng } = sim;
      // Water puts it out: back to (warm) coal, the water hisses off as steam.
      for (const j of sim.neighbors4(x, y)) {
        const t = type[j];
        if (t === ID.water || t === ID['salt water']) {
          sim.transform(j, ID.steam);
          sim.transform(i, ID.coal);
          sim.temp[i] = 100;
          return true;
        }
      }
      if (sim.temp[i] < EMBER_TEMP) sim.temp[i] = EMBER_TEMP;
      // Now and then a small flame or a wisp of smoke rises.
      if (y > 0 && type[i - w] === 0) {
        const r = rng.next();
        if (r < 0.015) sim.transform(i - w, ID.fire);
        else if (r < 0.02) sim.transform(i - w, ID.smoke);
      }
      return false;
    },
  },
];
