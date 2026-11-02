import type { ElementDef } from '../sim/types';

interface MetalSpec {
  key: string;
  label: string;
  moltenKey: string;
  moltenLabel: string;
  color: string[];
  moltenColor: string[];
  /** Melting point in °C. Molten form solidifies a bit below it. */
  melt: number;
  density: number;
  conductivity: number;
  heatCap?: number;
  /** Self-heating per electric pulse; high = heating wire. */
  resistance: number;
  acidProof?: boolean;
  /** Molten form glows (hot enough to radiate visibly). */
  glow?: boolean;
  description: string;
  moltenDescription: string;
  reactions?: ElementDef['reactions'];
  radiation?: ElementDef['radiation'];
}

/** A solid metal and its molten form, sharing one melting point. */
function metal(m: MetalSpec): ElementDef[] {
  return [
    {
      key: m.key,
      label: m.label,
      category: 'metals',
      color: m.color,
      state: 'static',
      density: m.density * 10,
      conductivity: m.conductivity,
      heatCap: m.heatCap ?? 1.2,
      conducts: true,
      resistance: m.resistance,
      acidProof: m.acidProof,
      tempHigh: m.melt,
      stateHigh: m.moltenKey,
      transitionChance: 0.05,
      reactions: m.reactions,
      radiation: m.radiation,
      description: m.description,
    },
    {
      key: m.moltenKey,
      label: m.moltenLabel,
      category: 'metals',
      color: m.moltenColor,
      state: 'liquid',
      density: m.density,
      dispersion: 2,
      viscosity: 0.3,
      defaultTemp: m.melt + 150,
      conductivity: m.conductivity,
      heatCap: m.heatCap ?? 1.2,
      cooling: 0.0003,
      conducts: true,
      resistance: m.resistance,
      acidProof: m.acidProof,
      tempLow: m.melt - 80,
      stateLow: m.key,
      transitionChance: 0.1,
      glow: m.glow,
      radiation: m.radiation,
      description: m.moltenDescription,
    },
  ];
}

const HOT = ['#ffd27a', '#ffc861', '#ffdc91', '#f5bd52'];

