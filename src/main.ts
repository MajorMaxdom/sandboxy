import './style.css';
import { ELEMENTS, ID } from './elements/registry';
import { Simulation } from './sim/simulation';
import { blowCircle, floodFill, paintCircle, paintLine, paintRect, type Tool } from './sim/brush';
import { Renderer, type Overlay, type ViewMode } from './render/renderer';
import { PointerInput } from './input/pointer';
import { createToolbar } from './ui/toolbar';
import { setupSavesDialog } from './ui/saves';
import { History } from './ui/history';
import { View } from './ui/view';
import { APP_VERSION } from './version';
import { hasSharedScene, loadShared } from './io/share';
import type { GridPoint } from './input/pointer';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

const canvas = $<HTMLCanvasElement>('canvas');
const stage = $('stage');
const btnPlay = $<HTMLButtonElement>('btn-play');
const btnStep = $<HTMLButtonElement>('btn-step');
const selSpeed = $<HTMLSelectElement>('sel-speed');
const rngBrush = $<HTMLInputElement>('rng-brush');
const brushVal = $('brush-val');
const chkReplace = $<HTMLInputElement>('chk-replace');
const selView = $<HTMLSelectElement>('sel-view');
const selShape = $<HTMLSelectElement>('sel-shape');
const btnUndo = $<HTMLButtonElement>('btn-undo');
const btnRedo = $<HTMLButtonElement>('btn-redo');
const btnClear = $<HTMLButtonElement>('btn-clear');
const btnSaves = $<HTMLButtonElement>('btn-saves');
const hoverEl = $('hover');
const statsEl = $('stats');
const rngWind = $<HTMLInputElement>('rng-wind');
const windVal = $('wind-val');

$('app-version').textContent = `v${APP_VERSION}`;
$('dlg-version').textContent = `v${APP_VERSION}`;

// ---- Toolbar first, so the stage has its final height before we measure ----

let tool: Tool = { kind: 'element', id: ID.sand };
const toolbar = createToolbar($('tabs'), $('palette'), $('desc'), $('tool-opts'), tool, (t) => {
  tool = t;
});

// ---- Grid size from the available space ---------------------------------

/** Inner size of the stage (without padding). */
function stageSize(): { width: number; height: number } {
  const cs = getComputedStyle(stage);
  return {
    width: stage.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight),
    height: stage.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom),
  };
}

const PIXEL_KEY = 'sandboxy.pixel';
const PIXEL_SIZES = [1, 2, 3, 4, 5, 6, 8, 10, 12];
/** Upper bound on cells so tiny pixel sizes stay playable. */
const MAX_CELLS = 400_000;
const selPixel = $<HTMLSelectElement>('sel-pixel');

let pixelSetting: 'auto' | number = 'auto';
try {
  const saved = localStorage.getItem(PIXEL_KEY);
  if (saved && PIXEL_SIZES.includes(Number(saved))) pixelSetting = Number(saved);
} catch {
  /* storage unavailable */
}
selPixel.value = String(pixelSetting);

/** Screen pixels per simulation cell. */
function pixelSize(): number {
  if (pixelSetting !== 'auto') return pixelSetting;
  const { width } = stageSize();
  return Math.max(2, Math.min(6, Math.round(width / 300)));
}

function pickGridSize(): { w: number; h: number } {
  const rect = stageSize();
  let px = pixelSize();
  const cells = (px: number) => Math.floor((rect.width - 2) / px) * Math.floor((rect.height - 2) / px);
  while (cells(px) > MAX_CELLS) px += 0.5;
  return {
    w: Math.max(40, Math.floor((rect.width - 2) / px)),
    h: Math.max(30, Math.floor((rect.height - 2) / px)),
  };
}

/** Zoom/pan; created once the pointer input exists (see below). */
let view: View;

const initial = pickGridSize();
const sim = new Simulation(initial.w, initial.h, (Math.random() * 2 ** 32) >>> 0);
const renderer = new Renderer(canvas);
renderer.resize(sim.w, sim.h);

