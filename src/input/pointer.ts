export interface GridPoint {
  x: number;
  y: number;
}

/**
 * Unified mouse / pen / touch input for the canvas via Pointer Events.
 * Tracks one active pointer and queues every position it passes through, so
 * the game loop can paint the exact stroke (including where it started) even
 * when several pointer events arrive between two frames.
 */
export class PointerInput {
  /** A pointer is currently pressed. */
  down = false;
  /** Right mouse button → erase. */
  erase = false;
  /** Middle button or Alt+click → pipette. */
  pickClick = false;
  /** Grid position under the cursor, for the hover info; null when outside. */
  hover: GridPoint | null = null;

  private activeId: number | null = null;
  private queue: GridPoint[] = [];
  private last: GridPoint | null = null;

  constructor(
    private canvas: HTMLCanvasElement,
    private gridSize: () => { w: number; h: number },
  ) {
    canvas.addEventListener('pointerdown', this.onDown);
    canvas.addEventListener('pointermove', this.onMove);
    canvas.addEventListener('pointerup', this.onUp);
    canvas.addEventListener('pointercancel', this.onUp);
    canvas.addEventListener('pointerleave', () => {
      if (!this.down) this.hover = null;
    });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  private toGrid(e: { clientX: number; clientY: number }): GridPoint {
    const rect = this.canvas.getBoundingClientRect();
    const { w, h } = this.gridSize();
    return {
      x: Math.floor(((e.clientX - rect.left) / rect.width) * w),
      y: Math.floor(((e.clientY - rect.top) / rect.height) * h),
    };
  }

  private onDown = (e: PointerEvent): void => {
    if (this.activeId !== null) return;
    e.preventDefault();
    this.activeId = e.pointerId;
    this.canvas.setPointerCapture(e.pointerId);
    this.down = true;
    this.erase = e.button === 2;
    this.pickClick = e.button === 1 || e.altKey;
    const p = this.toGrid(e);
    this.last = null;
    this.queue = [p];
    this.hover = p;
  };

  private onMove = (e: PointerEvent): void => {
    this.hover = this.toGrid(e);
    if (e.pointerId !== this.activeId) return;
    const events = typeof e.getCoalescedEvents === 'function' ? e.getCoalescedEvents() : [];
    for (const ev of events.length ? events : [e]) this.queue.push(this.toGrid(ev));
  };

  private onUp = (e: PointerEvent): void => {
    if (e.pointerId !== this.activeId) return;
    this.queue.push(this.toGrid(e));
    this.activeId = null;
    this.down = false;
    if (e.pointerType !== 'mouse') this.hover = null;
  };

  /** True while drawing, or when a finished stroke still has unpainted points. */
  get painting(): boolean {
    return this.down || this.queue.length > 0;
  }

  /**
   * Polyline to paint this frame: from the last painted point through all
   * queued ones. While the pointer is held still it returns that point again,
   * so the brush keeps pouring.
   */
  takeStroke(): GridPoint[] {
    const pts = this.last ? [this.last, ...this.queue] : [...this.queue];
    this.queue = [];
    if (pts.length === 0) return pts;
    this.last = this.down ? pts[pts.length - 1] : null;
    return pts;
  }
}