export const metals: ElementDef[] = [
  ...metal({
    key: 'metal',
    label: 'Eisen',
    moltenKey: 'molten metal',
    moltenLabel: 'Flüssiges Eisen',
    color: ['#a7adb5', '#9aa0a8', '#b3b9c1', '#8f959d'],
    moltenColor: HOT,
    melt: 1250,
    density: 790,
    conductivity: 0.8,
    resistance: 2,
    glow: true,
    reactions: {
      water: { into: 'rust', chance: 0.0004 },
      'salt water': { into: 'rust', chance: 0.003 },
    },
    description: 'Robust, leitet Strom. Rostet langsam in Wasser, schneller in Salzwasser. Schmilzt bei 1250 °C.',
    moltenDescription: 'Erstarrt unter 1170 °C zu Eisen.',
  }),
  ...metal({
    key: 'copper',
    label: 'Kupfer',
    moltenKey: 'molten copper',
    moltenLabel: 'Flüssiges Kupfer',
    color: ['#c27a45', '#b06c3b', '#d08a55', '#a06033'],
    moltenColor: ['#ffb070', '#ffa25c', '#ffbe85', '#f59450'],
    melt: 1085,
    density: 890,
    conductivity: 1,
    resistance: 0.3,
    glow: true,
    reactions: {
      'salt water': { into: 'patina', chance: 0.002 },
    },
    description: 'Bester Wärme- und Stromleiter, wird kaum warm. Bildet in Salzwasser grüne Patina.',
    moltenDescription: 'Erstarrt unter 1005 °C zu Kupfer.',
  }),
  ...metal({
    key: 'aluminium',
    label: 'Aluminium',
    moltenKey: 'molten aluminium',
    moltenLabel: 'Flüssiges Alu',
    color: ['#d4d8dd', '#c8cdd3', '#dfe2e6', '#bcc1c8'],
    moltenColor: ['#f0e6d8', '#e8dccb', '#f7efe4', '#dfd2bf'],
    melt: 660,
    density: 270,
    conductivity: 0.95,
    resistance: 0.5,
    description: 'Leicht, leitet gut, schmilzt schon bei 660 °C. Wird von Gallium zersetzt!',
    moltenDescription: 'Erstarrt unter 580 °C zu Aluminium.',
  }),
  ...metal({
    key: 'gold',
    label: 'Gold',
    moltenKey: 'molten gold',
    moltenLabel: 'Flüssiges Gold',
    color: ['#ffd700', '#f2c500', '#ffe14d', '#e0b400'],
    moltenColor: ['#ffb000', '#f5a300', '#ffc233', '#e69500'],
    melt: 1064,
    density: 1930,
    conductivity: 0.95,
    heatCap: 1.1,
    resistance: 0.4,
    acidProof: true,
    glow: true,
    description: 'Säurefest und ein exzellenter Leiter. Schmilzt bei 1064 °C.',
    moltenDescription: 'Erstarrt unter 984 °C zu Gold.',
  }),
  ...metal({
    key: 'lead',
    label: 'Blei',
    moltenKey: 'molten lead',
    moltenLabel: 'Flüssiges Blei',
    color: ['#6c7380', '#636a76', '#767d8a', '#5a606c'],
    moltenColor: ['#b8bec8', '#adb3bd', '#c3c9d2', '#a2a8b2'],
    melt: 327,
    density: 1130,
    conductivity: 0.35,
    heatCap: 1.5,
    resistance: 6,
    radiation: 'block',
    description: 'Sehr schwer, schirmt Strahlung ab. Schmilzt schon bei 327 °C, wird unter Strom warm.',
    moltenDescription: 'Erstarrt unter 247 °C zu Blei.',
  }),
  ...metal({
    key: 'titanium',
    label: 'Titan',
    moltenKey: 'molten titanium',
    moltenLabel: 'Flüssiges Titan',
    color: ['#8e96a3', '#848c99', '#99a1ad', '#7a828f'],
    moltenColor: ['#fff0b8', '#ffe8a0', '#fff6cf', '#ffe08a'],
    melt: 1668,
    density: 450,
    conductivity: 0.2,
    heatCap: 1.5,
    resistance: 25,
    acidProof: true,
    glow: true,
    description: 'Säurefest, schmilzt erst bei 1668 °C. Hoher Widerstand: glüht unter Strom wie ein Heizdraht.',
    moltenDescription: 'Erstarrt unter 1588 °C zu Titan.',
  }),

  // ---- Gallium: melts in your hand, ruins aluminium ----
  {
    key: 'gallium',
    label: 'Gallium',
    category: 'metals',
    color: ['#7d8fa8', '#73859e', '#8799b2', '#697b94'],
    state: 'static',
    density: 5900,
    conductivity: 0.4,
    heatCap: 1.2,
    conducts: true,
    resistance: 2,
    tempHigh: 30,
    stateHigh: 'liquid gallium',
    transitionChance: 0.03,
    reactions: { aluminium: { otherInto: 'brittle aluminium', chance: 0.002 } },
    description: 'Schmilzt schon bei 30 °C. Zersetzt Aluminium.',
  },
  {
    key: 'liquid gallium',
    label: 'Flüssiges Gallium',
    category: 'metals',
    color: ['#95a9c6', '#8a9ebb', '#a0b4d1', '#7f93b0'],
    state: 'liquid',
    density: 590,
    dispersion: 3,
    conductivity: 0.4,
    heatCap: 1.2,
    conducts: true,
    resistance: 2,
    // Gallium supercools easily, so it stays liquid well below its melting point.
    tempLow: 10,
    stateLow: 'gallium',
    transitionChance: 0.02,
    reactions: { aluminium: { otherInto: 'brittle aluminium', chance: 0.01 } },
    description: 'Dringt in Aluminium ein, das dadurch spröde wird und zerbröselt. Unterkühlt leicht.',
  },
  {
    key: 'brittle aluminium',
    label: 'Sprödes Aluminium',
    category: 'hidden',
    color: ['#a9adb3', '#9ea2a8', '#b4b8be', '#93979d'],
    state: 'static',
    density: 2700,
    conductivity: 0.6,
    conducts: true,
    resistance: 3,
    lifespan: [240, 720],
    decayInto: 'alu crumbs',
    tempHigh: 660,
    stateHigh: 'molten aluminium',
    // Embrittlement creeps along the grain boundaries.
    reactions: { aluminium: { otherInto: 'brittle aluminium', chance: 0.001 } },
    description: 'Von Gallium durchsetztes Aluminium. Zerbröselt bald.',
  },
  {
    key: 'alu crumbs',
    label: 'Alu-Bröckchen',
    category: 'hidden',
    color: ['#9a9ea5', '#8e9299', '#a6aab0', '#83878e'],
    state: 'powder',
    density: 270,
    conductivity: 0.5,
    tempHigh: 660,
    stateHigh: 'molten aluminium',
    description: 'Zerfallenes Aluminium.',
  },

  {
    key: 'mercury',
    label: 'Quecksilber',
    category: 'metals',
    color: ['#c8ccd2', '#b9bec5', '#d6d9de', '#aeb3ba'],
    state: 'liquid',
    density: 1350,
    dispersion: 3,
    conductivity: 0.8,
    conducts: true,
    resistance: 3,
    description: 'Bei Raumtemperatur flüssig, sehr schwer, leitet Strom.',
  },
  {
    key: 'sodium',
    label: 'Natrium',
    category: 'metals',
    color: ['#e3e0d6', '#d8d5ca', '#ece9e0', '#cdcabe'],
    state: 'static',
    density: 970,
    conductivity: 0.6,
    conducts: true,
    resistance: 1,
    tempHigh: 98,
    stateHigh: 'molten sodium',
    reactions: {
      water: { into: 'fire', otherInto: 'hydrogen', chance: 0.3 },
      'salt water': { into: 'fire', otherInto: 'hydrogen', chance: 0.3 },
    },
    description: 'Weiches Alkalimetall. Reagiert heftig mit Wasser zu Wasserstoff und Feuer!',
  },
  {
    key: 'molten sodium',
    label: 'Flüssiges Natrium',
    category: 'hidden',
    color: ['#f0ece0', '#e6e2d5', '#f6f3ea', '#dcd8ca'],
    state: 'liquid',
    density: 93,
    dispersion: 3,
    conductivity: 0.6,
    conducts: true,
    tempLow: 90,
    stateLow: 'sodium',
    reactions: {
      water: { into: 'fire', otherInto: 'hydrogen', chance: 0.4 },
      'salt water': { into: 'fire', otherInto: 'hydrogen', chance: 0.4 },
    },
    description: 'Geschmolzenes Natrium.',
  },

  // ---- Corrosion products ----
  {
    key: 'rust',
    label: 'Rost',
    category: 'hidden',
    color: ['#8b3e1c', '#7d3618', '#9a4823', '#6f2f14'],
    state: 'powder',
    density: 520,
    conductivity: 0.15,
    description: 'Korrodiertes Eisen. Leitet keinen Strom mehr.',
  },
  {
    key: 'patina',
    label: 'Patina',
    category: 'hidden',
    color: ['#4fa38a', '#46947d', '#5ab196', '#3e8570'],
    state: 'static',
    density: 3800,
    conductivity: 0.2,
    description: 'Grüne Kupferkorrosion. Leitet keinen Strom.',
  },
];
