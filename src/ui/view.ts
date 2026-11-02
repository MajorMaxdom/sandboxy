/**
 * Zoom and pan of the canvas, purely visual: the grid keeps its size, the
 * canvas is scaled with a CSS transform. Pointer → grid mapping keeps working
 * because getBoundingClientRect() includes the transform.
 *
 * Mouse wheel zooms towards the cursor, Shift+wheel changes the brush size,
 * the middle mouse button drags the view, two fingers pinch-zoom and pan.
 */

const MAX_ZOOM = 16;
/** Wheel distance (px) per brush size step with Shift. */
const BRUSH_STEP = 100;

export interface ViewHooks {
  /** Shift+wheel: change the brush size by ±1. */
  brushStep: (dir: 1 | -1) => void;
  /** Two fingers went down: stop painting with the first one. */
  cancelPaint: () => void;
}

export class View {
  zoom = 1;
  private tx = 0;
  private ty = 0;
  private brushAcc = 0;
  private panning: { id: number; x: number; y: number } | null = null;
  private touches = new Map<number, { x: number; y: number }>();
  private pinch: { dist: number; mx: number; my: number } | null = null;

  constructor(
    private canvas: HTMLCanvasElement,
    private stage: HTMLElement,
    private hooks: ViewHooks,
  ) {
    canvas.style.transformOrigin = '0 0';
    stage.addEventListener('wheel', this.onWheel, { passive: false });
    canvas.addEventListener('pointerdown', this.onDown);
    canvas.addEventListener('pointermove', this.onMove);
    canvas.addEventListener('pointerup', this.onUp);
    canvas.addEventListener('pointercancel', this.onUp);
    // Middle click would otherwise start autoscroll in some browsers.
    canvas.addEventListener('mousedown', (e) => {
      if (e.button === 1) e.preventDefault();
    });
  }

  reset(): void {
    this.zoom = 1;
    this.tx = 0;
    this.ty = 0;
    this.apply();
  }

  /** Keep the view valid after the canvas or window changed size. */
  refit(): void {
    this.clamp();
    this.apply();
  }

  /** Zoom by `factor`, keeping the point under (clientX, clientY) in place. */
  zoomAt(clientX: number, clientY: number, factor: number): void {
    const z2 = Math.max(1, Math.min(MAX_ZOOM, this.zoom * factor));
    if (z2 === this.zoom) return;
    const r = this.canvas.getBoundingClientRect();
    // Untransformed position of the canvas, and the cursor in canvas units.
    const left = r.left - this.tx;
    const top = r.top - this.ty;
    const u = (clientX - r.left) / this.zoom;
    const v = (clientY - r.top) / this.zoom;
    this.zoom = z2;
    this.tx = clientX - u * z2 - left;
    this.ty = clientY - v * z2 - top;
    this.clamp();
    this.apply();
  }

  panBy(dx: number, dy: number): void {
    if (this.zoom === 1) return;
    this.tx += dx;
    this.ty += dy;
    this.clamp();
    this.apply();
  }

  /**
   * The zoomed canvas may move around inside the stage, but never leave
   * empty space where it could fill the stage.
   */
  private clamp(): void {
    if (this.zoom <= 1) {
      this.zoom = 1;
      this.tx = 0;
      this.ty = 0;
      return;
    }
    const r = this.canvas.getBoundingClientRect();
    const s = this.stage.getBoundingClientRect();
    const left = r.left - this.tx;
    const top = r.top - this.ty;
    const w = this.canvas.offsetWidth * this.zoom;
    const h = this.canvas.offsetHeight * this.zoom;
    const fit = (pos: number, size: number, s0: number, s1: number) => {
      const a = s1 - size;
      return Math.max(Math.min(s0, a), Math.min(Math.max(s0, a), pos));
    };
    this.tx = fit(left + this.tx, w, s.left, s.right) - left;
    this.ty = fit(top + this.ty, h, s.top, s.bottom) - top;
  }

  private apply(): void {
    this.canvas.style.transform = this.zoom === 1 ? '' : `translate(${this.tx}px, ${this.ty}px) scale(${this.zoom})`;
  }

  private onWheel = (e: WheelEvent): void => {
    e.preventDefault();
    const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 400 : 1;
    if (e.shiftKey) {
      // Some systems turn Shift+wheel into horizontal scrolling.
      this.brushAcc += (e.deltaY || e.deltaX) * unit;
      while (this.brushAcc >= BRUSH_STEP) {
        this.brushAcc -= BRUSH_STEP;
        this.hooks.brushStep(-1);
      }
      while (this.brushAcc <= -BRUSH_STEP) {
        this.brushAcc += BRUSH_STEP;
        this.hooks.brushStep(1);
      }
      return;
    }
    // Trackpad pinch arrives as ctrlKey + wheel; same thing here.
    this.zoomAt(e.clientX, e.clientY, Math.exp(-e.deltaY * unit * 0.002));
  };

  private onDown = (e: PointerEvent): void => {
    if (e.pointerType === 'mouse' && e.button === 1) {
      e.preventDefault();
      this.panning = { id: e.pointerId, x: e.clientX, y: e.clientY };
      this.canvas.setPointerCapture(e.pointerId);
      return;
    }
    if (e.pointerType !== 'touch') return;
    this.touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (this.touches.size === 2) {
      this.hooks.cancelPaint();
      this.pinch = this.pinchState();
    }
  };

  private onMove = (e: PointerEvent): void => {
    if (this.panning && e.pointerId === this.panning.id) {
      this.panBy(e.clientX - this.panning.x, e.clientY - this.panning.y);
      this.panning.x = e.clientX;
      this.panning.y = e.clientY;
      return;
    }
    if (!this.touches.has(e.pointerId)) return;
    this.touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (!this.pinch || this.touches.size < 2) return;
    const now = this.pinchState();
    if (this.pinch.dist > 0) this.zoomAt(now.mx, now.my, now.dist / this.pinch.dist);
    this.panBy(now.mx - this.pinch.mx, now.my - this.pinch.my);
    this.pinch = now;
  };

  private onUp = (e: PointerEvent): void => {
    if (this.panning && e.pointerId === this.panning.id) this.panning = null;
    this.touches.delete(e.pointerId);
    if (this.touches.size < 2) this.pinch = null;
  };

  private pinchState(): { dist: number; mx: number; my: number } {
    const [a, b] = [...this.touches.values()];
    return { dist: Math.hypot(a.x - b.x, a.y - b.y), mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2 };
  }
}
