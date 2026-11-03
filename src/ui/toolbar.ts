import { CATEGORIES, ELEMENTS, ID, baseColor, paletteElements } from '../elements/registry';
import { DEFAULT_LASER, hexToRgb565, rgb565ToHex } from '../elements/color';
import type { Tool } from '../sim/brush';
import type { ElementDef } from '../sim/types';

interface PaletteItem {
  label: string;
  color: string;
  description: string;
  tool: Tool;
}

const TOOLS: PaletteItem[] = [
  { label: 'Radierer', color: '#2a2a33', description: 'Entfernt Partikel (auch: rechte Maustaste).', tool: { kind: 'erase' } },
  { label: 'Heizen', color: '#b8442f', description: 'Erhitzt, was unter dem Pinsel liegt, solange man drückt.', tool: { kind: 'heat' } },
  { label: 'Kühlen', color: '#2f73b8', description: 'Kühlt ab, was unter dem Pinsel liegt, solange man drückt.', tool: { kind: 'cool' } },
  { label: 'Wind', color: '#6fa8bf', description: 'Über die Fläche wischen: bläst Gase, Staub und Leichtes in Wischrichtung.', tool: { kind: 'wind' } },
  { label: 'Schalter umlegen', color: '#3fbf5a', description: 'Klick auf einen Schalter schaltet ihn an oder aus.', tool: { kind: 'toggle' } },
];

function itemsFor(category: string): PaletteItem[] {
  if (category === 'tools') return TOOLS;
  return paletteElements(category as never).map((d) => ({
    label: d.label,
    color: baseColor(d),
    description: d.description ?? '',
    tool: { kind: 'element', id: ID[d.key] },
  }));
}

function textColorFor(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return 0.299 * r + 0.587 * g + 0.114 * b > 150 ? '#111' : '#f4f4f6';
}

function sameTool(a: Tool, b: Tool): boolean {
  return a.kind === b.kind && (a.kind !== 'element' || a.id === (b as { id: number }).id);
}

const TAB_KEY = 'sandboxy.tab';
const OPTS_KEY = 'sandboxy.opts';

/**
 * Settings for elements with a toolbar option, remembered across visits:
 * option key (see ElementDef.optionKey) → hex color or element key.
 */
const opts: Record<string, string> = {};
try {
  const saved = JSON.parse(localStorage.getItem(OPTS_KEY) ?? '{}') as Record<string, string>;
  // Format of v0.2.0: { laserColor, filling }.
  if (saved.laserColor) saved.laser ??= saved.laserColor;
  if (saved.filling !== undefined) saved.firework ??= saved.filling;
  delete saved.laserColor;
  delete saved.filling;
  Object.assign(opts, saved);
} catch {
  /* storage unavailable or broken */
}
function saveOpts(): void {
  try {
    localStorage.setItem(OPTS_KEY, JSON.stringify(opts));
  } catch {
    /* ignore */
  }
}

/** The element definition of a tool, if it has a toolbar option. */
function optionDef(tool: Tool): ElementDef | undefined {
  if (tool.kind !== 'element') return undefined;
  const d = ELEMENTS[tool.id];
  return d.option ? d : undefined;
}

const optKey = (d: ElementDef) => d.optionKey ?? d.key;

/** Current option value: hex color, element key, or '' for "none". */
function optValue(d: ElementDef): string {
  const v = opts[optKey(d)];
  if (d.option === 'color') return v && /^#[0-9a-f]{6}$/i.test(v) ? v : (d.optionDefault ?? '#ff2020');
  if (d.option === 'level') return v && /^([1-9]|10)$/.test(v) ? v : (d.optionDefault ?? '5');
  if (v !== undefined && (v === '' ? d.optionNone !== undefined : ID[v] !== undefined)) return v;
  return d.optionDefault ?? '';
}

/** Attach the current option value to an element tool. */
function withParam(tool: Tool): Tool {
  const d = optionDef(tool);
  if (tool.kind !== 'element' || !d) return tool;
  const v = optValue(d);
  const param = d.option === 'color' ? hexToRgb565(v) : d.option === 'level' ? Number(v) : (ID[v] ?? 0);
  return { ...tool, param };
}

/**
 * Category tabs + element buttons. Calls onSelect with the chosen tool.
 */
