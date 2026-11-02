import type { ElementDef } from '../sim/types';
import type { Simulation } from '../sim/simulation';
import { ID } from './ids';
import { P } from './props';
import { fanUpdate, windAt } from '../sim/wind';
import { pulse } from '../sim/radiation';

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

export const tech: ElementDef[] = [
  fan('fan right', 'nach rechts', '→', 1, 0),
  fan('fan left', 'nach links', '←', -1, 0),
  fan('fan up', 'nach oben', '↑', 0, -1),
  fan('fan down', 'nach unten', '↓', 0, 1),
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
