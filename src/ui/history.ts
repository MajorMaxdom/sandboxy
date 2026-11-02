import type { Simulation } from '../sim/simulation';

interface Snapshot {
  w: number;
  h: number;
  type: Uint8Array;
  temp: Float32Array;
  life: Uint16Array;
  shade: Uint8Array;
}

/** Budget for stored snapshots, so big worlds don't eat all memory. */
const MAX_BYTES = 48 * 1024 * 1024;

/**
 * Undo / redo by snapshotting the world before each edit (stroke, shape,
 * fill, clear, load). The simulation keeps running in between; undo jumps
 * back to the state right before the edit.
 */
export class History {
  private undoStack: Snapshot[] = [];
  private redoStack: Snapshot[] = [];

  constructor(private sim: Simulation, private onResize: () => void) {}

  private take(): Snapshot {
    const s = this.sim;
    return { w: s.w, h: s.h, type: s.type.slice(), temp: s.temp.slice(), life: s.life.slice(), shade: s.shade.slice() };
  }

  private restore(snap: Snapshot): void {
    const s = this.sim;
    if (s.w !== snap.w || s.h !== snap.h) {
      s.resize(snap.w, snap.h);
      this.onResize();
    }
    s.clear();
    s.type.set(snap.type);
    s.temp.set(snap.temp);
    s.life.set(snap.life);
    s.shade.set(snap.shade);
    s.wakeAll();
  }

  private limit(): void {
    const bytes = this.sim.size * 8; // per snapshot, roughly
    const max = Math.max(3, Math.floor(MAX_BYTES / bytes));
    while (this.undoStack.length > max) this.undoStack.shift();
  }

  /** Call right before changing the world. */
  record(): void {
    this.undoStack.push(this.take());
    this.redoStack = [];
    this.limit();
  }

  undo(): boolean {
    const snap = this.undoStack.pop();
    if (!snap) return false;
    this.redoStack.push(this.take());
    this.restore(snap);
    return true;
  }

  redo(): boolean {
    const snap = this.redoStack.pop();
    if (!snap) return false;
    this.undoStack.push(this.take());
    this.restore(snap);
    return true;
  }

  get canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  get canRedo(): boolean {
    return this.redoStack.length > 0;
  }
}
