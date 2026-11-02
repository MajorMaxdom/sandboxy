import { P, ID } from '../elements/registry';
import { POWDER, LIQUID, GAS } from '../elements/props';
import { Rng } from './rng';
import { movePowder, moveLiquid, moveGas } from './movement';
import { temperaturePass } from './temperature';
import { electricityPass } from './electricity';
import { react, burn } from './reactions';
import { explode } from './explosion';
import { emitRadiation } from './radiation';
import { blow, GLOBAL_WIND_SCALE } from './wind';
import { airPass, AIR_WIND_SCALE } from './air';

const CHUNK_SHIFT = 4;
const CHUNK = 1 << CHUNK_SHIFT;
const CHUNK_MASK = CHUNK - 1;

/**
 * The world: a grid of cells stored as parallel typed arrays
 * (struct-of-arrays) for speed.
 */
export class Simulation {
  w = 0;
  h = 0;
  size = 0;
  type = new Uint8Array(0);
  temp = new Float32Array(0);
  life = new Uint16Array(0);
  charge = new Uint8Array(0);
  shade = new Uint8Array(0);
  clock = new Uint8Array(0);

  tick = 0;
  /** Marker for "already processed this tick"; alternates between 1 and 2. */
  parity = 1;
  ambient = 20;
  rng: Rng;

  /** Global wind from the UI slider, -5 (left) … 5 (right). */
  wind = 0;
  /** Wind blown by fans this tick (being accumulated) … */
  windX = new Float32Array(0);
  windY = new Float32Array(0);
  /** … and last tick's (being read). */
  windPrevX = new Float32Array(0);
  windPrevY = new Float32Array(0);

  /** Particle velocity in cells per tick (falling, flung by explosions). */
  vx = new Float32Array(0);
  vy = new Float32Array(0);

  /**
   * Air runs on a coarser grid (2×2 cells per air cell, aw × ah): pressure
   * per air cell plus flow through its faces (staggered grid):
   * airU[a] = flow from air cell a to a+1, airV[a] = flow from a to a+aw.
   */
  aw = 0;
  ah = 0;
  airBlocked = new Uint8Array(0);
  pres = new Float32Array(0);
  airU = new Float32Array(0);
  airV = new Float32Array(0);
  /** Skip the air simulation while everything is calm. */
  airActive = false;

  private nbuf: number[] = [];

  /**
   * Sleeping chunks: the grid is split into CHUNK×CHUNK blocks. Only blocks
   * where something happened last tick (or next to one) get cell updates.
   * `awake` is read this tick, `awakeNext` collects wake-ups for the next.
   */
  cw = 0;
  ch = 0;
  awake = new Uint8Array(0);
  awakeNext = new Uint8Array(0);
  /** Scratch for the temperature pass: chunks whose heat needs simulating. */
  thermal = new Uint8Array(0);
  /**
   * Laser light per cell (packed RGBA, 0 = none). Not matter: lasers redraw
   * their beams every tick, the renderer paints them over empty space.
   */
  beam = new Uint32Array(0);
  /** Some laser drew into `beam` since it was last cleared. */
  beamUsed = false;
  /** Global wind of the previous tick; a change wakes every chunk once. */
  private lastWind = 0;

  constructor(w: number, h: number, seed = 12345) {
    this.rng = new Rng(seed);
    this.resize(w, h);
  }

  resize(w: number, h: number): void {
    this.w = w;
    this.h = h;
    this.size = w * h;
    this.type = new Uint8Array(this.size);
    this.temp = new Float32Array(this.size).fill(this.ambient);
    this.life = new Uint16Array(this.size);
    this.charge = new Uint8Array(this.size);
    this.shade = new Uint8Array(this.size);
    this.clock = new Uint8Array(this.size);
    this.windX = new Float32Array(this.size);
    this.windY = new Float32Array(this.size);
    this.windPrevX = new Float32Array(this.size);
    this.windPrevY = new Float32Array(this.size);
    this.vx = new Float32Array(this.size);
    this.vy = new Float32Array(this.size);
    this.aw = Math.ceil(w / 2);
    this.ah = Math.ceil(h / 2);
    const airSize = this.aw * this.ah;
    this.airBlocked = new Uint8Array(airSize);
    this.pres = new Float32Array(airSize);
    this.airU = new Float32Array(airSize);
    this.airV = new Float32Array(airSize);
    this.airActive = false;
    this.cw = Math.ceil(w / CHUNK);
    this.ch = Math.ceil(h / CHUNK);
    this.awake = new Uint8Array(this.cw * this.ch);
    this.awakeNext = new Uint8Array(this.cw * this.ch);
    this.thermal = new Uint8Array(this.cw * this.ch);
    this.beam = new Uint32Array(this.size);
    this.beamUsed = false;
    this.wakeAll();
  }

