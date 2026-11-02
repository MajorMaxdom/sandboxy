import { ID } from '../elements/registry';
import { paintLine, paintRect, type BrushOptions } from '../sim/brush';
import type { Simulation } from '../sim/simulation';

const SOLID: BrushOptions = { radius: 0, replace: true, solid: true };

/** Paints in fractions of the world size (0..1) or absolute cells. */
class Painter {
  constructor(public sim: Simulation) {}
  X = (f: number) => Math.round(f * (this.sim.w - 1));
  Y = (f: number) => Math.round(f * (this.sim.h - 1));

  /** Filled rectangle, fractional coordinates. */
  rect(key: string, x0: number, y0: number, x1: number, y1: number): void {
    this.cells(key, this.X(x0), this.Y(y0), this.X(x1), this.Y(y1));
  }
  /** Filled rectangle, cell coordinates. */
  cells(key: string, x0: number, y0: number, x1: number, y1: number): void {
    paintRect(this.sim, x0, y0, x1, y1, { kind: 'element', id: ID[key] }, SOLID);
  }
  /** Line with thickness radius r (cells), fractional coordinates. */
  line(key: string, x0: number, y0: number, x1: number, y1: number, r = 0): void {
    paintLine(this.sim, this.X(x0), this.Y(y0), this.X(x1), this.Y(y1), { kind: 'element', id: ID[key] }, { ...SOLID, radius: r });
  }
  /** Sprinkle `count` particles into cells of `into` (default: empty) in a fractional area. */
  sprinkle(key: string, x0: number, y0: number, x1: number, y1: number, count: number, into = 'empty'): void {
    const { sim } = this;
    for (let n = 0; n < count; n++) {
      const x = this.X(x0 + (x1 - x0) * sim.rng.next());
      const y = this.Y(y0 + (y1 - y0) * sim.rng.next());
      const i = y * sim.w + x;
      if (sim.type[i] === ID[into]) sim.spawn(i, ID[key]);
    }
  }
  /** Heat a cell (fractional coordinates), e.g. to light a fuse. */
  heat(fx: number, fy: number, temp: number): void {
    this.heatCell(this.X(fx), this.Y(fy), temp);
  }
  heatCell(x: number, y: number, temp: number): void {
    const i = y * this.sim.w + x;
    this.sim.temp[i] = temp;
    this.sim.wake(i);
  }
  floor(key = 'wall'): void {
    this.cells(key, 0, this.sim.h - 2, this.sim.w - 1, this.sim.h - 1);
  }
}

export interface Demo {
  key: string;
  label: string;
  description: string;
  /** Builds the scene into a cleared world; returns the wind to set. */
  build(sim: Simulation): { wind: number };
}