export function createToolbar(
  tabsEl: HTMLElement,
  paletteEl: HTMLElement,
  descEl: HTMLElement,
  optsEl: HTMLElement,
  initial: Tool,
  onSelect: (tool: Tool, label: string) => void,
): { select: (tool: Tool) => Tool } {
  // Tools first: on a phone the tab row scrolls, and the last tab is easy to miss.
  const cats = [{ key: 'tools', label: 'Werkzeuge' }, ...CATEGORIES.map((c) => ({ key: c.key as string, label: c.label }))];
  let current: Tool = initial;
  let activeCat = 'land';
  try {
    const saved = localStorage.getItem(TAB_KEY);
    if (saved && cats.some((c) => c.key === saved)) activeCat = saved;
  } catch {
    /* storage unavailable */
  }

  function renderTabs(): void {
    tabsEl.replaceChildren(
      ...cats.map((c) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'tab' + (c.key === activeCat ? ' active' : '');
        b.setAttribute('role', 'tab');
        b.setAttribute('aria-selected', String(c.key === activeCat));
        b.textContent = c.label;
        b.addEventListener('click', () => {
          activeCat = c.key;
          try {
            localStorage.setItem(TAB_KEY, activeCat);
          } catch {
            /* ignore */
          }
          renderTabs();
          renderPalette();
          paletteEl.scrollLeft = 0;
        });
        return b;
      }),
    );
  }

  function renderPalette(): void {
    const items = itemsFor(activeCat);
    const scroll = paletteEl.scrollLeft;
    paletteEl.replaceChildren(
      ...items.map((it) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'el' + (sameTool(it.tool, current) ? ' active' : '');
        b.style.background = it.color;
        b.style.color = textColorFor(it.color);
        b.textContent = it.label;
        b.title = it.description;
        b.addEventListener('click', () => {
          current = withParam(it.tool);
          setDesc(`${it.label}: ${it.description}`);
          onSelect(current, it.label);
          renderPalette();
          renderOpts();
        });
        return b;
      }),
    );
    // Keep the scroll position when re-rendering the same tab.
    paletteEl.scrollLeft = scroll;
  }

  /** Description line (clamped to two lines; the full text is in the tooltip). */
  function setDesc(text: string): void {
    descEl.textContent = text;
    descEl.title = text;
  }

  /** Controls for the selected element's option (color picker / filling). */
  function renderOpts(): void {
    const d = optionDef(current);
    if (!d) {
      optsEl.replaceChildren();
      return;
    }
    const key = optKey(d);
    const label = document.createElement('label');
    const apply = () => {
      saveOpts();
      current = withParam(current);
      onSelect(current, '');
    };
    if (d.option === 'color') {
      const input = document.createElement('input');
      input.type = 'color';
      input.value = optValue(d);
      input.title = 'Übermalen mit einer anderen Farbe färbt vorhandene Teile um.';
      input.addEventListener('input', () => {
        opts[key] = input.value;
        apply();
      });
      label.append(`${d.optionLabel ?? 'Farbe'} `, input);
    } else if (d.option === 'level') {
      const input = document.createElement('input');
      input.type = 'range';
      input.min = '1';
      input.max = '10';
      input.value = optValue(d);
      const out = document.createElement('span');
      out.className = 'opt-val';
      out.textContent = input.value;
      input.title = 'Übermalen mit einer anderen Stärke stellt vorhandene um.';
      input.addEventListener('input', () => {
        opts[key] = input.value;
        out.textContent = input.value;
        apply();
      });
      label.append(`${d.optionLabel ?? 'Stärke'} `, input, out);
    } else {
      const sel = document.createElement('select');
      if (d.optionNone !== undefined) {
        const none = document.createElement('option');
        none.value = '';
        none.textContent = d.optionNone;
        sel.append(none);
      }
      for (const c of CATEGORIES) {
        const group = document.createElement('optgroup');
        group.label = c.label;
        for (const d of paletteElements(c.key)) {
          const op = document.createElement('option');
          op.value = d.key;
          op.textContent = d.label;
          group.append(op);
        }
        sel.append(group);
      }
      sel.value = optValue(d);
      sel.addEventListener('change', () => {
        opts[key] = sel.value;
        apply();
      });
      label.append(`${d.optionLabel ?? 'Element'} `, sel);
    }
    optsEl.replaceChildren(label);
  }

  // Mouse wheel scrolls the single-row palette sideways.
  paletteEl.addEventListener(
    'wheel',
    (e) => {
      if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
      if (paletteEl.scrollWidth <= paletteEl.clientWidth) return;
      e.preventDefault();
      paletteEl.scrollLeft += e.deltaY;
    },
    { passive: false },
  );

  current = withParam(current);
  renderTabs();
  renderPalette();
  renderOpts();
  const first = itemsFor('land')[0];
  setDesc(`${first.label}: ${first.description}`);

  return {
    /** Select a tool from outside (pipette): jump to its tab and highlight it. */
    select(tool: Tool) {
      // Picked from the world (pipette): adopt its color / filling.
      const d = optionDef(tool);
      if (d && tool.kind === 'element' && tool.param !== undefined) {
        const key = optKey(d);
        if (d.option === 'color') opts[key] = rgb565ToHex(tool.param || DEFAULT_LASER);
        else if (d.option === 'level') opts[key] = String(Math.min(10, Math.max(1, tool.param || Number(d.optionDefault ?? 5))));
        else opts[key] = tool.param ? (ELEMENTS[tool.param]?.key ?? '') : '';
        saveOpts();
      }
      current = withParam(tool);
      const cat = cats.find((c) => itemsFor(c.key).some((it) => sameTool(it.tool, tool)));
      if (cat) activeCat = cat.key;
      renderTabs();
      renderPalette();
      renderOpts();
      const item = itemsFor(activeCat).find((it) => sameTool(it.tool, tool));
      if (item) {
        setDesc(`${item.label}: ${item.description}`);
        paletteEl.querySelector('.el.active')?.scrollIntoView({ inline: 'center', block: 'nearest' });
      }
      return current;
    },
  };
}
