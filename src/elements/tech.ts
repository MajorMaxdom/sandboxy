import type { ElementDef } from '../sim/types';
import type { Simulation } from '../sim/simulation';
import { ID } from './ids';
import { P, GAS, STATIC, LIGHT_PASS, LIGHT_SLASH, LIGHT_BACKSLASH, LIGHT_FILTER } from './props';
import { fanUpdate, windAt } from '../sim/wind';
import { pulse } from '../sim/radiation';
import { rgb565Lut } from './color';

/** Energy a generator must collect before it sends one electric pulse. */
const PULSE_COST = 40;

/** Collect energy in `life`; fire an electric pulse when there's enough. */
function generate(sim: Simulation, i: number, x: number, y: number, energy: number): void {
  const acc = sim.life[i] + Math.round(energy);
  if (acc >= PULSE_COST) {
    sim.life[i] = acc - PULSE_COST;
    pulse(sim, x, y);
  } else {
    sim.life[i] = acc;
  }
}

function fan(key: string, label: string, arrow: string, dx: number, dy: number): ElementDef {
  const update = fanUpdate(dx, dy);
  return {
    key,
    label: `Gebläse ${arrow}`,
    category: 'tech',
    color: ['#5b6b7a', '#7a8b9b', '#5b6b7a', '#7a8b9b'],
    state: 'static',
    density: 3000,
    conductivity: 0.3,
    update(sim, i, x, y) {
      // Wired to a conductor? Then it only runs while current arrives.
      let wired = false;
      for (const j of sim.neighbors4(x, y)) {
        if (!P.conducts[sim.type[j]]) continue;
        wired = true;
        if (sim.charge[j] > 0) sim.life[i] = 15;
      }
      if (wired) {
        if (sim.life[i] === 0) return false;
        sim.life[i]--;
      }
      sim.shade[i] = (sim.shade[i] + 1) & 3; // spinning blades
      return update(sim, i, x, y);
    },
    description: `Bläst Wind ${label} und erzeugt Luftströmung, die Röhren folgt. Mit Kabel verbunden läuft es nur unter Strom.`,
  };
}

/** Heat a laser puts into the cell it hits, per tick, and the most it heats it to. */
export const LASER_HEAT = 25;
const LASER_MAX_TEMP = 3000;
/** Ticks a wired part stays on after a pulse (kept in shade bits 2–7). */
const POWER_HOLD = 15;

/**
 * For parts whose `life` is taken (lasers, faucets): unwired they're always
 * on; wired to a conductor they only run while current arrives. The on-timer
 * lives in shade bits 2–7 (the renderer only uses bits 0–1).
 */
function poweredOrUnwired(sim: Simulation, i: number, x: number, y: number): boolean {
  let wired = false;
  let hold = sim.shade[i] >> 2;
  for (const j of sim.neighbors4(x, y)) {
    if (!P.conducts[sim.type[j]]) continue;
    wired = true;
    if (sim.charge[j] > 0) hold = POWER_HOLD;
  }
  if (wired) {
    if (hold === 0) {
      sim.shade[i] &= 3;
      return false;
    }
    hold--;
  }
  sim.shade[i] = (sim.shade[i] & 3) | (hold << 2);
  return true;
}

/** Filter: keep only what both colors share (per-channel product, RGB565). */
function filterColor(beam: number, filter: number): number {
  const r = Math.round((((beam >> 11) & 31) * ((filter >> 11) & 31)) / 31);
  const g = Math.round((((beam >> 5) & 63) * ((filter >> 5) & 63)) / 63);
  const b = Math.round(((beam & 31) * (filter & 31)) / 31);
  return (r << 11) | (g << 5) | b;
}

/** Too dark to count as light any more (after filters). */
function tooDark(c: number): boolean {
  return ((c >> 11) & 31) / 31 + ((c >> 5) & 63) / 63 + (c & 31) / 31 < 0.25;
}

/**
 * Follow a beam from (x, y) in direction (dx, dy): draw it into sim.beam
 * through empty space, gases and see-through cells, turn at mirrors, change
 * color in filters, and end at the first other cell — which either receives
 * the light (sensors, solar cells) or gets heated.
 */