export const DEMOS: Demo[] = [
  {
    key: 'volcano',
    label: 'Vulkan',
    description: 'Ein Vulkan mit Magmakammer, See und Wald.',
    build(sim) {
      const p = new Painter(sim);
      p.floor();
      const { w, h } = sim;
      const cx = Math.round(w * 0.5);
      const top = Math.round(h * 0.42);
      for (let y = top; y < h - 2; y++) {
        const half = Math.round((y - top) * 1.1) + 3;
        p.cells('stone', cx - half, y, cx + half, y);
      }
      // Magma chamber, kept hot by heaters, with a vent up to the crater.
      p.cells('lava', cx - 12, h - 22, cx + 12, h - 8);
      p.cells('heater', cx - 12, h - 7, cx + 12, h - 6);
      p.cells('lava', cx - 1, top - 2, cx + 1, h - 22);
      // A hidden lava source in the crater keeps the eruption going.
      p.cells('clone', cx, top - 2, cx, top - 2);
      p.cells('lava', cx, top - 3, cx, top - 3);
      // Lake on the left, forest on the right.
      p.rect('water', 0.02, 0.8, 0.2, 0.97);
      p.rect('dirt', 0.8, 0.9, 0.99, 0.97);
      p.sprinkle('seed', 0.8, 0.8, 0.99, 0.88, 40);
      p.rect('cloud', 0.05, 0.08, 0.25, 0.12);
      return { wind: 0 };
    },
  },
  {
    key: 'reactor',
    label: 'Kernreaktor',
    description: 'Uranstäbe kochen Wasser, die Dampfturbine erzeugt Strom für die Lampen. Bleiwand schirmt ab.',
    build(sim) {
      const p = new Painter(sim);
      p.floor();
      // Tank
      p.rect('glass', 0.3, 0.4, 0.31, 0.97);
      p.rect('glass', 0.59, 0.4, 0.6, 0.97);
      p.rect('water', 0.315, 0.55, 0.585, 0.97);
      // Fuel rods alternating with control rods, standing in the water
      for (let k = 0; k < 6; k++) {
        const x = 0.33 + k * 0.042;
        p.rect(k % 3 === 2 ? 'control rod' : 'uranium', x, 0.72, x + 0.022, 0.97);
      }
      // Steam turbine lid, wire to lamps
      p.rect('steam turbine', 0.3, 0.38, 0.6, 0.4);
      p.line('copper', 0.45, 0.39, 0.45, 0.25); // starts inside the turbine so they touch
      p.line('copper', 0.45, 0.25, 0.8, 0.25);
      for (let k = 0; k < 4; k++) p.rect('lamp', 0.66 + k * 0.04, 0.22, 0.68 + k * 0.04, 0.25); // sits on the wire
      // Lead shield and a Geiger counter behind it
      p.rect('lead', 0.66, 0.45, 0.68, 0.97);
      p.rect('geiger', 0.75, 0.6, 0.76, 0.97);
      p.rect('geiger', 0.2, 0.6, 0.21, 0.97);
      return { wind: 0 };
    },
  },
  {
    key: 'windfarm',
    label: 'Windpark',
    description: 'Windräder auf Masten speisen Lampen am Boden. Wolken regnen auf die Wiese.',
    build(sim) {
      const p = new Painter(sim);
      p.floor();
      p.rect('dirt', 0, 0.92, 1, 0.97);
      for (let k = 0; k < 4; k++) {
        const x = 0.15 + k * 0.22;
        p.rect('wind turbine', x - 0.02, 0.35, x + 0.02, 0.45); // rotor
        p.line('metal', x, 0.46, x, 0.91); // mast doubles as cable
        p.line('copper', x, 0.91, x + 0.08, 0.91);
        p.rect('lamp', x + 0.085, 0.88, x + 0.1, 0.91);
      }
      p.sprinkle('seed', 0, 0.85, 1, 0.9, 80);
      p.rect('cloud', 0.1, 0.06, 0.35, 0.1);
      p.rect('cloud', 0.6, 0.1, 0.85, 0.14);
      return { wind: 3 };
    },
  },
  {
    key: 'fireworks',
    label: 'Feuerwerk',
    description: 'Eine Zündschnur brennt nacheinander mehrere Feuerwerksbatterien ab.',
    build(sim) {
      const p = new Painter(sim);
      p.floor();
      const fuseY = 0.8;
      p.line('fuse', 0.05, fuseY, 0.95, fuseY);
      for (let k = 0; k < 5; k++) {
        const x = 0.15 + k * 0.17;
        p.rect('firework', x - 0.03, 0.94, x + 0.03, 0.97);
        p.line('fuse', x, fuseY, x, 0.97); // right into the pile, so it can't lose contact
      }
      p.heat(0.05, fuseY, 400); // light the fuse
      return { wind: 0 };
    },
  },
  {
    key: 'aquarium',
    label: 'Aquarium',
    description: 'Fische schwimmen zwischen Wasserpflanzen.',
    build(sim) {
      const p = new Painter(sim);
      p.floor();
      p.rect('glass', 0.15, 0.3, 0.16, 0.97);
      p.rect('glass', 0.84, 0.3, 0.85, 0.97);
      p.rect('sand', 0.16, 0.9, 0.84, 0.97);
      p.rect('water', 0.16, 0.4, 0.84, 0.89);
      for (let k = 0; k < 9; k++) {
        const x = 0.2 + k * 0.075;
        p.line('plant', x, 0.89, x, 0.89 - 0.05 - 0.1 * sim.rng.next());
      }
      p.sprinkle('fish', 0.18, 0.45, 0.82, 0.85, 40, 'water');
      return { wind: 0 };
    },
  },
  {
    key: 'logic',
    label: 'Schaltungen',
    description: 'Lauflicht aus Taktgeber und Verzögerern, ein NICHT-Gatter und ein schaltbares Gebläse.',
    build(sim) {
      const p = new Painter(sim);
      p.floor();
      const x0 = Math.max(4, Math.round(sim.w * 0.12));
      const y0 = Math.round(sim.h * 0.2);
      const g = Math.max(3, Math.round(sim.w / 40)); // spacing scales with the world
      const lamp = (x: number, y: number) => p.cells('lamp', x, y - 2, x + 2, y + 2);
      const wire = (xa: number, xb: number, y: number) => p.cells('copper', xa, y, xb, y);
      // 1) Running light: clock → lamp → delay → lamp → delay → lamp
      let x = x0;
      p.cells('clock', x, y0, x, y0);
      wire(x + 1, x + g, y0);
      x += g + 1;
      lamp(x, y0);
      for (let k = 0; k < 2; k++) {
        x += 3;
        wire(x, x + g, y0);
        x += g + 1;
        p.cells('delay', x, y0, x, y0);
        wire(x + 1, x + g, y0);
        x += g + 1;
        lamp(x, y0);
      }
      // 2) NOT gate: its lamp lights while the clock is quiet
      const y1 = y0 + 12;
      p.cells('clock', x0, y1, x0, y1);
      wire(x0 + 1, x0 + g, y1);
      lamp(x0 + g + 1, y1);
      wire(x0 + g + 4, x0 + 2 * g + 4, y1);
      p.cells('not gate', x0 + 2 * g + 5, y1, x0 + 2 * g + 5, y1);
      wire(x0 + 2 * g + 6, x0 + 3 * g + 6, y1);
      lamp(x0 + 3 * g + 7, y1);
      // 3) Battery → switch → fan blowing an ash pile (use "Schalter umlegen")
      const y2 = y0 + 26;
      p.cells('wall', x0 + 6, y2 + 1, x0 + 15 * g, y2 + 1);
      p.cells('battery', x0, y2, x0, y2);
      p.cells('switch', x0 + 1, y2, x0 + 3, y2);
      wire(x0 + 4, x0 + 5, y2);
      p.cells('fan right', x0 + 6, y2 - 3, x0 + 6, y2);
      p.cells('ash', x0 + 10, y2 - 4, x0 + 20, y2);
      return { wind: 0 };
    },
  },
  {
    key: 'oilspill',
    label: 'Ölpest',
    description: 'Bakterien fressen einen Ölteppich auf, Vögel kreisen darüber.',
    build(sim) {
      const p = new Painter(sim);
      p.floor('stone');
      p.rect('stone', 0, 0.6, 0.05, 0.97);
      p.rect('stone', 0.95, 0.6, 1, 0.97);
      p.rect('water', 0.05, 0.7, 0.95, 0.97);
      p.rect('oil', 0.25, 0.66, 0.75, 0.69);
      p.sprinkle('bacteria', 0.25, 0.6, 0.35, 0.65, 60);
      p.sprinkle('bird', 0.1, 0.15, 0.9, 0.4, 20);
      return { wind: 0 };
    },
  },
  {
    key: 'airflow',
    label: 'Lüftung & Druck',
    description: 'Ein Gebläse pumpt Rauch durch eine verwinkelte Röhre. Rechts zündet C-4 in einem Tunnel mit Sand. Tipp: Ansicht „Druck“.',
    build(sim) {
      const p = new Painter(sim);
      p.floor();
      // Winding pipe: walls with a 4-cell channel
      const { w, h } = sim;
      const x0 = Math.round(w * 0.05);
      const x1 = Math.round(w * 0.45);
      const yA = Math.round(h * 0.75);
      const yB = Math.round(h * 0.35);
      const t = 4;
      // lower horizontal leg
      p.cells('wall', x0, yA - t - 1, x1, yA - t - 1);
      p.cells('wall', x0, yA, x1 + t + 1, yA);
      // vertical leg
      p.cells('wall', x1, yB, x1, yA - t - 1);
      p.cells('wall', x1 + t + 1, yB - t - 1, x1 + t + 1, yA);
      // upper horizontal leg, open at the left end
      p.cells('wall', x0, yB - t - 1, x1 + t + 1, yB - t - 1);
      p.cells('wall', x0, yB, x1, yB);
      // fan at the closed lower-left end, smoke inside
      p.cells('wall', x0 - 1, yA - t - 1, x0 - 1, yA);
      p.cells('fan right', x0, yA - t, x0, yA - 1);
      p.cells('smoke', x0 + 3, yA - t, x0 + 20, yA - 1);
      // Tunnel with sand and a C-4 charge
      const tx0 = Math.round(w * 0.6);
      const tx1 = Math.round(w * 0.95);
      const ty = Math.round(h * 0.6);
      p.cells('stone', tx0, ty - 12, tx1, ty - 8);
      p.cells('stone', tx0, ty, tx1, h - 3);
      p.cells('sand', tx0 + 10, ty - 7, tx1 - 2, ty - 1);
      p.cells('c4', tx0 + 2, ty - 6, tx0 + 4, ty - 2);
      p.cells('fuse', tx0 + 3, ty - 12, tx0 + 3, ty - 7);
      p.cells('fuse', tx0 + 3, ty - 20, tx0 + 3, ty - 13);
      p.heatCell(tx0 + 3, ty - 20, 400); // light the fuse
      return { wind: 0 };
    },
  },
];
