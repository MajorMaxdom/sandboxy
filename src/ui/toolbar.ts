import { CATEGORIES, ELEMENTS, ID, baseColor, paletteElements } from '../elements/registry';
import { DEFAULT_LASER, hexToRgb565, rgb565ToHex } from '../elements/color';
import type { Tool } from '../sim/brush';

interface PaletteItem {
  label: string;
  color: string;
  description: string;
  tool: Tool;
}

const TOOLS: PaletteItem[] = [
  { label: 'Radierer', color: '#2a2a33', description: 'Entfernt Partikel (auch: rechte Maustaste).', tool: { kind: 'erase' } },
  { label: 'Heizen', color: '#b8442f', description: 'Erhitzt alles unter dem Pinsel.', tool: { kind: 'heat' } },
  { label: 'Kühlen', color: '#2f73b8', description: 'Kühlt alles unter dem Pinsel ab.', tool: { kind: 'cool' } },
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

/** Settings for elements with a toolbar option, remembered across visits. */
const opts = { laserColor: '#ff2020', filling: '' };
try {
  Object.assign(opts, JSON.parse(localStorage.getItem(OPTS_KEY) ?? '{}'));
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

/** The option an element tool carries (laser color, firework filling), if any. */
function optionOf(tool: Tool): 'color' | 'element' | undefined {
  return tool.kind === 'element' ? ELEMENTS[tool.id].option : undefined;
}

/** Attach the current option value to an element tool. */
function withParam(tool: Tool): Tool {
  const o = optionOf(tool);
  if (tool.kind !== 'element' || !o) return tool;
  const param = o === 'color' ? hexToRgb565(opts.laserColor) : (ID[opts.filling] ?? 0);
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
  const cats = [...CATEGORIES.map((c) => ({ key: c.key as string, label: c.label })), { key: 'tools', label: 'Werkzeuge' }];
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
    const o = optionOf(current);
    if (!o) {
      optsEl.replaceChildren();
      return;
    }
    const label = document.createElement('label');
    const apply = () => {
      saveOpts();
      current = withParam(current);
      onSelect(current, '');
    };
    if (o === 'color') {
      const input = document.createElement('input');
      input.type = 'color';
      input.value = opts.laserColor;
      input.title = 'Farbe des Laserstrahls. Über einen Laser malen färbt ihn um.';
      input.addEventListener('input', () => {
        opts.laserColor = input.value;
        apply();
      });
      label.append('Farbe ', input);
    } else {
      const sel = document.createElement('select');
      sel.title = 'Worin das Feuerwerk zerplatzt';
      const sparks = document.createElement('option');
      sparks.value = '';
      sparks.textContent = 'Funken (Standard)';
      sel.append(sparks);
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
      sel.value = ID[opts.filling] !== undefined ? opts.filling : '';
      sel.addEventListener('change', () => {
        opts.filling = sel.value;
        apply();
      });
      label.append('Füllung ', sel);
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
      const o = optionOf(tool);
      if (o && tool.kind === 'element' && tool.param !== undefined) {
        if (o === 'color') opts.laserColor = rgb565ToHex(tool.param || DEFAULT_LASER);
        else opts.filling = tool.param ? ELEMENTS[tool.param]?.key ?? '' : '';
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
