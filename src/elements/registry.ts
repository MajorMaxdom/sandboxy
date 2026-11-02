import type { Category, ElementDef, State } from '../sim/types';
import { ID } from './ids';
import { hexToRgb565 } from './color';
import { P, EMPTY, STATIC, POWDER, LIQUID, GAS, LIGHT_ABSORB, LIGHT_PASS, LIGHT_SLASH, LIGHT_BACKSLASH, LIGHT_FILTER, RAD_NONE, RAD_BLOCK, RAD_KILL, RAD_MODERATE, RAD_MUTATE, RAD_FEED } from './props';
import { tech } from './tech';
import { logic } from './logic';
import { nuclear } from './nuclear';
import { land } from './land';
import { solids } from './solids';
import { metals } from './metals';
import { liquids } from './liquids';
import { gases } from './gases';
import { energy } from './energy';
import { life } from './life';
import { explosives } from './explosives';
import { special } from './special';

const EMPTY_DEF: ElementDef = {
  key: 'empty',
  label: 'Luft',
  category: 'hidden',
  color: '#141418',
  state: 'empty',
  density: 0,
  conductivity: 0.04,
  cooling: 0.01,
};

export const ELEMENTS: ElementDef[] = [
  EMPTY_DEF,
  ...land,
  ...solids,
  ...metals,
  ...liquids,
  ...gases,
  ...energy,
  ...tech,
  ...logic,
  ...nuclear,
  ...life,
  ...explosives,
  ...special,
];

export const CATEGORIES: { key: Category; label: string }[] = [
  { key: 'land', label: 'Land' },
  { key: 'solids', label: 'Feststoffe' },
  { key: 'metals', label: 'Metalle' },
  { key: 'liquids', label: 'Flüssigkeiten' },
  { key: 'gases', label: 'Gase' },
  { key: 'energy', label: 'Energie' },
  { key: 'tech', label: 'Technik' },
  { key: 'logic', label: 'Logik' },
  { key: 'nuclear', label: 'Strahlung' },
  { key: 'life', label: 'Leben' },
  { key: 'explosives', label: 'Sprengstoffe' },
  { key: 'special', label: 'Spezial' },
];

const STATE_CODE: Record<State, number> = {
  empty: EMPTY,
  static: STATIC,
  powder: POWDER,
  liquid: LIQUID,
  gas: GAS,
};

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function packColor(r: number, g: number, b: number): number {
  const c = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  return ((255 << 24) | (c(b) << 16) | (c(g) << 8) | c(r)) >>> 0;
}

function shades(color: string | string[]): number[] {
  const list = Array.isArray(color) ? color : [color];
  const factors = [1, 0.93, 1.07, 0.96];
  const out: number[] = [];
  for (let k = 0; k < 4; k++) {
    if (k < list.length) {
      out.push(packColor(...hexToRgb(list[k])));
    } else {
      const [r, g, b] = hexToRgb(list[k % list.length]);
      const f = factors[k];
      out.push(packColor(r * f, g * f, b * f));
    }
  }
  return out;
}

export function baseColor(def: ElementDef): string {
  return Array.isArray(def.color) ? def.color[0] : def.color;
}