function fitCanvas(): void {
  const rect = stageSize();
  // 2px for the canvas border. Prefer the exact pixel size so cells stay crisp.
  const fit = Math.min((rect.width - 2) / sim.w, (rect.height - 2) / sim.h);
  const px = pixelSize();
  const scale = px <= fit ? Math.max(px, Math.floor(fit)) : fit;
  canvas.style.width = `${Math.floor(sim.w * scale)}px`;
  canvas.style.height = `${Math.floor(sim.h * scale)}px`;
}

/** Re-grid to the current pixel size / window size, keeping the scene. */
function regrid(): void {
  const { w, h } = pickGridSize();
  if (w !== sim.w || h !== sim.h) {
    sim.resizeKeep(w, h);
    renderer.resize(w, h);
    view?.reset();
  }
  fitCanvas();
}

let regridTimer = 0;
new ResizeObserver(() => {
  fitCanvas();
  view?.refit();
  clearTimeout(regridTimer);
  regridTimer = window.setTimeout(regrid, 250);
}).observe(stage);
fitCanvas();

function setPixel(v: 'auto' | number): void {
  pixelSetting = v;
  selPixel.value = String(v);
  try {
    localStorage.setItem(PIXEL_KEY, String(v));
  } catch {
    /* ignore */
  }
  regrid();
}
selPixel.addEventListener('change', () => {
  setPixel(selPixel.value === 'auto' ? 'auto' : Number(selPixel.value));
});

/** Step the pixel size up/down (keyboard + / -). */
function stepPixel(dir: 1 | -1): void {
  const cur = pixelSize();
  const idx = PIXEL_SIZES.findIndex((p) => p >= cur);
  const next = PIXEL_SIZES[Math.max(0, Math.min(PIXEL_SIZES.length - 1, (idx < 0 ? PIXEL_SIZES.length - 1 : idx) + dir))];
  setPixel(next);
}

// ---- UI state -------------------------------------------------------------

type Shape = 'free' | 'line' | 'rect' | 'fill' | 'pick';
let paused = false;
let speed = 1;
let brush = Number(rngBrush.value);
let stepRequests = 0;
let shape: Shape = 'free';
/** The stroke being drawn: where it started, where the pointer is now. */
let stroke: { start: GridPoint; end: GridPoint; tool: Tool; shape: Shape } | null = null;

const history = new History(sim, () => {
  renderer.resize(sim.w, sim.h);
  fitCanvas();
  view.reset();
});

function updateUndoButtons(): void {
  btnUndo.disabled = !history.canUndo;
  btnRedo.disabled = !history.canRedo;
}

function setPaused(p: boolean): void {
  paused = p;
  btnPlay.textContent = paused ? '▶' : '⏸';
  btnPlay.title = paused ? 'Weiter (Leertaste)' : 'Pause (Leertaste)';
  btnPlay.classList.toggle('active', paused);
}

function setBrush(v: number): void {
  brush = Math.max(0, Math.min(Number(rngBrush.max), v));
  rngBrush.value = String(brush);
  brushVal.textContent = String(brush);
}

function setWind(v: number): void {
  sim.wind = Math.max(-5, Math.min(5, Math.round(v)));
  rngWind.value = String(sim.wind);
  windVal.textContent = sim.wind === 0 ? '0' : sim.wind > 0 ? `${sim.wind} →` : `← ${-sim.wind}`;
}
rngWind.addEventListener('input', () => setWind(Number(rngWind.value)));

function setView(mode: ViewMode): void {
  renderer.mode = mode;
  selView.value = mode;
}
selView.addEventListener('change', () => setView(selView.value as ViewMode));

function setShape(s: Shape): void {
  shape = s;
  selShape.value = s;
}
selShape.addEventListener('change', () => setShape(selShape.value as Shape));

function undo(): void {
  stroke = null; // drop a shape that hasn't been applied yet
  if (history.undo()) updateUndoButtons();
}
function redo(): void {
  stroke = null;
  if (history.redo()) updateUndoButtons();
}

