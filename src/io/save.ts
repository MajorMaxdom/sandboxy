import { ELEMENTS, ID } from '../elements/registry';
import type { Simulation } from '../sim/simulation';

/**
 * Scene file format (JSON):
 *   { app: 'sandboxy', v: 1, w, h, names: [id → element key], data: base64 }
 * where data = gzip(type bytes ‖ temperature as Int16 ‖ life as Uint16).
 * Element names are stored so saves survive reordering of the element list.
 */
export interface SceneFile {
  app: 'sandboxy';
  v: 1;
  w: number;
  h: number;
  names: string[];
  data: string;
}

const STORAGE_KEY = 'sandboxy.saves';

export async function gzip(bytes: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([bytes as BlobPart]).stream().pipeThrough(new CompressionStream('gzip'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

export async function gunzip(bytes: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([bytes as BlobPart]).stream().pipeThrough(new DecompressionStream('gzip'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

export function toBase64(bytes: Uint8Array): string {
  let s = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    s += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(s);
}

export function fromBase64(b64: string): Uint8Array {
  const s = atob(b64);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

export async function serialize(sim: Simulation): Promise<SceneFile> {
  const n = sim.size;
  const raw = new Uint8Array(n * 5);
  raw.set(sim.type, 0);
  const temps = new Int16Array(n);
  for (let i = 0; i < n; i++) temps[i] = Math.max(-32768, Math.min(32767, Math.round(sim.temp[i])));
  raw.set(new Uint8Array(temps.buffer), n);
  raw.set(new Uint8Array(sim.life.slice().buffer), n * 3);
  return {
    app: 'sandboxy',
    v: 1,
    w: sim.w,
    h: sim.h,
    names: ELEMENTS.map((e) => e.key),
    data: toBase64(await gzip(raw)),
  };
}

/** Load a scene into the simulation (resizing it if needed). */
export async function deserialize(sim: Simulation, file: SceneFile): Promise<void> {
  if (file?.app !== 'sandboxy' || file.v !== 1) throw new Error('Keine gültige Sandboxy-Datei.');
  const { w, h } = file;
  if (!(w > 0 && h > 0 && w * h <= 4_000_000)) throw new Error('Ungültige Rastergröße.');
  const n = w * h;
  const raw = await gunzip(fromBase64(file.data));
  if (raw.length !== n * 5) throw new Error('Beschädigte Szenendaten.');

  const remap = file.names.map((key) => ID[key] ?? 0);
  if (sim.w !== w || sim.h !== h) sim.resize(w, h);
  sim.clear();

  const temps = new Int16Array(raw.buffer.slice(n, n * 3));
  const lifes = new Uint16Array(raw.buffer.slice(n * 3, n * 5));
  for (let i = 0; i < n; i++) {
    sim.type[i] = remap[raw[i]] ?? 0;
    sim.temp[i] = temps[i];
    sim.life[i] = lifes[i];
    sim.shade[i] = sim.rng.int(4);
  }
  // Clone cells store an element id in `life`; remap those too.
  const clone = ID.clone;
  for (let i = 0; i < n; i++) {
    if (sim.type[i] === clone && sim.life[i] !== 0) sim.life[i] = remap[sim.life[i]] ?? 0;
  }
  sim.wakeAll();
}

// ---- localStorage slots -------------------------------------------------

export interface SlotInfo {
  name: string;
  date: number;
}

type SlotMap = Record<string, { date: number; scene: SceneFile }>;

function readSlots(): SlotMap {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as SlotMap) : {};
  } catch {
    return {};
  }
}

function writeSlots(slots: SlotMap): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(slots));
}

export function listSlots(): SlotInfo[] {
  return Object.entries(readSlots())
    .map(([name, s]) => ({ name, date: s.date }))
    .sort((a, b) => b.date - a.date);
}

export function saveSlot(name: string, scene: SceneFile): void {
  const slots = readSlots();
  slots[name] = { date: Date.now(), scene };
  writeSlots(slots); // may throw QuotaExceededError — caller reports it
}

export function loadSlot(name: string): SceneFile | null {
  return readSlots()[name]?.scene ?? null;
}

export function deleteSlot(name: string): void {
  const slots = readSlots();
  delete slots[name];
  try {
    writeSlots(slots);
  } catch {
    /* ignore */
  }
}
