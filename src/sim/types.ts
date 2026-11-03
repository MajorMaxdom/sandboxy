import type { Simulation } from './simulation';

export type State = 'empty' | 'static' | 'powder' | 'liquid' | 'gas';

export type Category =
  | 'land'
  | 'solids'
  | 'metals'
  | 'liquids'
  | 'gases'
  | 'energy'
  | 'tech'
  | 'logic'
  | 'nuclear'
  | 'life'
  | 'explosives'
  | 'special';

/** Element key, or 'empty' to leave nothing behind. */
export type ElementKey = string;

export interface Reaction {
  /** What this cell turns into (undefined = unchanged). */
  into?: ElementKey;
  /** What the neighbouring cell turns into (undefined = unchanged). */
  otherInto?: ElementKey;
  /** Probability per tick when touching. */
  chance: number;
}

/**
 * Special per-element behaviour. Return true if the cell was consumed/moved
 * and the rest of this tick's processing should be skipped.
 */
export type UpdateFn = (sim: Simulation, i: number, x: number, y: number) => boolean | void;

export interface ElementDef {
  key: ElementKey;
  label: string;
  category: Category | 'hidden';
  /** One or more hex colors; up to 4 shades are derived. */
  color: string | string[];
  state: State;
  /** Heavier things sink through lighter liquids/gases. Air is 10. */
  density: number;
  description?: string;

  /** Liquids: how far they spread sideways per tick. */
  dispersion?: number;
  /** Liquids: chance (0..1) to skip sideways flow in a tick. */
  viscosity?: number;

  /** Temperature when painted, and a floor/ceiling when created by a reaction. */
  defaultTemp?: number;
  /** Heat conduction 0..1 (default 0.3). */
  conductivity?: number;
  /** Heat capacity >= 1 (default 1). Higher = changes temperature slower. */
  heatCap?: number;
  /** Rate at which it drifts back to ambient temperature (default 0.0005). */
  cooling?: number;

  tempHigh?: number;
  stateHigh?: ElementKey;
  tempLow?: number;
  stateLow?: ElementKey;
  /** Spawned into a free neighbour on the high transition (e.g. salt water → salt + steam). */
  highByproduct?: ElementKey;
  /** Chance per tick to transition once past the threshold (default 0.2). */
  transitionChance?: number;

  burn?: {
    /** Temperature at which it catches fire. */
    ignite: number;
    /** Chance per tick to be consumed while burning. */
    chance: number;
    /** What it burns into (default fire). */
    into?: ElementKey | ElementKey[];
    /** Max temperature it heats itself to while burning (default 600). */
    heat?: number;
    /** Chance per tick to throw flames into a free neighbour (default 0.3). */
    spread?: number;
  };

  explode?: { ignite: number; radius: number };

  /** Conducts electricity. */
  conducts?: boolean;
  /** Self-heating per electric pulse passing through (default 1). */
  resistance?: number;
  /** Rendered with its own colors instead of the generic "charged" yellow (lamps). */
  lightsUp?: boolean;
  /** Logic component: never heated by passing current, may receive gate signals. */
  logic?: boolean;

  /** Emits radiation: chance per tick, plus self-heating per tick (decay heat). */
  radioactive?: { emit: number; heat?: number };
  /**
   * Fissile: a radiation hit splits it with `chance`, adding `heat` and
   * `excite` to its excitation counter (stored in `life`), which makes it
   * emit more radiation over the next ticks — that's the chain reaction.
   */
  fission?: { chance: number; heat: number; excite: number };
  /** How it reacts to radiation: block it, die from it, or slow it down. */
  radiation?: 'block' | 'kill' | 'moderate' | 'mutate' | 'feed';
  /** How strongly wind pushes it (default derived from state and density). */
  windFactor?: number;

  /** Dies after a random number of ticks in this range. */
  lifespan?: [number, number];
  decayInto?: ElementKey | ElementKey[];
  /** Initial value for the `life` counter without decay (growth budget etc.). */
  initLife?: [number, number];

  reactions?: Record<ElementKey, Reaction>;
  update?: UpdateFn;
  /**
   * The update only matters when something happens nearby (e.g. it checks a
   * temperature), so it doesn't keep the chunk awake on its own.
   */
  calm?: boolean;
  /**
   * Extra setting chosen in the toolbar and stored in `life` when painted:
   * 'color' = RGB565 color (lasers, filters, portal channels),
   * 'element' = element id (firework filling, converter, faucet),
   * 'level' = a strength 1–10 (fans).
   */
  option?: 'color' | 'element' | 'level';
  /** 'color' options: draw the cell in a darker version of its color (portal exits). */
  dimOwnColor?: boolean;
  /** Elements sharing this key share the chosen value (all lasers, both portal ends). */
  optionKey?: string;
  /** Toolbar label of the option (default "Farbe" / "Element"). */
  optionLabel?: string;
  /** Initial value: a hex color, an element key or a level ("5"). */
  optionDefault?: string;
  /** 'element' options: label for "no element" (life 0); without it, one must be chosen. */
  optionNone?: string;

  /**
   * What a laser beam does when it reaches this cell. Default: it's absorbed
   * and heats the cell. 'pass' = see-through, 'mirror/' and 'mirror\' turn
   * it by 90°, 'filter' lets through only its own color (stored in life).
   */
  light?: 'pass' | 'mirror/' | 'mirror\\' | 'filter';
  /** Called when a beam is absorbed here, instead of heating (sensors, solar cells). */
  onLight?: (sim: Simulation, i: number, x: number, y: number) => void;

  /** Flickers when rendered. */
  glow?: boolean;
  /** Survives explosions. */
  indestructible?: boolean;
  /** Acid can't dissolve it. */
  acidProof?: boolean;
  /** Probability to fill a free cell under the brush (default: 1 static, 0.5 otherwise). */
  paintChance?: number;
}
