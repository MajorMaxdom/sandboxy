import type { ElementDef } from '../sim/types';
import type { Simulation } from '../sim/simulation';
import { ID } from './ids';
import { P, GAS, LIQUID, STATIC } from './props';

const isWater = (t: number) => t === ID.water || t === ID['salt water'];
const isAir = (t: number) => t === 0 || P.state[t] === GAS;
const isWet = (t: number) => isWater(t) || t === ID.steam || t === ID.mud;

/**
 * Something that spreads over a surface (grass, moss): with `chance` per tick
 * it turns a neighbouring cell accepted by `canGrowInto` into itself. Stays
 * awake only while there is somewhere to spread to, so a finished lawn sleeps.
 */
function spreadOver(
  sim: Simulation,
  i: number,
  x: number,
  y: number,
  id: number,
  chance: number,
  canGrowInto: (j: number) => boolean,
): void {
  const { w, h } = sim;
  let room = false;
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const nx = x + dx;
      const ny = y + dy;
      if ((dx === 0 && dy === 0) || nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const j = ny * w + nx;
      if (!canGrowInto(j)) continue;
      room = true;
      if (sim.rng.next() < chance) sim.transform(j, id);
    }
  }
  if (room) sim.wake(i);
}

/** Does cell j touch water (orthogonally)? */
function touchesWater(sim: Simulation, j: number): boolean {
  const { w, h, type } = sim;
  const x = j % w;
  const y = (j - x) / w;
  return (
    (y > 0 && isWater(type[j - w])) ||
    (y < h - 1 && isWater(type[j + w])) ||
    (x > 0 && isWater(type[j - 1])) ||
    (x < w - 1 && isWater(type[j + 1]))
  );
}

/** Does cell j touch empty space or gas (orthogonally)? */
function touchesAir(sim: Simulation, j: number): boolean {
  const { w, h, type } = sim;
  const x = j % w;
  const y = (j - x) / w;
  return (
    (y > 0 && isAir(type[j - w])) ||
    (y < h - 1 && isAir(type[j + w])) ||
    (x > 0 && isAir(type[j - 1])) ||
    (x < w - 1 && isAir(type[j + 1]))
  );
}