  /** Process every chunk next tick (after bulk edits like loading). */
  wakeAll(): void {
    this.awakeNext.fill(1);
  }

  /** Keep the chunk of cell i (and touching chunks, at a border) awake next tick. */
  wake(i: number): void {
    const w = this.w;
    const x = i % w;
    const y = (i - x) / w;
    const cx = x >> CHUNK_SHIFT;
    const cy = y >> CHUNK_SHIFT;
    const cw = this.cw;
    const n = this.awakeNext;
    const c = cy * cw + cx;
    n[c] = 1;
    const lx = x & CHUNK_MASK;
    const ly = y & CHUNK_MASK;
    if (lx === 0 && cx > 0) n[c - 1] = 1;
    else if (lx === CHUNK_MASK && cx < cw - 1) n[c + 1] = 1;
    if (ly === 0 && cy > 0) n[c - cw] = 1;
    else if (ly === CHUNK_MASK && cy < this.ch - 1) n[c + cw] = 1;
  }

  /** Number of awake chunks this tick (for the HUD / debugging). */
  awakeCount(): number {
    let n = 0;
    for (let k = 0; k < this.awake.length; k++) n += this.awake[k];
    return n;
  }

  /**
   * Change the grid size but keep the scene: aligned to the floor and
   * centered horizontally; whatever doesn't fit is cropped.
   */
  resizeKeep(w: number, h: number): void {
    const old = { w: this.w, h: this.h, type: this.type, temp: this.temp, life: this.life, charge: this.charge, shade: this.shade };
    this.resize(w, h);
    const ox = Math.floor((w - old.w) / 2);
    const oy = h - old.h;
    for (let y = 0; y < old.h; y++) {
      const ny = y + oy;
      if (ny < 0 || ny >= h) continue;
      for (let x = 0; x < old.w; x++) {
        const nx = x + ox;
        if (nx < 0 || nx >= w) continue;
        const a = y * old.w + x;
        const b = ny * w + nx;
        this.type[b] = old.type[a];
        this.temp[b] = old.temp[a];
        this.life[b] = old.life[a];
        this.charge[b] = old.charge[a];
        this.shade[b] = old.shade[a];
      }
    }
  }

  clear(): void {
    this.type.fill(0);
    this.temp.fill(this.ambient);
    this.life.fill(0);
    this.charge.fill(0);
    this.shade.fill(0); // radiation keeps its direction (0–7) here; must not leak into empty cells
    this.clock.fill(0);
    this.vx.fill(0);
    this.vy.fill(0);
    this.pres.fill(0);
    this.airU.fill(0);
    this.airV.fill(0);
    this.airActive = false;
    this.beam.fill(0);
    this.beamUsed = false;
    this.wakeAll();
  }

  inBounds(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < this.w && y < this.h;
  }

  private initialLife(id: number): number {
    const mx = P.lifeMax[id];
    if (mx === 0) return 0;
    const mn = P.lifeMin[id];
    return mn + this.rng.int(mx - mn + 1);
  }

  /** Place a fresh particle (e.g. from the brush) with its default temperature. */
  spawn(i: number, id: number): void {
    this.type[i] = id;
    this.temp[i] = P.hasTemp[id] ? P.defaultTemp[id] : this.ambient;
    this.shade[i] = this.rng.int(4);
    this.life[i] = this.initialLife(id);
    this.charge[i] = 0;
    this.clock[i] = this.parity;
    this.vx[i] = 0;
    this.vy[i] = 0;
    this.wake(i);
  }

  /**
   * Turn a cell into another element. Keeps its temperature, except that hot
   * products (fire, steam …) are raised to at least their default temperature
   * and cold ones lowered to at most theirs — unless keepTemp is set.
   */
  transform(i: number, id: number, keepTemp = false): void {
    this.type[i] = id;
    this.shade[i] = this.rng.int(4);
    this.life[i] = this.initialLife(id);
    if (!P.conducts[id]) this.charge[i] = 0;
    this.clock[i] = this.parity;
    this.vx[i] = 0;
    this.vy[i] = 0;
    this.wake(i);
    if (!keepTemp && P.hasTemp[id]) {
      const d = P.defaultTemp[id];
      if (d > this.ambient ? d > this.temp[i] : d < this.temp[i]) this.temp[i] = d;
    }
  }

