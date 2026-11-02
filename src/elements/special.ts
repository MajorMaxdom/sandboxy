import type { ElementDef } from '../sim/types';
import type { Simulation } from '../sim/simulation';
import { ID } from './ids';
import { P, GAS, STATIC } from './props';
import { hexToRgb565 } from './color';

function isProtected(t: number): boolean {
  return t === 0 || t === ID.wall || t === ID.clone || t === ID.void;
}

/** Black hole: how far it pulls, and its pull (speed gained per tick ≈ HOLE_PULL / distance). */
const HOLE_REACH = 16;
const HOLE_PULL = 6;
/** Default portal channel color. */
const PORTAL_COLOR = '#3fa9ff';
const PORTAL_DEFAULT = hexToRgb565(PORTAL_COLOR);

/** Find a free cell next to portal exit e: below first, then the sides, then above. */
function freeNextTo(sim: Simulation, e: number): number {
  const { w, h, type } = sim;
  const x = e % w;
  const y = (e - x) / w;
  if (y < h - 1 && type[e + w] === 0) return e + w;
  const side = sim.rng.next() < 0.5 ? -1 : 1;
  if (x + side >= 0 && x + side < w && type[e + side] === 0) return e + side;
  if (x - side >= 0 && x - side < w && type[e - side] === 0) return e - side;
  if (y > 0 && type[e - w] === 0) return e - w;
  return -1;
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
  {
    key: 'black hole',
    label: 'Schwarzes Loch',
    category: 'special',
    color: ['#05000a', '#3a0a5c', '#05000a', '#7a2ab0'], // black core with a purple shimmer
    state: 'static',
    density: 100000,
    conductivity: 0,
    indestructible: true,
    acidProof: true,
    glow: true,
    update(sim, i, x, y) {
      const { w, h, type, rng } = sim;
      // Swallow whatever touches it (solid walls only slowly).
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx;
          const ny = y + dy;
          if ((!dx && !dy) || nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
          const j = ny * w + nx;
          const t = type[j];
          if (t === 0 || t === ID['black hole'] || P.indestructible[t]) continue;
          if (rng.next() < (P.state[t] === STATIC ? 0.02 : 0.5)) sim.transform(j, ID.empty, true);
        }
      }
      // Only cells on the hole's edge pull (keeps big holes cheap; bigger holes still pull harder).
      if (
        x > 0 && y > 0 && x < w - 1 && y < h - 1 &&
        type[i - 1] === type[i] && type[i + 1] === type[i] && type[i - w] === type[i] && type[i + w] === type[i]
      ) {
        return false;
      }
      const { vx, vy } = sim;
      const r2max = HOLE_REACH * HOLE_REACH;
      for (let dy = -HOLE_REACH; dy <= HOLE_REACH; dy++) {
        const py = y + dy;
        if (py < 0 || py >= h) continue;
        for (let dx = -HOLE_REACH; dx <= HOLE_REACH; dx++) {
          const d2 = dx * dx + dy * dy;
          if (d2 < 4 || d2 > r2max) continue;
          const pxx = x + dx;
          if (pxx < 0 || pxx >= w) continue;
          const j = py * w + pxx;
          const t = type[j];
          if (t === 0 || P.state[t] === STATIC) continue;
          if (P.state[t] === GAS) {
            // Gases have no velocity: drift one step closer now and then.
            if (rng.next() < 0.3) {
              const n = (py - Math.sign(dy)) * w + pxx - Math.sign(dx);
              if (type[n] === 0) sim.swap(j, n);
            }
            continue;
          }
          // Powders and liquids get accelerated towards the hole and fly ballistically.
          const a = Math.min(1, HOLE_PULL / d2);
          vx[j] = Math.max(-4, Math.min(4, vx[j] - dx * a));
          vy[j] = Math.max(-4, Math.min(4, vy[j] - dy * a));
          sim.wake(j);
        }
      }
      return false;
    },
    description: 'Zieht lose Teilchen im Umkreis an und verschluckt alles, was es berührt. Nur Wände halten stand.',
  },
  {
    key: 'antimatter',
    label: 'Antimaterie',
    category: 'special',
    color: ['#ff2fd0', '#d81fb0', '#ff6ae0', '#b0108f'],
    state: 'powder',
    density: 100,
    conductivity: 0,
    acidProof: true,
    glow: true,
    windFactor: 0,
    update(sim, i, x, y) {
      for (const j of sim.neighbors4(x, y)) {
        const t = sim.type[j];
        if (t === 0 || t === ID.antimatter || P.indestructible[t]) continue;
        // Matter meets antimatter: both vanish in a flash.
        sim.transform(i, ID.empty, true);
        sim.transform(j, ID.fire);
        sim.temp[j] = 2500;
        sim.addPressure(x, y, 3, 2);
        if (sim.rng.next() < 0.1) sim.explode(x, y, 4);
        return true;
      }
      return false;
    },
    description: 'Vernichtet alles, was sie berührt, samt sich selbst, mit Blitz und Knall. Nur unzerstörbare Wände halten sie auf.',
  },
  {
    key: 'converter',
    label: 'Konverter',
    category: 'special',
    color: ['#7a3fbf', '#6a35a8', '#8a4fd0', '#5a2a90'],
    state: 'static',
    density: 5000,
    conductivity: 0,
    acidProof: true,
    indestructible: true,
    option: 'element',
    optionLabel: 'Wandelt um in',
    optionDefault: 'stone',
    calm: true,
    update(sim, i, x, y) {
      const into = sim.life[i] || ID.stone;
      for (const j of sim.neighbors4(x, y)) {
        const t = sim.type[j];
        if (isProtected(t) || t === into || t === ID.converter) continue;
        sim.wake(i); // still has work to do
        if (sim.rng.next() < 0.1) sim.transform(j, into);
      }
      return false;
    },
    description: 'Verwandelt alles, was es berührt, in das gewählte Element.',
  },
  {
    key: 'portal in',
    label: 'Portal (Eingang)',
    category: 'special',
    color: ['#3fa9ff', '#3fa9ff', '#3fa9ff', '#3fa9ff'],
    state: 'static',
    density: 100000,
    conductivity: 0,
    indestructible: true,
    acidProof: true,
    option: 'color',
    optionKey: 'portal',
    optionLabel: 'Kanal',
    optionDefault: PORTAL_COLOR,
    update(sim, i, x, y) {
      const { type, life, rng } = sim;
      const channel = life[i] || PORTAL_DEFAULT;
      const exits = sim.portalExits;
      if (exits.length === 0) return false;
      for (const j of sim.neighbors4(x, y)) {
        const t = type[j];
        if (t === 0 || P.state[t] === STATIC || rng.next() > 0.5) continue;
        // A random exit on the same channel (checked: it may be gone by now).
        const start = rng.int(exits.length);
        for (let k = 0; k < exits.length; k++) {
          const e = exits[(start + k) % exits.length];
          if (type[e] !== ID['portal out'] || (life[e] || PORTAL_DEFAULT) !== channel) continue;
          const target = freeNextTo(sim, e);
          if (target >= 0) sim.swap(j, target);
          break;
        }
      }
      return false;
    },
    description: 'Was hineinfällt oder -fließt, kommt aus einem Portal-Ausgang mit derselben Kanalfarbe wieder heraus.',
  },
  {
    key: 'portal out',
    label: 'Portal (Ausgang)',
    category: 'special',
    color: ['#1f5480', '#1f5480', '#1f5480', '#1f5480'],
    state: 'static',
    density: 100000,
    conductivity: 0,
    indestructible: true,
    acidProof: true,
    option: 'color',
    optionKey: 'portal',
    optionLabel: 'Kanal',
    optionDefault: PORTAL_COLOR,
    dimOwnColor: true,
    update(sim, i) {
      sim.portalExitsNext.push(i);
      return false;
    },
    description: 'Ausgang für Portal-Eingänge derselben Kanalfarbe (dunkler dargestellt).',
  },
];
