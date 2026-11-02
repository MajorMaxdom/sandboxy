import { CATEGORIES, ID, baseColor, paletteElements } from '../elements/registry';
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

/**
 * Category tabs + element buttons. Calls onSelect with the chosen tool.
 */
export function createToolbar(
  tabsEl: HTMLElement,
  paletteEl: HTMLElement,
  descEl: HTMLElement,
  initial: Tool,
  onSelect: (tool: Tool, label: string) => void,
): { select: (tool: Tool) => void } {
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
          current = it.tool;
          descEl.textContent = `${it.label}: ${it.description}`;
          onSelect(it.tool, it.label);
          renderPalette();
        });
        return b;
      }),
    );
    // Keep the scroll position when re-rendering the same tab.
    paletteEl.scrollLeft = scroll;
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

  renderTabs();
  renderPalette();
  const first = itemsFor('land')[0];
  descEl.textContent = `${first.label}: ${first.description}`;

  return {
    /** Select a tool from outside (pipette): jump to its tab and highlight it. */
    select(tool: Tool) {
      current = tool;
      const cat = cats.find((c) => itemsFor(c.key).some((it) => sameTool(it.tool, tool)));
      if (cat) activeCat = cat.key;
      renderTabs();
      renderPalette();
      const item = itemsFor(activeCat).find((it) => sameTool(it.tool, tool));
      if (item) {
        descEl.textContent = `${item.label}: ${item.description}`;
        paletteEl.querySelector('.el.active')?.scrollIntoView({ inline: 'center', block: 'nearest' });
      }
    },
  };
}
