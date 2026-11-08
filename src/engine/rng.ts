/** Small seeded random generator (mulberry32). Same seed = same picture, in preview and in export. */
export class Rng {
  private s: number;
  constructor(seed: number) {
    this.s = (Math.floor(seed) >>> 0) || 0x9e3779b9;
  }
  /** float in [0, 1) */
  random(): number {
    this.s = (this.s + 0x6d2b79f5) >>> 0;
    let t = this.s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  uniform(lo: number, hi: number): number {
    return lo + (hi - lo) * this.random();
  }
  /** integer in [lo, hi) */
  int(lo: number, hi?: number): number {
    if (hi === undefined) {
      hi = lo;
      lo = 0;
    }
    return lo + Math.floor(this.random() * (hi - lo));
  }
  pick<T>(list: readonly T[]): T {
    return list[this.int(list.length)];
  }
  /** Fisher-Yates shuffle of 0..n-1 */
  permutation(n: number): number[] {
    const a = Array.from({ length: n }, (_, i) => i);
    for (let i = n - 1; i > 0; i--) {
      const j = this.int(i + 1);
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }
}

export function randomSeed(): number {
  return Math.floor(Math.random() * 2 ** 31);
}
