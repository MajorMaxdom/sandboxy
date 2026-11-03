import { ID } from '../elements/ids';
import { P, GAS, STATIC, AIR_DENSITY } from '../elements/props';
import type { Simulation } from './simulation';

/** Global wind slider value (-5..5) → wind strength. */
export const GLOBAL_WIND_SCALE = 0.3;

/** Fan strength 1–10 (`life`, 0 = default); 5 matches the old fixed fan. */
const FAN_DEFAULT_LEVEL = 5;
/** Per level: how far a fan blows (cells) … */
const FAN_REACH_BASE = 15;
const FAN_REACH_PER_LEVEL = 5;
/** … its wind at the blades … */
const FAN_WIND_PER_LEVEL = 0.5;
/** … and the air pressure it adds in front of itself (and removes behind). */
const FAN_PRESSURE_PER_LEVEL = 0.08;

/** Wind strength at cell i: global wind plus what fans blew there last tick. */
export function windAt(sim: Simulation, i: number): [number, number] {
  return [sim.wind * GLOBAL_WIND_SCALE + sim.windPrevX[i], sim.windPrevY[i]];
}

/**
 * Let the wind push a particle one cell. Light things (gases, ash, snow)
 * move readily, heavy ones hardly at all. Returns true if it moved.
 */
export function blow(sim: Simulation, i: number, x: number, y: number, id: number, wx: number, wy: number): boolean {
  const f = P.windFactor[id];
  if (f === 0) return false;
  const ax = Math.abs(wx);
  const ay = Math.abs(wy);
  const rng = sim.rng;
  // A strong updraft keeps light things floating instead of letting them fall.
  const floating = wy < 0 && -wy * f > 0.4;
  const push = (ax + ay) * f;
  if (rng.next() >= Math.min(0.95, push * 0.5)) return floating;
  let dx = 0;
  let dy = 0;
  if (rng.next() * (ax + ay) < ax) dx = wx > 0 ? 1 : -1;
  else dy = wy > 0 ? 1 : -1;
  // Strong wind carries light things more than one cell per tick.
  const steps = push > 6 ? 3 : push > 3 ? 2 : 1;
  let cur = i;
  let cx = x;
  let cy = y;
  for (let s = 0; s < steps; s++) {
    let j = windTarget(sim, id, cx + dx, cy + dy);
    if (j < 0 && s === 0 && P.state[id] === GAS) {
      // Blocked gas slides along the obstacle instead of piling up against it,
      // so gas blown into a wall or corner spreads out and escapes.
      // Against a side wall, gas mostly slides the way its buoyancy takes it
      // (smoke climbs the wall and leaves the jet); otherwise either way.
      let side = rng.next() < 0.5 ? 1 : -1;
      if (dx !== 0 && rng.next() < 0.8) side = (P.density[id] < AIR_DENSITY ? -1 : 1) * dx;
      j = windTarget(sim, id, cx + dy * side, cy + dx * side);
      if (j < 0) j = windTarget(sim, id, cx - dy * side, cy - dx * side);
    }
    if (j < 0) break;
    sim.swap(cur, j);
    cur = j;
    cx = j % sim.w;
    cy = (j - cx) / sim.w;
  }
  return cur !== i || floating;
}

/** Cell (x, y) if the wind can push particle `id` into it, else -1. */
function windTarget(sim: Simulation, id: number, x: number, y: number): number {
  if (!sim.inBounds(x, y)) return -1;
  const j = y * sim.w + x;
  const t = sim.type[j];
  return t === 0 || (P.state[id] !== GAS && P.state[t] === GAS) ? j : -1;
}

/**
 * A fan blows a straight beam of wind. Solid walls stop it, loose material
 * weakens it, wind turbines let it through (that's how they get spun).
 */
export function fanUpdate(dx: number, dy: number) {
  return (sim: Simulation, i: number, x: number, y: number): boolean => {
    const { w, type, windX, windY } = sim;
    const level = Math.min(10, sim.life[i] || FAN_DEFAULT_LEVEL);
    const reach = FAN_REACH_BASE + FAN_REACH_PER_LEVEL * level;
    const pressure = FAN_PRESSURE_PER_LEVEL * level;
    // Push air: overpressure in front, suction behind → currents follow pipes.
    // (two cells away: the fan's own air cell counts as solid)
    const fx = x + 2 * dx;
    const fy = y + 2 * dy;
    const bx = x - 2 * dx;
    const by = y - 2 * dy;
    if (sim.inBounds(fx, fy)) sim.pres[sim.airIndex(fx, fy)] += pressure;
    if (sim.inBounds(bx, by)) sim.pres[sim.airIndex(bx, by)] -= pressure;
    sim.airActive = true;
    let s = FAN_WIND_PER_LEVEL * level;
    let cx = x;
    let cy = y;
    for (let k = 0; k < reach; k++) {
      cx += dx;
      cy += dy;
      if (!sim.inBounds(cx, cy)) break;
      const j = cy * w + cx;
      const t = type[j];
      if (t !== 0) {
        const st = P.state[t];
        if (st === STATIC && t !== ID['wind turbine'] && P.windFactor[t] === 0) break;
        if (st !== GAS) s *= t === ID['wind turbine'] ? 0.8 : 0.93;
        sim.wake(j);
      }
      const f = s * (1 - k / reach);
      windX[j] += dx * f;
      windY[j] += dy * f;
    }
    return false;
  };
}