function build(): void {
  const n = ELEMENTS.length;
  if (n > 255) throw new Error('Too many elements for Uint8 storage');

  ELEMENTS.forEach((d, i) => {
    if (ID[d.key] !== undefined) throw new Error(`Duplicate element key: ${d.key}`);
    ID[d.key] = i;
  });

  const ref = (key: string, ctx: string): number => {
    const id = ID[key];
    if (id === undefined) throw new Error(`Unknown element "${key}" referenced by ${ctx}`);
    return id;
  };
  const refs = (v: string | string[] | undefined, fallback: string, ctx: string): number[] =>
    (v === undefined ? [fallback] : Array.isArray(v) ? v : [v]).map((k) => ref(k, ctx));

  P.n = n;
  P.state = new Uint8Array(n);
  P.density = new Float32Array(n);
  P.dispersion = new Uint8Array(n);
  P.viscosity = new Float32Array(n);
  P.hasTemp = new Uint8Array(n);
  P.defaultTemp = new Float32Array(n);
  P.cond = new Float32Array(n);
  P.cap = new Float32Array(n);
  P.cool = new Float32Array(n);
  P.tHigh = new Float32Array(n).fill(Infinity);
  P.toHigh = new Int16Array(n).fill(-1);
  P.tLow = new Float32Array(n).fill(-Infinity);
  P.toLow = new Int16Array(n).fill(-1);
  P.byproduct = new Int16Array(n).fill(-1);
  P.transChance = new Float32Array(n);
  P.burnIgnite = new Float32Array(n).fill(Infinity);
  P.burnChance = new Float32Array(n);
  P.burnHeat = new Float32Array(n);
  P.burnSpread = new Float32Array(n);
  P.burnInto = [];
  P.explIgnite = new Float32Array(n).fill(Infinity);
  P.explRadius = new Float32Array(n);
  P.conducts = new Uint8Array(n);
  P.resist = new Float32Array(n);
  P.restless = new Uint8Array(n);
  P.lightsUp = new Uint8Array(n);
  P.ownColor = new Uint8Array(n);
  P.lifeIsElement = new Uint8Array(n);
  P.defaultParam = new Uint16Array(n);
  P.light = new Uint8Array(n);
  P.onLight = [];
  P.logic = new Uint8Array(n);
  P.emit = new Float32Array(n);
  P.decayHeat = new Float32Array(n);
  P.fissionChance = new Float32Array(n);
  P.fissionHeat = new Float32Array(n);
  P.fissionExcite = new Float32Array(n);
  P.radResp = new Uint8Array(n);
  P.windFactor = new Float32Array(n);
  P.actTemp = new Float32Array(n);
  P.decays = new Uint8Array(n);
  P.lifeMin = new Uint16Array(n);
  P.lifeMax = new Uint16Array(n);
  P.decayInto = [];
  P.glow = new Uint8Array(n);
  P.indestructible = new Uint8Array(n);
  P.acidProof = new Uint8Array(n);
  P.paintChance = new Float32Array(n);
  P.hasReactions = new Uint8Array(n);
  P.update = [];
  P.colors = new Uint32Array(n * 4);
  P.reactTable = new Int32Array(n * n).fill(-1);
  P.reactions = [];

  ELEMENTS.forEach((d, i) => {
    const ctx = `"${d.key}"`;
    P.state[i] = STATE_CODE[d.state];
    P.density[i] = d.density;
    P.dispersion[i] = d.dispersion ?? (d.state === 'liquid' ? 3 : 0);
    P.viscosity[i] = d.viscosity ?? 0;
    P.hasTemp[i] = d.defaultTemp !== undefined ? 1 : 0;
    P.defaultTemp[i] = d.defaultTemp ?? 20;
    P.cond[i] = Math.min(1, d.conductivity ?? 0.3);
    P.cap[i] = Math.max(1, d.heatCap ?? 1);
    P.cool[i] = d.cooling ?? 0.0005;
    if (d.tempHigh !== undefined && d.stateHigh !== undefined) {
      P.tHigh[i] = d.tempHigh;
      P.toHigh[i] = ref(d.stateHigh, ctx);
    }
    if (d.tempLow !== undefined && d.stateLow !== undefined) {
      P.tLow[i] = d.tempLow;
      P.toLow[i] = ref(d.stateLow, ctx);
    }
    if (d.highByproduct) P.byproduct[i] = ref(d.highByproduct, ctx);
    P.transChance[i] = d.transitionChance ?? 0.2;

    P.burnInto[i] = [];
    if (d.burn) {
      P.burnIgnite[i] = d.burn.ignite;
      P.burnChance[i] = d.burn.chance;
      P.burnHeat[i] = d.burn.heat ?? 600;
      P.burnSpread[i] = d.burn.spread ?? 0.3;
      P.burnInto[i] = refs(d.burn.into, 'fire', ctx);
    }
    if (d.explode) {
      P.explIgnite[i] = d.explode.ignite;
      P.explRadius[i] = d.explode.radius;
    }
    P.conducts[i] = d.conducts ? 1 : 0;
    P.resist[i] = d.resistance ?? 1;

    P.decayInto[i] = [];
    if (d.lifespan) {
      P.decays[i] = 1;
      P.lifeMin[i] = Math.max(1, d.lifespan[0]);
      P.lifeMax[i] = Math.max(P.lifeMin[i], d.lifespan[1]);
      P.decayInto[i] = refs(d.decayInto, 'empty', ctx);
    } else if (d.initLife) {
      P.lifeMin[i] = d.initLife[0];
      P.lifeMax[i] = d.initLife[1];
    }

    P.glow[i] = d.glow ? 1 : 0;
    P.indestructible[i] = d.indestructible ? 1 : 0;
    P.acidProof[i] = d.acidProof || d.state === 'empty' ? 1 : 0;
    P.paintChance[i] = d.paintChance ?? (d.state === 'static' ? 1 : 0.5);
    P.update[i] = d.update;
    P.restless[i] = d.state === 'gas' || !!d.lifespan || (!!d.update && !d.calm) || !!d.radioactive ? 1 : 0;
    P.lightsUp[i] = d.lightsUp ? 1 : 0;
    P.ownColor[i] = d.option === 'color' ? (d.dimOwnColor ? 2 : 1) : 0;
    P.lifeIsElement[i] = d.option === 'element' || d.key === 'clone' ? 1 : 0;
    P.light[i] =
      d.light === 'pass' ? LIGHT_PASS : d.light === 'mirror/' ? LIGHT_SLASH : d.light === 'mirror\\' ? LIGHT_BACKSLASH : d.light === 'filter' ? LIGHT_FILTER : LIGHT_ABSORB;
    P.onLight[i] = d.onLight;
    if (d.option === 'color') P.defaultParam[i] = hexToRgb565(d.optionDefault ?? '#ff2020');
    else if (d.option === 'element' && d.optionDefault !== undefined) P.defaultParam[i] = ref(d.optionDefault, ctx);
    P.logic[i] = d.logic ? 1 : 0;
    P.emit[i] = d.radioactive?.emit ?? 0;
    P.decayHeat[i] = d.radioactive?.heat ?? 0;
    P.fissionChance[i] = d.fission?.chance ?? 0;
    P.fissionHeat[i] = d.fission?.heat ?? 0;
    P.fissionExcite[i] = d.fission?.excite ?? 0;
    P.radResp[i] =
      d.radiation === 'block' ? RAD_BLOCK : d.radiation === 'kill' ? RAD_KILL : d.radiation === 'moderate' ? RAD_MODERATE : d.radiation === 'mutate' ? RAD_MUTATE : d.radiation === 'feed' ? RAD_FEED : RAD_NONE;
    P.windFactor[i] =
      d.windFactor ??
      (d.state === 'gas'
        ? 1
        : d.state === 'powder'
          ? d.density <= 60 ? 0.6 : d.density <= 130 ? 0.2 : d.density <= 170 ? 0.03 : 0
          : d.state === 'liquid'
            ? 0.08
            : 0);
    P.actTemp[i] = Math.min(P.burnIgnite[i], P.explIgnite[i]);

    const sh = shades(d.color);
    for (let k = 0; k < 4; k++) P.colors[i * 4 + k] = sh[k];
  });

  // Reactions: register each declared one, then mirror it for the partner
  // if the partner didn't declare its own reaction with this element.
  const declared: [number, number, ReturnType<typeof resolve>][] = [];
  function resolve(r: NonNullable<ElementDef['reactions']>[string], ctx: string) {
    return {
      into: r.into !== undefined ? ref(r.into, ctx) : -1,
      otherInto: r.otherInto !== undefined ? ref(r.otherInto, ctx) : -1,
      chance: r.chance,
    };
  }
  ELEMENTS.forEach((d, a) => {
    if (!d.reactions) return;
    for (const [otherKey, r] of Object.entries(d.reactions)) {
      const b = ref(otherKey, `reaction of "${d.key}"`);
      declared.push([a, b, resolve(r, `reaction of "${d.key}"`)]);
    }
  });
  for (const [a, b, r] of declared) {
    P.reactTable[a * n + b] = P.reactions.length;
    P.reactions.push(r);
    P.hasReactions[a] = 1;
  }
  for (const [a, b, r] of declared) {
    if (P.reactTable[b * n + a] !== -1) continue;
    P.reactTable[b * n + a] = P.reactions.length;
    P.reactions.push({ into: r.otherInto, otherInto: r.into, chance: r.chance });
    P.hasReactions[b] = 1;
  }
}

build();

/** Elements shown in the palette. */
export function paletteElements(category: Category): ElementDef[] {
  return ELEMENTS.filter((d) => d.category === category);
}

export { ID, P };
