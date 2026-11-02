/** Small, fast xorshift32 PRNG so simulations are reproducible in tests. */
export class Rng {
  private s: number;

  constructor(seed = 0x9e3779b9) {
    this.s = seed >>> 0 || 1;
  }

  /** Float in [0, 1). */
  next(): number {
    let x = this.s;
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    this.s = x >>> 0;
    return this.s / 4294967296;
  }

  /** Integer in [0, n). */
  int(n: number): number {
    return (this.next() * n) | 0;
  }
}