btnPlay.addEventListener('click', () => setPaused(!paused));
btnStep.addEventListener('click', () => {
  setPaused(true);
  stepRequests++;
});
selSpeed.addEventListener('change', () => {
  speed = Number(selSpeed.value);
});
rngBrush.addEventListener('input', () => setBrush(Number(rngBrush.value)));
btnClear.addEventListener('click', () => {
  history.record();
  updateUndoButtons();
  sim.clear();
});
btnUndo.addEventListener('click', undo);
btnRedo.addEventListener('click', redo);

// ☰ menu on phones: the less used settings fold into a panel over the canvas.
const btnMenu = $<HTMLButtonElement>('btn-menu');
const gridInfo = $<HTMLSpanElement>('grid-info');
const menuPanel = $<HTMLDivElement>('menu-panel');
function setMenu(open: boolean): void {
  menuPanel.classList.toggle('open', open);
  btnMenu.setAttribute('aria-expanded', String(open));
}
btnMenu.addEventListener('click', () => setMenu(!menuPanel.classList.contains('open')));
// Close on a tap outside the panel. On the canvas that tap only closes the
// menu and doesn't paint (capture phase, before the canvas sees it) …
document.addEventListener(
  'pointerdown',
  (e) => {
    const t = e.target as Node;
    if (!menuPanel.classList.contains('open') || menuPanel.contains(t) || btnMenu.contains(t)) return;
    setMenu(false);
    if (t === canvas) e.stopPropagation();
  },
  true,
);
// … and after the one-shot actions in it.
btnClear.addEventListener('click', () => setMenu(false));
btnSaves.addEventListener('click', () => setMenu(false));
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') setMenu(false);
});

const openSaves = setupSavesDialog(sim, {
  beforeLoad: () => {
    history.record();
    updateUndoButtons();
  },
  afterLoad: (settings) => {
    renderer.resize(sim.w, sim.h);
    fitCanvas();
    view.reset();
    if (settings) setWind(settings.wind);
  },
});
btnSaves.addEventListener('click', openSaves);

window.addEventListener('keydown', (e) => {
  const target = e.target as HTMLElement;
  if (target.matches('input[type=text], input:not([type]), textarea, select') || target.closest('dialog')) return;
  const mod = e.ctrlKey || e.metaKey;
  if (mod && (e.key === 'z' || e.key === 'Z')) {
    e.preventDefault();
    if (e.shiftKey) redo();
    else undo();
    return;
  }
  if (mod && (e.key === 'y' || e.key === 'Y')) {
    e.preventDefault();
    redo();
    return;
  }
  if (mod) return;
  switch (e.key) {
    case ' ':
      e.preventDefault();
      setPaused(!paused);
      break;
    case '.':
      setPaused(true);
      stepRequests++;
      break;
    case '[':
      setBrush(brush - 1);
      break;
    case ']':
      setBrush(brush + 1);
      break;
    case 'h':
    case 'H':
      setView(renderer.mode === 'heat' ? 'normal' : 'heat');
      break;
    case 'p':
    case 'P':
      setView(renderer.mode === 'pressure' ? 'normal' : 'pressure');
      break;
    case 'f':
    case 'F':
      setShape('free');
      break;
    case 'l':
    case 'L':
      setShape('line');
      break;
    case 'r':
    case 'R':
      setShape('rect');
      break;
    case 'g':
    case 'G':
      setShape('fill');
      break;
    case 'i':
    case 'I':
      setShape('pick');
      break;
    case '+':
      stepPixel(1);
      break;
    case '-':
      stepPixel(-1);
      break;
    case '0':
      view.reset();
      break;
    case 'ArrowLeft':
      if (target.matches('input[type=range]')) break; // the slider handles it itself
      e.preventDefault();
      setWind(sim.wind - 1);
      break;
    case 'ArrowRight':
      if (target.matches('input[type=range]')) break;
      e.preventDefault();
      setWind(sim.wind + 1);
      break;
  }
});

setBrush(brush);
setPaused(false);
updateUndoButtons();

// ---- Input & loop -----------------------------------------------------------

