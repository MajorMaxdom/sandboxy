import type { UpdateFn } from '../sim/types';

export const EMPTY = 0;
export const STATIC = 1;
export const POWDER = 2;
export const LIQUID = 3;
export const GAS = 4;

/** Electric charge of a freshly powered conductor; counts down each tick. */
export const CHARGE_MAX = 6;

export const RAD_NONE = 0;
export const RAD_BLOCK = 1;
export const RAD_KILL = 2;
export const RAD_MODERATE = 3;
export const RAD_MUTATE = 4;
export const RAD_FEED = 5;

/** Density of air; gases lighter than this rise, heavier ones sink. */
export const AIR_DENSITY = 10;

export interface ResolvedReaction {
  into: number; // -1 = unchanged
  otherInto: number;
  chance: number;
}

/**
 * Flattened, typed-array view of all element properties, indexed by element id.
 * Filled in once by the registry; hot simulation loops read from here.
 */
export const P = {
  n: 0,
  state: new Uint8Array(0),
  density: new Float32Array(0),
  dispersion: new Uint8Array(0),
  viscosity: new Float32Array(0),
  hasTemp: new Uint8Array(0),
  defaultTemp: new Float32Array(0),
  cond: new Float32Array(0),
  cap: new Float32Array(0),
  cool: new Float32Array(0),
  tHigh: new Float32Array(0),
  toHigh: new Int16Array(0),
  tLow: new Float32Array(0),
  toLow: new Int16Array(0),
  byproduct: new Int16Array(0),
  transChance: new Float32Array(0),
  burnIgnite: new Float32Array(0),
  burnChance: new Float32Array(0),
  burnHeat: new Float32Array(0),
  burnSpread: new Float32Array(0),
  burnInto: [] as number[][],
  explIgnite: new Float32Array(0),
  explRadius: new Float32Array(0),
  conducts: new Uint8Array(0),
  resist: new Float32Array(0),
  lightsUp: new Uint8Array(0),
  logic: new Uint8Array(0),
  emit: new Float32Array(0),
  decayHeat: new Float32Array(0),
  fissionChance: new Float32Array(0),
  fissionHeat: new Float32Array(0),
  fissionExcite: new Float32Array(0),
  /** RAD_NONE / RAD_BLOCK / RAD_KILL / RAD_MODERATE */
  radResp: new Uint8Array(0),
  windFactor: new Float32Array(0),
  /** Never settles (gases, decaying or self-updating elements): keeps its chunk awake. */
  restless: new Uint8Array(0),
  /** Temperature at which a resting cell must be woken (burns or explodes). */
  actTemp: new Float32Array(0),
  decays: new Uint8Array(0),
  lifeMin: new Uint16Array(0),
  lifeMax: new Uint16Array(0),
  decayInto: [] as number[][],
  glow: new Uint8Array(0),
  indestructible: new Uint8Array(0),
  acidProof: new Uint8Array(0),
  paintChance: new Float32Array(0),
  hasReactions: new Uint8Array(0),
  update: [] as (UpdateFn | undefined)[],
  /** 4 shades per element, packed as little-endian ABGR for ImageData. */
  colors: new Uint32Array(0),
  /** reactTable[a * n + b] = index into reactions, or -1. */
  reactTable: new Int32Array(0),
  reactions: [] as ResolvedReaction[],
};