  swap(a: number, b: number): void {
    const { type, temp, life, charge, shade, clock } = this;
    let t: number;
    t = type[a]; type[a] = type[b]; type[b] = t;
    t = temp[a]; temp[a] = temp[b]; temp[b] = t;
    t = life[a]; life[a] = life[b]; life[b] = t;
    t = charge[a]; charge[a] = charge[b]; charge[b] = t;
    t = shade[a]; shade[a] = shade[b]; shade[b] = t;
    const { vx, vy } = this;
    t = vx[a]; vx[a] = vx[b]; vx[b] = t;
    t = vy[a]; vy[a] = vy[b]; vy[b] = t;
    clock[a] = this.parity;
    clock[b] = this.parity;
    this.wake(a);
    this.wake(b);
  }

  /** In-bounds orthogonal neighbours. Returns a shared buffer — don't nest calls. */
  neighbors4(x: number, y: number): number[] {
    const n = this.nbuf;
    n.length = 0;
    const i = y * this.w + x;
    if (y > 0) n.push(i - this.w);
    if (y < this.h - 1) n.push(i + this.w);
    if (x > 0) n.push(i - 1);
    if (x < this.w - 1) n.push(i + 1);
    return n;
  }

  /** A random orthogonal neighbour index, or -1 if it's out of bounds. */
  randomNeighbor4(x: number, y: number): number {
    switch (this.rng.int(4)) {
      case 0: return y > 0 ? (y - 1) * this.w + x : -1;
      case 1: return y < this.h - 1 ? (y + 1) * this.w + x : -1;
      case 2: return x > 0 ? y * this.w + x - 1 : -1;
      default: return x < this.w - 1 ? y * this.w + x + 1 : -1;
    }
  }

  /** A random one of the 8 surrounding cells, or -1 if out of bounds. */
  randomNeighbor8(x: number, y: number): number {
    let dx = 0;
    let dy = 0;
    while (dx === 0 && dy === 0) {
      dx = this.rng.int(3) - 1;
      dy = this.rng.int(3) - 1;
    }
    const nx = x + dx;
    const ny = y + dy;
    return this.inBounds(nx, ny) ? ny * this.w + nx : -1;
  }

  /** Put `id` into a random empty neighbour (upper ones preferred). Returns success. */
  spawnNearby(x: number, y: number, id: number): boolean {
    const order = this.rng.next() < 0.5 ? [-1, 0, 1] : [1, 0, -1];
    for (const dy of [-1, 0, 1]) {
      for (const dx of order) {
        if (dx === 0 && dy === 0) continue;
        const nx = x + dx;
        const ny = y + dy;
        if (!this.inBounds(nx, ny)) continue;
        const j = ny * this.w + nx;
        if (this.type[j] === 0) {
          this.transform(j, id);
          return true;
        }
      }
    }
    return false;
  }

  /** Index of the air cell covering grid cell (x, y). */
  airIndex(x: number, y: number): number {
    return (y >> 1) * this.aw + (x >> 1);
  }

  /** Air pressure at grid cell (x, y). */
  presAt(x: number, y: number): number {
    return this.pres[this.airIndex(x, y)];
  }