const input = new PointerInput(canvas, () => ({ w: sim.w, h: sim.h }));
view = new View(canvas, stage, {
  brushStep: (dir) => setBrush(brush + dir),
  cancelPaint: () => input.cancel(),
});
const ERASE: Tool = { kind: 'erase' };


/** Pipette: take the element under the cursor as the current tool. */
function pick(p: GridPoint): void {
  if (!sim.inBounds(p.x, p.y)) return;
  const id = sim.type[p.y * sim.w + p.x];
  const def = ELEMENTS[id];
  if (id === 0 || def.category === 'hidden') return;
  // Lasers and fireworks: take over their color / filling too.
  tool = toolbar.select({ kind: 'element', id, param: def.option ? sim.life[p.y * sim.w + p.x] : undefined });
}

function handleInput(): void {
  if (input.aborted) {
    input.aborted = false;
    stroke = null; // a pinch began: drop the line/rectangle being dragged
  }
  if (!input.painting) {
    if (stroke) finishStroke();
    return;
  }
  const pts = input.takeStroke();
  if (pts.length === 0) return;
  const opt = { radius: brush, replace: chkReplace.checked };

  if (!stroke) {
    const t = input.erase ? ERASE : tool;
    const sh: Shape = input.pickClick ? 'pick' : t.kind === 'wind' ? 'free' : shape;
    stroke = { start: pts[0], end: pts[0], tool: t, shape: sh };
    if (sh === 'pick') {
      pick(pts[0]);
      return;
    }
    history.record();
    updateUndoButtons();
    if (t.kind === 'toggle') {
      paintCircle(sim, pts[0].x, pts[0].y, t, opt); // once per click
      return;
    }
    if (sh === 'fill') {
      floodFill(sim, pts[0].x, pts[0].y, t, opt);
      return;
    }
  }
  const prevEnd = stroke.end;
  stroke.end = pts[pts.length - 1];
  if (stroke.shape !== 'free' || stroke.tool.kind === 'toggle') return;
  const t = stroke.tool;
  if (t.kind === 'wind') {
    // Gusts along the drag, from where the brush was last frame. They keep
    // blowing for a few ticks, fading out (see blowGusts).
    let a = prevEnd;
    for (const b of pts) {
      if (b.x !== a.x || b.y !== a.y) gusts.push({ x: b.x, y: b.y, dx: b.x - a.x, dy: b.y - a.y, r: brush, ttl: GUST_TICKS });
      a = b;
    }
    if (!input.down) finishStroke();
    return;
  }
  if (pts.length === 1) paintLine(sim, pts[0].x, pts[0].y, pts[0].x, pts[0].y, t, opt);
  for (let k = 1; k < pts.length; k++) paintLine(sim, pts[k - 1].x, pts[k - 1].y, pts[k].x, pts[k].y, t, opt);
  if (!input.down) finishStroke();
}

/** Wind tool gusts still blowing, and for how many more ticks. */
const GUST_TICKS = 12;
const GUST_FADE = 0.85;
const GUST_LIMIT = 400;
let gusts: { x: number; y: number; dx: number; dy: number; r: number; ttl: number }[] = [];

/** Before a tick: let the wind tool's gusts blow (fading). */
function blowGusts(): void {
  if (gusts.length === 0) return;
  if (gusts.length > GUST_LIMIT) gusts = gusts.slice(-GUST_LIMIT);
  for (const g of gusts) {
    blowCircle(sim, g.x, g.y, g.dx, g.dy, g.r);
    g.dx *= GUST_FADE;
    g.dy *= GUST_FADE;
    g.ttl--;
  }
  gusts = gusts.filter((g) => g.ttl > 0);
}

function finishStroke(): void {
  if (!stroke) return;
  const { start: a, end: b, tool: t } = stroke;
  const opt = { radius: brush, replace: chkReplace.checked, solid: true };
  if (stroke.shape === 'line') paintLine(sim, a.x, a.y, b.x, b.y, t, opt);
  else if (stroke.shape === 'rect') paintRect(sim, a.x, a.y, b.x, b.y, t, opt);
  stroke = null;
}

