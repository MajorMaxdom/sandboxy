import type { ElementDef } from '../sim/types';
import type { Simulation } from '../sim/simulation';
import { ID } from './ids';
import { P, CHARGE_MAX, STATIC } from './props';
import { pulse, signal } from '../sim/radiation';

/**
 * Logic parts read their inputs as "a wire next to me was freshly powered"
 * (charge === CHARGE_MAX happens exactly once per passing pulse) and send
 * signals with `signal()`. Gates point right: inputs left (or top/bottom),
 * output right.
 */
const fresh = (sim: Simulation, j: number) => j >= 0 && sim.charge[j] === CHARGE_MAX;
const leftOf = (sim: Simulation, x: number, y: number) => (x > 0 ? y * sim.w + x - 1 : -1);
const rightOf = (sim: Simulation, x: number, y: number) => (x < sim.w - 1 ? y * sim.w + x + 1 : -1);
const above = (sim: Simulation, x: number, y: number) => (y > 0 ? (y - 1) * sim.w + x : -1);
const below = (sim: Simulation, x: number, y: number) => (y < sim.h - 1 ? (y + 1) * sim.w + x : -1);

const OFF = '#2a2f36';

function part(def: Omit<ElementDef, 'category' | 'state' | 'density' | 'logic'>): ElementDef {
  return { category: 'logic', state: 'static', density: 2500, logic: true, conductivity: 0.2, ...def };
}

/** Diode / delay: passes a pulse from left to right after `delay` ticks. */
function delayPart(key: string, label: string, delay: number, on: string, description: string): ElementDef {
  return part({
    key,
    label,
    color: [OFF, OFF, on, OFF],
    update(sim, i, x, y) {
      const l = sim.life[i];
      if (l > 0) {
        sim.life[i] = l - 1;
        if (l === 1) signal(sim, rightOf(sim, x, y));
      } else if (fresh(sim, leftOf(sim, x, y))) {
        sim.life[i] = delay;
      }
      sim.shade[i] = sim.life[i] > 0 ? 2 : 0;
    },
    description,
  });
}

export const logic: ElementDef[] = [
  {
    key: 'switch',
    label: 'Schalter',
    category: 'logic',
    color: ['#6b2b2b', '#6b2b2b', '#3fbf5a', '#6b2b2b'],
    state: 'static',
    density: 2500,
    conductivity: 0.5,
    conducts: true,
    resistance: 0.3,
    logic: true,
    initLife: [1, 1],
    update(sim, i) {
      sim.shade[i] = sim.life[i] ? 2 : 0;
    },
    description: 'Leitet Strom, wenn er an ist (grün). Mit dem Werkzeug „Schalter umlegen“ an- und ausschalten.',
  },
  part({
    key: 'clock',
    label: 'Taktgeber',
    color: ['#3a3260', '#3a3260', '#9d8cff', '#3a3260'],
    update(sim, i, x, y) {
      const l = sim.life[i] + 1;
      if (l >= 30) {
        sim.life[i] = 0;
        pulse(sim, x, y);
        sim.shade[i] = 2;
      } else {
        sim.life[i] = l;
        if (l > 4) sim.shade[i] = 0;
      }
    },
    description: 'Sendet zweimal pro Sekunde einen Stromimpuls.',
  }),
  part({
    key: 'touch sensor',
    label: 'Berührungssensor',
    color: ['#3b3324', '#3b3324', '#ffcf4d', '#3b3324'],
    update(sim, i, x, y) {
      if (sim.life[i] > 0) {
        sim.life[i]--;
        sim.shade[i] = sim.life[i] > 2 ? 2 : 0;
        return;
      }
      for (const j of sim.neighbors4(x, y)) {
        const t = sim.type[j];
        if (t === 0 || P.logic[t] || P.conducts[t]) continue;
        // Anything loose or alive (creatures are static but self-updating).
        if (P.state[t] !== STATIC || t === ID.fish || t === ID.ant || t === ID.bird || t === ID.worm) {
          sim.life[i] = 8;
          sim.shade[i] = 2;
          pulse(sim, x, y);
          return;
        }
      }
      sim.shade[i] = 0;
    },
    description: 'Gibt Stromimpulse ab, solange etwas Lockeres oder Lebendiges ihn berührt.',
  }),
  part({
    key: 'heat sensor',
    label: 'Hitzesensor',
    color: ['#3b2424', '#3b2424', '#ff6a4d', '#3b2424'],
    update(sim, i, x, y) {
      if (sim.life[i] > 0) {
        sim.life[i]--;
        sim.shade[i] = sim.life[i] > 2 ? 2 : 0;
        return;
      }
      let hot = false;
      for (const j of sim.neighbors4(x, y)) if (!P.logic[sim.type[j]] && sim.temp[j] > 100) hot = true;
      if (hot) {
        sim.life[i] = 8;
        sim.shade[i] = 2;
        pulse(sim, x, y);
      } else sim.shade[i] = 0;
    },
    description: 'Gibt Stromimpulse ab, wenn etwas daneben heißer als 100 °C ist.',
  }),
  delayPart('diode', 'Diode →', 1, '#7ad1ff', 'Lässt Strom nur von links nach rechts durch.'),
  delayPart('delay', 'Verzögerer →', 30, '#4dc7ff', 'Gibt einen Impuls von links eine halbe Sekunde später nach rechts weiter.'),
  part({
    key: 'not gate',
    label: 'NICHT-Gatter →',
    color: ['#3a2a40', '#3a2a40', '#ff7ad9', '#3a2a40'],
    update(sim, i, x, y) {
      if (fresh(sim, leftOf(sim, x, y))) sim.life[i] = 14;
      else if (sim.life[i] > 0) sim.life[i]--;
      const active = sim.life[i] === 0;
      if (active && sim.tick % 8 === 0) signal(sim, rightOf(sim, x, y));
      sim.shade[i] = active ? 2 : 0;
    },
    description: 'Gibt rechts Strom aus, solange links KEIN Strom ankommt.',
  }),
  part({
    key: 'and gate',
    label: 'UND-Gatter →',
    color: ['#2a3a2e', '#2a3a2e', '#7aff9d', '#2a3a2e'],
    update(sim, i, x, y) {
      // life: low byte = timer of the top input, high byte = bottom input.
      let top = sim.life[i] & 255;
      let bottom = sim.life[i] >> 8;
      if (fresh(sim, above(sim, x, y))) top = 10;
      else if (top > 0) top--;
      if (fresh(sim, below(sim, x, y))) bottom = 10;
      else if (bottom > 0) bottom--;
      if (top > 0 && bottom > 0) {
        signal(sim, rightOf(sim, x, y));
        top = 0;
        bottom = 0;
        sim.shade[i] = 2;
      } else sim.shade[i] = 0;
      sim.life[i] = top | (bottom << 8);
    },
    description: 'Gibt rechts einen Impuls aus, wenn oben UND unten (fast) gleichzeitig Strom ankommt.',
  }),
];