export function traceBeam(sim: Simulation, x: number, y: number, dx: number, dy: number, color: number): void {
  const { w, h, type, temp, beam } = sim;
  const lut = rgb565Lut();
  const light = P.light;
  let px = lut[color];
  let cx = x + dx;
  let cy = y + dy;
  // Mirrors can trap a beam in a loop; it fades after this many cells.
  for (let steps = 8 * (w + h); steps > 0 && cx >= 0 && cy >= 0 && cx < w && cy < h; steps--) {
    const j = cy * w + cx;
    const t = type[j];
    const mode = light[t];
    if (t === 0 || P.state[t] === GAS || mode === LIGHT_PASS) {
      beam[j] = px;
    } else if (mode === LIGHT_SLASH) {
      const ndx = -dy;
      dy = -dx;
      dx = ndx;
    } else if (mode === LIGHT_BACKSLASH) {
      const ndx = dy;
      dy = dx;
      dx = ndx;
    } else if (mode === LIGHT_FILTER) {
      color = filterColor(color, sim.life[j] || P.defaultParam[t]);
      if (tooDark(color)) {
        temp[j] += LASER_HEAT / 5; // the filter swallows it and warms up a little
        return;
      }
      px = lut[color];
      beam[j] = px;
    } else {
      const receive = P.onLight[t];
      if (receive) receive(sim, j, cx, cy);
      else if (temp[j] < LASER_MAX_TEMP) temp[j] = Math.min(LASER_MAX_TEMP, temp[j] + LASER_HEAT);
      return;
    }
    cx += dx;
    cy += dy;
  }
}

/**
 * Laser: shines a beam of its color (RGB565 in `life`) until it hits matter,
 * which it heats. Empty space, gases and glass let the light through.
 */
function laser(key: string, label: string, arrow: string, dx: number, dy: number): ElementDef {
  return {
    key,
    label: `Laser ${arrow}`,
    category: 'tech',
    color: ['#3b3f46', '#3b3f46', '#3b3f46', '#3b3f46'],
    state: 'static',
    density: 3000,
    conductivity: 0.3,
    option: 'color',
    optionKey: 'laser',
    optionLabel: 'Farbe',
    optionDefault: '#ff2020',
    update(sim, i, x, y) {
      if (!poweredOrUnwired(sim, i, x, y)) return false;
      traceBeam(sim, x, y, dx, dy, sim.life[i] || P.defaultParam[sim.type[i]]);
      sim.beamUsed = true;
      return false;
    },
    description: `Strahlt Licht in der gewählten Farbe ${label}. Erhitzt, was er trifft (zündet Holz, schmilzt Eis); Glas lässt das Licht durch. Mit Kabel verbunden leuchtet er nur unter Strom.`,
  };
}

/** Energy a solar cell gets per tick of laser light (a pulse costs PULSE_COST). */
const SOLAR_ENERGY = 8;
/** Chance per tick that a faucet releases a particle. */
const FAUCET_RATE = 0.3;

/** Conveyor belt: carries loose stuff lying on top of it sideways. */
function conveyor(key: string, arrow: string, dx: number): ElementDef {
  return {
    key,
    label: `Förderband ${arrow}`,
    category: 'tech',
    color: ['#3a3a3a', '#3a3a3a', '#585858', '#585858'],
    state: 'static',
    density: 3000,
    conductivity: 0.3,
    update(sim, i, x, y) {
      const { w, type, rng } = sim;
      sim.shade[i] = (x - dx * Math.floor(sim.tick / 6)) & 3; // stripes running along the belt
      if (y === 0 || rng.next() > 0.5) return false;
      const above = i - w;
      const t = type[above];
      const nx = x + dx;
      if (t === 0 || P.state[t] === STATIC || nx < 0 || nx >= w) return false;
      const target = above + dx;
      const tt = type[target];
      if (tt === 0 || (P.state[tt] === GAS && P.state[t] !== GAS)) sim.swap(above, target);
      return false;
    },
    description: `Transportiert, was darauf liegt, nach ${dx > 0 ? 'rechts' : 'links'}.`,
  };
}