  /** Add air pressure around (cx, cy), e.g. from a blast. */
  addPressure(cx: number, cy: number, radius: number, amount: number): void {
    const r = Math.ceil(radius);
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        const d2 = dx * dx + dy * dy;
        if (d2 > radius * radius || !this.inBounds(cx + dx, cy + dy)) continue;
        // Each air cell covers 4 grid cells, hence / 4.
        this.pres[this.airIndex(cx + dx, cy + dy)] += (amount * (1 - Math.sqrt(d2) / (radius + 1))) / 4;
      }
    }
    this.airActive = true;
  }

  explode(x: number, y: number, radius: number): void {
    explode(this, x, y, radius);
  }

  step(): void {
    this.tick++;
    this.parity = (this.tick & 1) + 1;
    const { w, h, type, clock } = this;
    const parity = this.parity;

    // Swap chunk buffers: what was woken last tick is processed now.
    const awake = this.awakeNext;
    this.awakeNext = this.awake;
    this.awake = awake;
    this.awakeNext.fill(0);
    const cw = this.cw;
    // When the global wind changes, everything gets a look; after that only
    // particles the wind can actually push keep their chunk awake (updateCell).
    if (this.wind !== this.lastWind) {
      awake.fill(1);
      this.lastWind = this.wind;
    }

    // Lasers redraw their beams during this tick.
    if (this.beamUsed) {
      this.beam.fill(0);
      this.beamUsed = false;
    }

    // Fans write this tick's wind; particles read last tick's.
    let t = this.windPrevX; this.windPrevX = this.windX; this.windX = t;
    t = this.windPrevY; this.windPrevY = this.windY; this.windY = t;
    this.windX.fill(0);
    this.windY.fill(0);

    // Bottom-up so falling things don't get processed twice; alternate the
    // horizontal direction so nothing drifts systematically to one side.
    for (let y = h - 1; y >= 0; y--) {
      const ltr = ((y + this.tick) & 1) === 0;
      const row = y * w;
      const crow = (y >> CHUNK_SHIFT) * cw;
      // Walk the row chunk by chunk, skipping sleeping chunks as a whole.
      for (let k = 0; k < cw; k++) {
        const cx = ltr ? k : cw - 1 - k;
        if (!awake[crow + cx]) continue;
        const x0 = cx << CHUNK_SHIFT;
        const x1 = Math.min(w, x0 + CHUNK) - 1;
        for (let s = 0; s <= x1 - x0; s++) {
          const x = ltr ? x0 + s : x1 - s;
          const i = row + x;
          const id = type[i];
          if (id === 0 || clock[i] === parity) continue;
          clock[i] = parity;
          this.updateCell(i, x, y, id);
        }
      }
    }

    temperaturePass(this);
    electricityPass(this);
    if (this.airActive) airPass(this);
  }

  private updateCell(i: number, x: number, y: number, id: number): void {
    // Limited lifetime (fire, smoke, sparks …)
    if (P.decays[id]) {
      const l = this.life[i] - 1;
      if (l <= 0) {
        const into = P.decayInto[id];
        this.transform(i, into[this.rng.int(into.length)]);
        return;
      }
      this.life[i] = l;
    }

    if (this.temp[i] >= P.explIgnite[id]) {
      explode(this, x, y, P.explRadius[id]);
      return;
    }

    if (P.restless[id]) this.wake(i);

    const emit = P.emit[id];
    if (emit > 0) {
      if (this.rng.next() < emit) emitRadiation(this, x, y);
      this.temp[i] += P.decayHeat[id];
      if (this.type[i] !== id) return;
    }

    if (P.hasReactions[id]) {
      if (react(this, i, x, y, id)) return;
      if (this.canReact(i, x, y, id)) this.wake(i);
    }

    let wx = this.wind * GLOBAL_WIND_SCALE + this.windPrevX[i];
    let wy = this.windPrevY[i];
    if (this.airActive) {
      const a = this.airIndex(x, y);
      wx += (this.airU[a] + (x > 1 ? this.airU[a - 1] : 0)) * AIR_WIND_SCALE;
      wy += (this.airV[a] + (y > 1 ? this.airV[a - this.aw] : 0)) * AIR_WIND_SCALE;
    }
    if ((wx !== 0 || wy !== 0) && blow(this, i, x, y, id, wx, wy)) return;
    // Global wind: stay awake while there's room to be blown downwind.
    if (this.wind !== 0 && P.windFactor[id] > 0) {
      const nx = this.wind > 0 ? x + 1 : x - 1;
      if (nx >= 0 && nx < this.w) {
        const t = this.type[i + nx - x];
        if (t === 0 || (P.state[id] !== GAS && P.state[t] === GAS)) this.wake(i);
      }
    }

    const update = P.update[id];
    if (update && update(this, i, x, y)) return;
    if (this.type[i] !== id) return;

    if (this.temp[i] >= P.burnIgnite[id]) {
      this.wake(i);
      if (burn(this, i, x, y, id)) return;
    }

    switch (P.state[id]) {
      case POWDER:
        movePowder(this, i, x, y, id);
        break;
      case LIQUID:
        moveLiquid(this, i, x, y, id);
        break;
      case GAS:
        moveGas(this, i, x, y, id);
        break;
    }
  }

  /** Is any orthogonal neighbour a possible reaction partner? */
  private canReact(i: number, x: number, y: number, id: number): boolean {
    const { type, w } = this;
    const row = id * P.n;
    const t = P.reactTable;
    return (
      (y > 0 && t[row + type[i - w]] >= 0) ||
      (y < this.h - 1 && t[row + type[i + w]] >= 0) ||
      (x > 0 && t[row + type[i - 1]] >= 0) ||
      (x < w - 1 && t[row + type[i + 1]] >= 0)
    );
  }

  countParticles(): number {
    let n = 0;
    const t = this.type;
    for (let i = 0; i < t.length; i++) if (t[i] !== 0) n++;
    return n;
  }
}

export { ID };