function overlay(): Overlay | null {
  if (stroke && input.down) {
    const { start: a, end: b } = stroke;
    if (stroke.shape === 'line') return { kind: 'line', x0: a.x, y0: a.y, x1: b.x, y1: b.y, r: brush };
    if (stroke.shape === 'rect') return { kind: 'rect', x0: a.x, y0: a.y, x1: b.x, y1: b.y };
  }
  const hv = input.hover;
  if (hv && shape !== 'fill' && shape !== 'pick') return { kind: 'brush', x: hv.x, y: hv.y, r: brush };
  return null;
}

const TICK_RATE = 60;
/** Milliseconds per frame the simulation may use before it falls behind. */
const SIM_BUDGET_MS = 12;
let acc = 0;
/** Ticks simulated since the last stats update. */
let ticks = 0;
let last = performance.now();
let frames = 0;
let fpsTime = last;
let fps = 0;

function updateHud(): void {
  const hv = input.hover;
  if (hv && sim.inBounds(hv.x, hv.y)) {
    const i = hv.y * sim.w + hv.x;
    const def = ELEMENTS[sim.type[i]];
    const extra = renderer.mode === 'pressure' ? ` · Druck ${sim.presAt(hv.x, hv.y).toFixed(2)}` : '';
    // Temperature first: on a phone the line gets cut off at the end.
    hoverEl.textContent = `${Math.round(sim.temp[i])} °C · ${def.label}${extra}`;
  } else {
    hoverEl.textContent = '';
  }
}

function frame(now: number): void {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;

  handleInput();

  if (!paused) {
    acc += dt * TICK_RATE * speed;
    // Catch up on missed ticks, but only within a time budget: on a slow
    // device, catching up makes the frame longer, which leaves even more to
    // catch up next frame, until the frame rate collapses. Better to let the
    // simulation run slower than real time and keep the screen smooth.
    const t0 = performance.now();
    while (acc >= 1) {
      blowGusts();
      sim.step();
      acc -= 1;
      ticks++;
      if (performance.now() - t0 > SIM_BUDGET_MS) {
        acc = 0;
        break;
      }
    }
  } else {
    acc = 0;
    while (stepRequests > 0) {
      blowGusts();
      sim.step();
      stepRequests--;
    }
  }

  renderer.draw(sim, overlay());
  updateHud();

  frames++;
  if (now - fpsTime >= 500) {
    fps = Math.round((frames * 1000) / (now - fpsTime));
    // Show how fast the world runs when the device can't keep up.
    const rate = ticks / ((now - fpsTime) / 1000) / (TICK_RATE * speed);
    // Phones get a short line, so the element under the finger fits next to it.
    const compact = window.innerWidth <= 720;
    const slow = !paused && rate < 0.9 ? (compact ? ` · ${Math.round(rate * 100)} %` : ` · Tempo ${Math.round(rate * 100)} %`) : '';
    frames = 0;
    ticks = 0;
    fpsTime = now;
    const zoom = view.zoom > 1 ? ` · Zoom ${view.zoom.toFixed(1).replace('.', ',')}×` : '';
    const count = sim.countParticles().toLocaleString('de-DE');
    statsEl.textContent = compact
      ? `${fps} FPS${slow} · ${count}${zoom} · v${APP_VERSION}`
      : `${fps} FPS${slow} · ${count} Partikel · ${sim.w}×${sim.h}${zoom} · v${APP_VERSION}`;
    gridInfo.textContent = `Raster ${sim.w}×${sim.h}`;
    statsEl.title = `${fps} FPS${slow} · ${count} Partikel · Raster ${sim.w}×${sim.h}${zoom} · Version ${APP_VERSION}`;
  }

  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);

// Scene shared via link?
if (hasSharedScene()) {
  loadShared(sim)
    .then(() => {
      renderer.resize(sim.w, sim.h);
      fitCanvas();
    })
    .catch((e) => console.warn('Geteilte Szene konnte nicht geladen werden:', e));
}

// Handy for debugging in the browser console.
(window as unknown as { sandboxy: unknown }).sandboxy = { sim, ELEMENTS, ID, version: APP_VERSION };
