import type { ElementDef } from '../sim/types';
import type { Simulation } from '../sim/simulation';
import { ID } from './ids';
import { P, GAS, CHARGE_MAX } from './props';

/** A bolt zig-zags straight down in a single tick and blasts what it hits. */
function strike(sim: Simulation, x: number, y: number): void {
  const { w, h, type, temp, rng } = sim;
  sim.transform(y * w + x, ID.bolt);
  let cx = x;
  for (let cy = y + 1; cy < h; cy++) {
    let nx = cx + rng.int(3) - 1;
    if (nx < 0 || nx >= w) nx = cx;
    const j = cy * w + nx;
    const t = type[j];
    if (t === 0 || P.state[t] === GAS) {
      sim.transform(j, ID.bolt);
      cx = nx;
      continue;
    }
    // Impact
    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        const ix = nx + dx;
        const iy = cy + dy;
        if (!sim.inBounds(ix, iy)) continue;
        const k = iy * w + ix;
        const tk = type[k];
        if (P.indestructible[tk]) continue;
        if (P.conducts[tk]) sim.charge[k] = CHARGE_MAX;
        temp[k] += 2500 / (1 + dx * dx + dy * dy);
      }
    }
    return;
  }
}

function chargeNeighbours(sim: Simulation, x: number, y: number, heat: number): void {
  for (const j of sim.neighbors4(x, y)) {
    const t = sim.type[j];
    if (t === 0) continue;
    if (P.conducts[t]) {
      if (sim.charge[j] === 0) sim.charge[j] = CHARGE_MAX;
    } else {
      sim.temp[j] += heat;
    }
  }
}

export const energy: ElementDef[] = [
  {
    key: 'fire',
    label: 'Feuer',
    category: 'energy',
    color: ['#ff5a00', '#ff8c1a', '#ffc23d', '#ff3300'],
    state: 'gas',
    density: 3,
    defaultTemp: 800,
    conductivity: 0.5,
    lifespan: [12, 40],
    decayInto: ['empty', 'empty', 'empty', 'smoke'],
    glow: true,
    reactions: { water: { into: 'steam', chance: 0.5 } },
    update(sim, i, x, y) {
      if (sim.temp[i] < 750) sim.temp[i] = 750;
      // Flames lick at their surroundings: ignite flammables/explosives directly.
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if ((dx === 0 && dy === 0) || !sim.inBounds(x + dx, y + dy)) continue;
          const j = (y + dy) * sim.w + x + dx;
          const ign = P.actTemp[sim.type[j]];
          if (ign < 750 && sim.temp[j] < ign + 80 && sim.rng.next() < 0.4) sim.temp[j] = ign + 80;
        }
      }
    },
    description: 'Heiß und flüchtig. Entzündet Brennbares.',
  },
  {
    key: 'plasma',
    label: 'Plasma',
    category: 'energy',
    color: ['#d77bff', '#c95cff', '#e8a3ff', '#b84dff'],
    state: 'gas',
    density: 1,
    defaultTemp: 6000,
    conductivity: 0.8,
    lifespan: [6, 18],
    decayInto: ['empty', 'fire'],
    glow: true,
    update(sim, i) {
      if (sim.temp[i] < 5000) sim.temp[i] = 5000;
    },
    description: 'Extrem heiß (6000 °C). Schmilzt fast alles.',
  },
  {
    key: 'spark',
    label: 'Funke',
    category: 'energy',
    color: ['#fff6a0', '#fff07a', '#ffffff', '#ffe95c'],
    state: 'static',
    density: 1,
    conductivity: 0.2,
    lifespan: [2, 5],
    decayInto: 'empty',
    glow: true,
    paintChance: 0.3,
    update(sim, _i, x, y) {
      chargeNeighbours(sim, x, y, 150);
    },
    description: 'Elektrischer Funke. Auf Metall oder Wasser malen, um Strom zu leiten.',
  },
  {
    key: 'battery',
    label: 'Batterie',
    category: 'energy',
    color: ['#e0c020', '#d4b41a', '#ebcc30', '#c9a915'],
    state: 'static',
    density: 3000,
    conductivity: 0.3,
    // Charging of neighbours happens in the electricity pass.
    description: 'Stromquelle. Lädt angrenzende Leiter (Metall, Wasser) dauerhaft.',
  },
  {
    key: 'lightning',
    label: 'Blitz',
    category: 'energy',
    color: ['#e8f4ff', '#d6ecff', '#ffffff', '#c4e2ff'],
    state: 'static',
    density: 1,
    paintChance: 0.01,
    update(sim, _i, x, y) {
      strike(sim, x, y);
      return true;
    },
    description: 'Schlägt nach unten ein, setzt Leiter unter Strom und erhitzt den Einschlagsort enorm.',
  },
  {
    key: 'bolt',
    label: 'Blitz',
    category: 'hidden',
    color: ['#f4f9ff', '#dcedff', '#ffffff', '#c9e4ff'],
    state: 'static',
    density: 1,
    defaultTemp: 1500,
    conductivity: 0.3,
    lifespan: [6, 14],
    decayInto: 'empty',
    glow: true,
    update(sim, _i, x, y) {
      chargeNeighbours(sim, x, y, 200);
    },
  },
];