export const life: ElementDef[] = [
  {
    key: 'seed',
    label: 'Samen',
    category: 'life',
    radiation: 'mutate',
    color: ['#9c7b3c', '#8a6a30', '#7fa04a', '#6e5626'],
    state: 'powder',
    density: 120,
    conductivity: 0.1,
    burn: { ignite: 200, chance: 0.2, into: ['fire', 'ash'], heat: 400 },
    update(sim, i, x, y) {
      if (y + 1 >= sim.h) return false;
      const below = sim.type[i + sim.w];
      if ((below === ID.dirt || below === ID.mud) && sim.rng.next() < 0.02) {
        sim.transform(i, ID.plant);
        sim.life[i] = 25 + sim.rng.int(30);
        return true;
      }
      return false;
    },
    description: 'Keimt auf Erde oder Schlamm zu einer Pflanze.',
  },
  {
    key: 'plant',
    label: 'Pflanze',
    category: 'life',
    radiation: 'mutate',
    color: ['#3fa34d', '#36923f', '#4cb85a', '#2f8238'],
    state: 'static',
    density: 800,
    conductivity: 0.15,
    heatCap: 2,
    initLife: [0, 0],
    burn: { ignite: 220, chance: 0.04, into: ['fire', 'fire', 'ash'], heat: 600 },
    update(sim, i, x, y) {
      const rng = sim.rng;
      // Drink adjacent water to keep growing.
      if (rng.next() < 0.03) {
        const n = sim.randomNeighbor4(x, y);
        if (n >= 0 && sim.type[n] === ID.water) {
          sim.transform(n, ID.empty, true);
          sim.life[i] = Math.min(sim.life[i] + 4, 40);
        }
      }
      if (sim.life[i] > 0 && rng.next() < 0.06) {
        const r = rng.next();
        const dx = r < 0.6 ? 0 : r < 0.8 ? -1 : 1;
        const dy = r > 0.96 ? 0 : -1;
        const nx = x + dx;
        const ny = y + dy;
        if (!sim.inBounds(nx, ny)) return false;
        const j = ny * sim.w + nx;
        if (sim.type[j] === 0) {
          sim.spawn(j, ID.plant);
          sim.life[j] = sim.life[i] - 1;
          if (rng.next() < 0.85) sim.life[i] = 0;
          else sim.life[i] -= 1;
        }
      }
      return false;
    },
    description: 'Wächst nach oben, solange sie Wasser findet. Brennbar.',
  },
  {
    key: 'fungus',
    label: 'Pilz',
    category: 'life',
    radiation: 'kill',
    color: ['#b88fc4', '#a97fb6', '#c69fd1', '#9a70a7'],
    state: 'static',
    density: 700,
    conductivity: 0.1,
    tempHigh: 90,
    stateHigh: 'ash',
    burn: { ignite: 180, chance: 0.05, into: ['fire', 'ash'], heat: 500 },
    reactions: {
      wood: { otherInto: 'fungus', chance: 0.004 },
      plant: { otherInto: 'fungus', chance: 0.01 },
      seed: { otherInto: 'fungus', chance: 0.01 },
      dirt: { otherInto: 'fungus', chance: 0.0005 },
    },
    description: 'Breitet sich langsam über Holz und Pflanzen aus.',
  },
  {
    key: 'vine',
    label: 'Ranke',
    category: 'life',
    radiation: 'mutate',
    color: ['#2e7d32', '#276b2b', '#368f3b', '#215c25'],
    state: 'static',
    density: 800,
    conductivity: 0.15,
    initLife: [25, 70],
    burn: { ignite: 220, chance: 0.04, into: ['fire', 'ash'], heat: 600 },
    update(sim, i, x, y) {
      const rng = sim.rng;
      if (sim.life[i] > 0 && rng.next() < 0.05) {
        const r = rng.next();
        const dx = r < 0.7 ? 0 : r < 0.85 ? -1 : 1;
        const nx = x + dx;
        const ny = y + 1;
        if (!sim.inBounds(nx, ny)) return false;
        const j = ny * sim.w + nx;
        if (sim.type[j] === 0) {
          sim.spawn(j, ID.vine);
          sim.life[j] = sim.life[i] - 1;
          if (rng.next() < 0.9) sim.life[i] = 0;
        }
      }
      return false;
    },
    description: 'Wächst von der Decke nach unten.',
  },
  {
    key: 'fish',
    label: 'Fisch',
    category: 'life',
    radiation: 'kill',
    color: ['#ff8c42', '#f57c30', '#ffa060', '#e86f25'],
    state: 'static',
    density: 100,
    conductivity: 0.3,
    heatCap: 2,
    initLife: [1, 2],
    tempHigh: 45,
    stateHigh: 'ash',
    update(sim, i, x, y) {
      const { w, h, type, rng } = sim;
      // Fall when there's nothing underneath.
      if (y + 1 < h && isAir(type[i + w])) {
        sim.swap(i, i + w);
        return true;
      }
      let wet = false;
      for (const j of sim.neighbors4(x, y)) if (isWater(type[j])) wet = true;
      if (!wet) {
        // Flopping on land; eventually suffocates.
        if (rng.next() < 0.004) sim.transform(i, ID.ash);
        return true;
      }
      // Nibble on algae now and then.
      if (rng.next() < 0.02) {
        const j = sim.randomNeighbor4(x, y);
        if (j >= 0 && type[j] === ID.algae) sim.transform(j, ID.water);
      }
      if (rng.next() < 0.35) {
        const dx = sim.life[i] === 1 ? -1 : 1;
        const dy = rng.next() < 0.2 ? (rng.next() < 0.5 ? -1 : 1) : 0;
        const nx = x + dx;
        const ny = y + dy;
        if (sim.inBounds(nx, ny) && isWater(type[ny * w + nx])) {
          sim.swap(i, ny * w + nx);
        } else {
          sim.life[i] = sim.life[i] === 1 ? 2 : 1;
        }
      }
      return true;
    },
    description: 'Schwimmt im Wasser hin und her. An Land erstickt er, Hitze gart ihn.',
  },
  {
    key: 'ant',
    label: 'Ameise',
    category: 'life',
    radiation: 'kill',
    color: ['#3b1f12', '#2e170d', '#4a2817', '#24120a'],
    state: 'static',
    density: 150,
    conductivity: 0.2,
    initLife: [1, 2],
    burn: { ignite: 120, chance: 0.5, into: 'ash', heat: 300, spread: 0 },
    update(sim, i, x, y) {
      const { w, h, type, rng } = sim;
      if (y + 1 < h) {
        const b = type[i + w];
        if (isAir(b) || (P.state[b] === LIQUID && rng.next() < 0.3)) {
          sim.swap(i, i + w);
          return true;
        }
      }
      if (rng.next() < 0.003 && isWater(type[sim.randomNeighbor4(x, y)] ?? 0)) {
        sim.transform(i, ID.empty, true); // drowned
        return true;
      }
      if (rng.next() > 0.4) return true;
      const dx = sim.life[i] === 1 ? -1 : 1;
      const nx = x + dx;
      const flip = () => {
        sim.life[i] = sim.life[i] === 1 ? 2 : 1;
      };
      if (nx < 0 || nx >= w) {
        flip();
        return true;
      }
      const j = i + dx;
      const t = type[j];
      if (isAir(t)) {
        sim.swap(i, j);
        return true;
      }
      if (t === ID.plant || t === ID.seed || t === ID.fungus || t === ID.vine) {
        if (rng.next() < 0.3) sim.transform(j, ID.empty, true); // munch
        return true;
      }
      // Climb one step up.
      if (y > 0 && isAir(type[j - w]) && isAir(type[i - w])) {
        sim.swap(i, j - w);
        return true;
      }
      flip();
      return true;
    },
    description: 'Krabbelt herum, klettert Stufen hoch und frisst Pflanzen.',
  },
  {
    key: 'mutant plant',
    label: 'Mutantenpflanze',
    category: 'life',
    radiation: 'feed',
    color: ['#9dff2f', '#c84dff', '#5dff8a', '#e0ff4d'],
    state: 'static',
    density: 800,
    conductivity: 0.15,
    heatCap: 2,
    initLife: [15, 30],
    glow: true,
    radioactive: { emit: 0.0005 },
    burn: { ignite: 250, chance: 0.03, into: ['fire', 'fallout'], heat: 600 },
    update(sim, i, x, y) {
      const rng = sim.rng;
      if (rng.next() < 0.03) {
        const n = sim.randomNeighbor4(x, y);
        if (n >= 0 && sim.type[n] === ID.water) {
          sim.transform(n, ID.empty, true);
          sim.life[i] = Math.min(sim.life[i] + 4, 60);
        } else if (n >= 0 && sim.type[n] === ID.plant && rng.next() < 0.3) {
          sim.transform(n, ID['mutant plant']); // overgrows normal plants
        }
      }
      if (sim.life[i] > 0 && rng.next() < 0.08) {
        const j = sim.randomNeighbor8(x, y); // grows in every direction
        if (j >= 0 && sim.type[j] === 0) {
          sim.spawn(j, ID['mutant plant']);
          sim.life[j] = sim.life[i] - 1;
          sim.life[i] -= 1;
        }
      }
      return false;
    },
    description: 'Entsteht, wenn Strahlung Pflanzen trifft. Wuchert in alle Richtungen, frisst Strahlung und normale Pflanzen.',
  },
  {
    key: 'bird',
    label: 'Vogel',
    category: 'life',
    radiation: 'kill',
    color: ['#3d4a5c', '#2e3846', '#4a5a70', '#25303c'],
    state: 'static',
    density: 50,
    conductivity: 0.2,
    initLife: [1, 2],
    windFactor: 0.3,
    burn: { ignite: 150, chance: 0.5, into: 'ash', heat: 300, spread: 0 },
    update(sim, i, x, y) {
      const { w, h, type, rng } = sim;
      // Snack on seeds, ants and worms nearby.
      if (rng.next() < 0.05) {
        const n = sim.randomNeighbor8(x, y);
        if (n >= 0) {
          const t = type[n];
          if (t === ID.seed || t === ID.ant || t === ID.worm) sim.transform(n, ID.empty, true);
        }
      }
      // Drowns when stuck in liquid.
      if (y + 1 < h && P.state[type[i + w]] === LIQUID && y > 0 && P.state[type[i - w]] === LIQUID) {
        if (rng.next() < 0.02) sim.transform(i, ID.empty, true);
        return true;
      }
      if (rng.next() > 0.6) return true;
      const dir = sim.life[i] === 1 ? -1 : 1;
      // Keep some height above the ground.
      let ground = false;
      for (let k = 1; k <= 4 && y + k < h; k++) if (!isAir(type[i + k * w])) ground = true;
      const r = rng.next();
      const dy = ground ? (r < 0.5 ? -1 : 0) : r < 0.2 ? -1 : r < 0.4 ? 1 : 0;
      const nx = x + dir;
      const ny = y + dy;
      if (sim.inBounds(nx, ny) && type[ny * w + nx] === 0) {
        sim.swap(i, ny * w + nx);
      } else if (y > 0 && type[i - w] === 0 && rng.next() < 0.5) {
        sim.swap(i, i - w);
      } else {
        sim.life[i] = sim.life[i] === 1 ? 2 : 1;
      }
      return true;
    },
    description: 'Fliegt umher, hält Abstand zum Boden und pickt Samen, Ameisen und Würmer.',
  },
  {
    key: 'worm',
    label: 'Wurm',
    category: 'life',
    radiation: 'kill',
    color: ['#d98a8a', '#c97a7a', '#e69a9a', '#b86c6c'],
    state: 'static',
    density: 150,
    conductivity: 0.2,
    burn: { ignite: 120, chance: 0.5, into: 'ash', heat: 300, spread: 0 },
    update(sim, i, x, y) {
      const { w, h, type, rng } = sim;
      if (y + 1 < h && isAir(type[i + w])) {
        sim.swap(i, i + w);
        return true;
      }
      const n = sim.randomNeighbor4(x, y);
      if (n < 0) return true;
      const t = type[n];
      // Composting: turns ash into fresh soil.
      if (t === ID.ash && rng.next() < 0.1) {
        sim.transform(n, ID.dirt);
        return true;
      }
      if (isWater(t) && rng.next() < 0.002) {
        sim.transform(i, ID.empty, true);
        return true;
      }
      if (rng.next() < 0.25 && (t === ID.dirt || t === ID.mud || t === ID.sand)) {
        sim.swap(i, n); // burrows through the soil
      }
      return true;
    },
    description: 'Gräbt sich durch Erde, Schlamm und Sand und verwandelt Asche in Erde.',
  },
  {
    key: 'bacteria',
    label: 'Bakterien',
    category: 'life',
    radiation: 'kill',
    color: ['#e6b3cc', '#d9a3bf', '#f0c2d9', '#cc94b0'],
    state: 'powder',
    density: 90,
    conductivity: 0.2,
    initLife: [500, 700],
    tempHigh: 70,
    stateHigh: 'empty',
    update(sim, i, x, y) {
      // Starve slowly; eating oil keeps them alive and makes them multiply.
      if (--sim.life[i] === 0) {
        sim.transform(i, ID.empty, true);
        return true;
      }
      const n = sim.randomNeighbor4(x, y);
      if (n >= 0) {
        const t = sim.type[n];
        if ((t === ID.oil || t === ID.gasoline) && sim.rng.next() < 0.08) {
          sim.transform(n, ID.bacteria, true);
          sim.life[n] = 600;
          sim.life[i] = 600;
        }
      }
      return false;
    },
    description: 'Schwimmen auf Wasser, fressen Öl und Benzin und vermehren sich dabei. Ohne Futter sterben sie.',
  },
  {
    key: 'grass',
    label: 'Gras',
    category: 'life',
    radiation: 'kill',
    color: ['#4caf3a', '#3e9a2e', '#5cc04a', '#358a26'],
    state: 'static',
    density: 1200,
    conductivity: 0.2,
    burn: { ignite: 180, chance: 0.1, into: ['fire', 'ash'], heat: 400, spread: 0.4 },
    calm: true,
    update(sim, i, x, y) {
      const { w, type } = sim;
      // Covered up (no air above) for a while: it dies back to dirt.
      if (y > 0 && !isAir(type[i - w]) && P.state[type[i - w]] !== LIQUID) {
        if (sim.rng.next() < 0.002) sim.transform(i, ID.dirt);
        sim.wake(i);
        return false;
      }
      // Spreads over dirt that has air above it.
      spreadOver(sim, i, x, y, ID.grass, 0.01, (j) => type[j] === ID.dirt && j >= w && isAir(type[j - w]));
      return false;
    },
    description: 'Wächst über Erde, die Luft über sich hat. Zugedeckt wird es wieder zu Erde.',
  },
  {
    key: 'moss',
    label: 'Moos',
    category: 'life',
    radiation: 'kill',
    color: ['#5d7a3a', '#4f6b30', '#6b8a44', '#435c28'],
    state: 'static',
    density: 1200,
    conductivity: 0.2,
    tempHigh: 90,
    stateHigh: 'ash',
    burn: { ignite: 220, chance: 0.05, into: ['fire', 'ash'], heat: 400, spread: 0.2 },
    calm: true,
    update(sim, i, x, y) {
      const { w, h, type } = sim;
      // Damp: water (or steam, mud) within two cells.
      let wet = false;
      for (let dy = -2; dy <= 2 && !wet; dy++) {
        for (let dx = -2; dx <= 2; dx++) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx >= 0 && ny >= 0 && nx < w && ny < h && isWet(type[ny * w + nx])) {
            wet = true;
            break;
          }
        }
      }
      const host = (t: number) => t === ID.stone || t === ID.brick || t === ID.wood || t === ID.gravel || t === ID.cement;
      // Creeps over stone, brick and wood surfaces (in air or under water); much faster when damp.
      spreadOver(sim, i, x, y, ID.moss, wet ? 0.006 : 0.0005, (j) => host(type[j]) && (touchesAir(sim, j) || touchesWater(sim, j)));
      return false;
    },
    description: 'Überwächst Stein, Ziegel und Holz an der Luft, neben Wasser viel schneller. Verträgt keine Hitze.',
  },
  {
    key: 'algae',
    label: 'Algen',
    category: 'life',
    radiation: 'kill',
    color: ['#2e8b57', '#277a4b', '#36a066', '#206b40'],
    state: 'static',
    density: 100,
    conductivity: 0.3,
    initLife: [30, 50],
    calm: true,
    update(sim, i, x, y) {
      const { type, rng } = sim;
      let water = -1;
      let waterCount = 0;
      for (const j of sim.neighbors4(x, y)) {
        if (isWater(type[j])) {
          waterCount++;
          if (water < 0 || rng.next() < 0.5) water = j;
        }
      }
      if (waterCount === 0) {
        // Out of water it dries up.
        if (rng.next() < 0.003) sim.transform(i, ID.ash);
        sim.wake(i);
        return false;
      }
      // Grows into the water while its budget (life) lasts; offspring get one less.
      const budget = sim.life[i];
      if (budget > 0) {
        sim.wake(i);
        if (rng.next() < 0.01) {
          sim.transform(water, ID.algae);
          sim.life[water] = budget - 1;
          sim.life[i] = budget - 1;
        }
      }
      return false;
    },
    description: 'Wachsen im Wasser zu Teppichen heran, an Land trocknen sie aus. Fische fressen sie.',
  },
  {
    key: 'spider',
    label: 'Spinne',
    category: 'life',
    radiation: 'kill',
    color: ['#1c1c1c', '#262626', '#141414', '#2e2e2e'],
    state: 'static',
    density: 150,
    conductivity: 0.2,
    initLife: [80, 160],
    burn: { ignite: 120, chance: 0.5, into: 'ash', heat: 300, spread: 0 },
    update(sim, i, x, y) {
      const { w, h, type, rng } = sim;
      const solidAt = (j: number) => {
        const t = type[j];
        return t !== 0 && (P.state[t] === STATIC || t === ID.web) && t !== ID.spider;
      };
      // Holds on to anything solid around it (walls, ceilings, its web, the floor) …
      let grip = y === h - 1;
      for (let dy = -1; dy <= 1 && !grip; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx;
          const ny = y + dy;
          if ((dx || dy) && nx >= 0 && ny >= 0 && nx < w && ny < h && solidAt(ny * w + nx)) {
            grip = true;
            break;
          }
        }
      }
      // … otherwise it drops.
      if (!grip) {
        if (y + 1 < h && isAir(type[i + w])) sim.swap(i, i + w);
        return true;
      }
      if (rng.next() < 0.003 && isWater(type[sim.randomNeighbor4(x, y)] ?? 0)) {
        sim.transform(i, ID.empty, true); // drowned
        return true;
      }
      if (rng.next() > 0.3) return true;
      const j = sim.randomNeighbor8(x, y);
      if (j < 0) return true;
      const t = type[j];
      if (t === ID.ant || t === ID.worm) {
        if (rng.next() < 0.3) sim.transform(j, ID.empty, true); // caught
        return true;
      }
      if (!isAir(t)) return true;
      // Only walk where it can hold on: next to something solid.
      const jx = j % w;
      const jy = (j - jx) / w;
      let ok = false;
      for (let dy = -1; dy <= 1 && !ok; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = jx + dx;
          const ny = jy + dy;
          const k = ny * w + nx;
          if (nx >= 0 && ny >= 0 && nx < w && ny < h && k !== i && solidAt(k)) {
            ok = true;
            break;
          }
        }
      }
      // Stepping into open air only works on a thread: it leaves web behind
      // (while it has silk, kept in life), and sometimes spins anyway.
      const silk = sim.life[i];
      const spin = silk > 0 && (!ok || rng.next() < 0.1);
      if (!ok && (!spin || rng.next() > 0.3)) return true;
      sim.swap(i, j);
      if (spin) {
        sim.transform(i, ID.web);
        sim.life[j] = silk - 1;
      }
      return true;
    },
    description: 'Krabbelt an Wänden und Decken, spinnt dabei ein Netz und fängt Ameisen und Würmer.',
  },
  {
    key: 'web',
    label: 'Spinnennetz',
    category: 'hidden',
    color: ['#6e6e74', '#5e5e64', '#7e7e84', '#56565c'],
    state: 'static',
    density: 50,
    conductivity: 0.05,
    burn: { ignite: 150, chance: 0.3, into: ['fire', 'empty'], heat: 300, spread: 0.5 },
  },
];