export const tech: ElementDef[] = [
  fan('fan right', 'nach rechts', '→', 1, 0),
  fan('fan left', 'nach links', '←', -1, 0),
  fan('fan up', 'nach oben', '↑', 0, -1),
  fan('fan down', 'nach unten', '↓', 0, 1),
  laser('laser right', 'nach rechts', '→', 1, 0),
  laser('laser left', 'nach links', '←', -1, 0),
  laser('laser up', 'nach oben', '↑', 0, -1),
  laser('laser down', 'nach unten', '↓', 0, 1),
  {
    key: 'mirror slash',
    label: 'Spiegel ╱',
    category: 'tech',
    color: ['#d8e2ea', '#c4d0da', '#e8eef3', '#b8c6d2'],
    state: 'static',
    density: 3000,
    conductivity: 0.3,
    light: 'mirror/',
    description: 'Lenkt Laserstrahlen um 90° um, wie ein schräger Spiegel ╱ (von links kommend nach oben).',
  },
  {
    key: 'mirror backslash',
    label: 'Spiegel ╲',
    category: 'tech',
    color: ['#d8e2ea', '#c4d0da', '#e8eef3', '#b8c6d2'],
    state: 'static',
    density: 3000,
    conductivity: 0.3,
    light: 'mirror\\',
    description: 'Lenkt Laserstrahlen um 90° um, wie ein schräger Spiegel ╲ (von links kommend nach unten).',
  },
  {
    key: 'color filter',
    label: 'Farbfilter',
    category: 'tech',
    color: ['#bfe6ef', '#b0dde8', '#cdeef5', '#a7d4df'],
    state: 'static',
    density: 2500,
    conductivity: 0.2,
    option: 'color',
    optionLabel: 'Farbe',
    optionDefault: '#ff2020',
    light: 'filter',
    tempHigh: 1400,
    stateHigh: 'molten glass',
    description: 'Farbiges Glas: lässt von einem Laserstrahl nur seine eigene Farbe durch. Weiß durch Rot wird rot, Blau durch Rot wird verschluckt.',
  },
  {
    key: 'solar cell',
    label: 'Solarzelle',
    category: 'tech',
    color: ['#1d2f5c', '#22386b', '#1a2a52', '#2a4480'],
    state: 'static',
    density: 2500,
    conductivity: 0.3,
    onLight(sim, i, x, y) {
      generate(sim, i, x, y, SOLAR_ENERGY);
    },
    description: 'Erzeugt Strom, solange ein Laserstrahl sie trifft.',
  },
  {
    key: 'faucet',
    label: 'Wasserhahn',
    category: 'tech',
    color: ['#9aa4ae', '#8a949e', '#aab4be', '#7a848e'],
    state: 'static',
    density: 3000,
    conductivity: 0.3,
    option: 'element',
    optionLabel: 'Gibt aus',
    optionDefault: 'water',
    update(sim, i, x, y) {
      if (!poweredOrUnwired(sim, i, x, y)) return false;
      if (sim.rng.next() > FAUCET_RATE) return false;
      const out = sim.life[i] || ID.water;
      // Pour downwards if possible, otherwise into any free side.
      const { w, h, type } = sim;
      if (y < h - 1 && type[i + w] === 0) {
        sim.spawn(i + w, out);
        return false;
      }
      const j = sim.randomNeighbor4(x, y);
      if (j >= 0 && type[j] === 0) sim.spawn(j, out);
      return false;
    },
    description: 'Gibt endlos das gewählte Element aus, bevorzugt nach unten. Mit Kabel verbunden nur unter Strom.',
  },
  conveyor('conveyor right', '→', 1),
  conveyor('conveyor left', '←', -1),
  {
    key: 'wind turbine',
    label: 'Windrad',
    category: 'tech',
    color: ['#eef1f4', '#9aa4ae', '#eef1f4', '#9aa4ae'],
    state: 'static',
    density: 2000,
    conductivity: 0.3,
    conducts: true, // a whole block of generators feeds one wire
    lightsUp: true, // keep showing the spinning blades instead of 'charged' yellow
    update(sim, i, x, y) {
      const [wx, wy] = windAt(sim, i);
      const wind = Math.abs(wx) + Math.abs(wy);
      if (wind < 0.1) return false;
      if (sim.rng.next() < Math.min(1, wind)) sim.shade[i] = (sim.shade[i] + 1) & 3;
      generate(sim, i, x, y, wind * 10);
      return false;
    },
    description: 'Erzeugt im Wind (Regler oder Gebläse) Strom für angrenzende Leiter. Mehr Wind = mehr Strom.',
  },
  {
    key: 'steam turbine',
    label: 'Dampfturbine',
    category: 'tech',
    color: ['#8c6d4f', '#a5876a', '#8c6d4f', '#a5876a'],
    state: 'static',
    density: 3000,
    conductivity: 0.3,
    conducts: true, // a whole block of generators feeds one wire
    lightsUp: true, // keep showing the spinning blades instead of 'charged' yellow
    update(sim, i, x, y) {
      let steam = 0;
      for (const j of sim.neighbors4(x, y)) {
        if (sim.type[j] !== ID.steam) continue;
        steam++;
        // Spent steam condenses and drips back down.
        if (sim.rng.next() < 0.03) sim.transform(j, ID.water, true);
      }
      if (steam === 0) return false;
      sim.shade[i] = (sim.shade[i] + 1) & 3;
      generate(sim, i, x, y, steam * 15);
      return false;
    },
    description: 'Erzeugt Strom, wenn Dampf an ihr vorbeiströmt. Ideal über einem Uran-Wasser-Reaktor.',
  },
  {
    key: 'lamp',
    label: 'Lampe',
    category: 'tech',
    color: ['#3a3626', '#3a3626', '#fff4c2', '#3a3626'],
    state: 'static',
    density: 2500,
    conductivity: 0.3,
    conducts: true,
    resistance: 0.5,
    lightsUp: true,
    update(sim, i) {
      if (sim.charge[i] > 0) sim.life[i] = 15;
      else if (sim.life[i] > 0) sim.life[i]--;
      sim.shade[i] = sim.life[i] > 0 ? 2 : 0;
    },
    description: 'Leuchtet, solange Strom fließt. Zeigt, ob dein Generator funktioniert.',
  },
];
