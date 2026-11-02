import { ID } from '../elements/ids';
import { P, GAS, STATIC } from '../elements/props';
import type { Simulation } from './simulation';

/** Global wind slider value (-5..5) → wind strength. */
export const GLOBAL_WIND_SCALE = 0.3;

/** How far a fan blows, in cells. */
const FAN_REACH = 40;
/** Pressure a fan adds in front of itself (and removes behind) per tick. */
const FAN_PRESSURE = 0.4;

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
  if (rng.next() >= Math.min(0.95, (ax + ay) * f * 0.5)) return floating;
  let dx = 0;
  let dy = 0;
  if (rng.next() * (ax + ay) < ax) dx = wx > 0 ? 1 : -1;
  else dy = wy > 0 ? 1 : -1;
  const nx = x + dx;
  const ny = y + dy;
  if (!sim.inBounds(nx, ny)) return false;
  const j = ny * sim.w + nx;
  const t = sim.type[j];
  if (t === 0 || (P.state[id] !== GAS && P.state[t] === GAS)) {
    sim.swap(i, j);
    return true;
  }
  return floating;
}

/**
 * A fan blows a straight beam of wind. Solid walls stop it, loose material
 * weakens it, wind turbines let it through (that's how they get spun).
 */
export function fanUpdate(dx: number, dy: number) {
  return (sim: Simulation, _i: number, x: number, y: number): boolean => {
    const { w, type, windX, windY } = sim;
    // Push air: overpressure in front, suction behind → currents follow pipes.
    // (two cells away: the fan's own air cell counts as solid)
    const fx = x + 2 * dx;
    const fy = y + 2 * dy;
    const bx = x - 2 * dx;
    const by = y - 2 * dy;
    if (sim.inBounds(fx, fy)) sim.pres[sim.airIndex(fx, fy)] += FAN_PRESSURE;
    if (sim.inBounds(bx, by)) sim.pres[sim.airIndex(bx, by)] -= FAN_PRESSURE;
    sim.airActive = true;
    let s = 2.5;
    let cx = x;
    let cy = y;
    for (let k = 0; k < FAN_REACH; k++) {
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
      const f = s * (1 - k / FAN_REACH);
      windX[j] += dx * f;
      windY[j] += dy * f;
    }
    return false;
  };
}
