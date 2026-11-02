import { P, ID } from '../elements/registry';
import { POWDER, LIQUID } from '../elements/props';
import type { Simulation } from './simulation';

/**
 * Blast at (cx, cy): destroys most things within `radius`, sets nearby
 * explosives off (chain reactions), heats a wider ring and flings loose
 * particles outward.
 */
export function explode(sim: Simulation, cx: number, cy: number, radius: number): void {
  const { w, type, temp, rng } = sim;
  const center = cy * w + cx;
  sim.transform(center, ID.fire);
  temp[center] = Math.max(temp[center], 2000);

  sim.addPressure(cx, cy, radius * 1.2, 4 + radius * 0.5);
  const outer = radius * 1.7;
  const reach = Math.ceil(outer);
  const r2 = outer * outer;

  for (let dy = -reach; dy <= reach; dy++) {
    for (let dx = -reach; dx <= reach; dx++) {
      const d2 = dx * dx + dy * dy;
      if (d2 > r2 || d2 === 0) continue;
      const x = cx + dx;
      const y = cy + dy;
      if (!sim.inBounds(x, y)) continue;
      const j = y * w + x;
      const t = type[j];
      if (P.indestructible[t]) continue;
      const d = Math.sqrt(d2);

      if (d <= radius) {
        const falloff = 1 - d / radius;
        if (P.explIgnite[t] !== Infinity) {
          // Neighbouring explosives go off on their own next tick.
          temp[j] = Math.max(temp[j], P.explIgnite[t] + 100);
          continue;
        }
        if (t === 0 || rng.next() < 0.4 + falloff * 0.6) {
          const r = rng.next();
          sim.transform(j, r < 0.35 ? ID.fire : r < 0.45 ? ID.smoke : ID.empty);
        } else if (P.state[t] === POWDER || P.state[t] === LIQUID) {
          // Survivors near the core get thrown hard.
          const speed = 4 + rng.next() * 4;
          sim.vx[j] = (dx / d) * speed;
          sim.vy[j] = (dy / d) * speed * 0.4 - speed * 0.7; // blasts throw things up
        }
        temp[j] = Math.max(temp[j], 500 + 1500 * falloff);
      } else {
        const falloff = 1 - (d - radius) / (outer - radius);
        // Capped like the core, so chain reactions don't stack up the heat.
        if (temp[j] < 2000) temp[j] = Math.min(2000, temp[j] + 300 * falloff);
        const st = P.state[t];
        if (st === POWDER || st === LIQUID) {
          // Fling debris outward (and a bit upward); it flies ballistically.
          const speed = (2 + rng.next() * 4) * (0.4 + falloff);
          sim.vx[j] = (dx / d) * speed;
          sim.vy[j] = (dy / d) * speed * 0.4 - speed * 0.7; // blasts throw things up
          sim.wake(j);
        }
      }
    }
  }
}
