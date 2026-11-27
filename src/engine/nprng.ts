// Gradient Gen - Copyright (c) 2026 AK Nihad (Nihad Square). All rights reserved.
// Source-available, not open source: see LICENSE. Copying or reuse is not permitted without written permission.
// Bit-exact ports of the random generators the desktop app uses, so a seed gives the same picture:
//   PyRandom     = Python's random.Random(int)            (Voronoi points)
//   RandomState  = NumPy's legacy np.random.RandomState   (Perlin noise)
//   Generator    = NumPy's np.random.default_rng(seed)    (PCG64 + SeedSequence: everything else)
// Checked against the real thing in tests/rng.test.ts (fixtures made with NumPy 2.x / Python 3.12).

// ── Mersenne Twister (MT19937) ────────────────────────────────────────────
class MT19937 {
  protected mt = new Uint32Array(624);
  protected idx = 625;
  protected initGenrand(s: number) {
    const mt = this.mt;
    mt[0] = s >>> 0;
    for (let i = 1; i < 624; i++) mt[i] = (Math.imul(1812433253, mt[i - 1] ^ (mt[i - 1] >>> 30)) + i) >>> 0;
    this.idx = 624;
  }
  protected initByArray(key: number[]) {
    const mt = this.mt;
    this.initGenrand(19650218);
    let i = 1, j = 0;
    for (let k = Math.max(624, key.length); k > 0; k--) {
      mt[i] = ((mt[i] ^ Math.imul(mt[i - 1] ^ (mt[i - 1] >>> 30), 1664525)) + key[j] + j) >>> 0;
      i++; j++;
      if (i >= 624) { mt[0] = mt[623]; i = 1; }
      if (j >= key.length) j = 0;
    }
    for (let k = 623; k > 0; k--) {
      mt[i] = ((mt[i] ^ Math.imul(mt[i - 1] ^ (mt[i - 1] >>> 30), 1566083941)) - i) >>> 0;
      i++;
      if (i >= 624) { mt[0] = mt[623]; i = 1; }
    }
    mt[0] = 0x80000000;
    this.idx = 624;
  }
  next32(): number {
    const mt = this.mt;
    if (this.idx >= 624) {
      let k = 0;
      for (; k < 624 - 397; k++) { const y = (mt[k] & 0x80000000) | (mt[k + 1] & 0x7fffffff); mt[k] = mt[k + 397] ^ (y >>> 1) ^ (y & 1 ? 0x9908b0df : 0); }
      for (; k < 623; k++) { const y = (mt[k] & 0x80000000) | (mt[k + 1] & 0x7fffffff); mt[k] = mt[k + 397 - 624] ^ (y >>> 1) ^ (y & 1 ? 0x9908b0df : 0); }
      const y = (mt[623] & 0x80000000) | (mt[0] & 0x7fffffff);
      mt[623] = mt[396] ^ (y >>> 1) ^ (y & 1 ? 0x9908b0df : 0);
      this.idx = 0;
    }
    let y = mt[this.idx++];
    y ^= y >>> 11; y ^= (y << 7) & 0x9d2c5680; y ^= (y << 15) & 0xefc60000; y ^= y >>> 18;
    return y >>> 0;
  }
  /** 53-bit double in [0, 1) (Python's random.random and NumPy's random_sample) */
  random(): number {
    const a = this.next32() >>> 5, b = this.next32() >>> 6;
    return (a * 67108864 + b) / 9007199254740992;
  }
}

/** random.Random(int) */
export class PyRandom extends MT19937 {
  constructor(seed: number) {
    super();
    let n = Math.abs(Math.floor(seed));
    const key: number[] = [];
    do { key.push(n % 4294967296); n = Math.floor(n / 4294967296); } while (n > 0);
    this.initByArray(key);
  }
}

/** np.random.RandomState(int) */
export class RandomState extends MT19937 {
  constructor(seed: number) {
    super();
    this.initGenrand(seed >>> 0);
  }
  private interval(max: number): number {
    if (max === 0) return 0;
    let mask = max;
    mask |= mask >>> 1; mask |= mask >>> 2; mask |= mask >>> 4; mask |= mask >>> 8; mask |= mask >>> 16;
    mask >>>= 0;
    let v: number;
    while ((v = (this.next32() & mask) >>> 0) > max);
    return v;
  }
  /** np.random.RandomState.permutation(n) */
  permutation(n: number): number[] {
    const a = Array.from({ length: n }, (_, i) => i);
    for (let i = n - 1; i > 0; i--) { const j = this.interval(i); const t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  }
  uniform(lo: number, hi: number): number { return lo + (hi - lo) * this.random(); }
}

// ── PCG64 with NumPy's SeedSequence ───────────────────────────────────────
const M0 = 0x9fccf645, M1 = 0x4385df64, M2 = 0x1fc65da4, M3 = 0x2360ed05; // PCG default 128-bit multiplier (low to high)
const T32 = 4294967296;

/** 32 x 32 -> 64 bit product as [hi, lo] */
function mul32(a: number, b: number, out: Uint32Array) {
  const a0 = a & 0xffff, a1 = a >>> 16, b0 = b & 0xffff, b1 = b >>> 16;
  const p00 = a0 * b0, p01 = a0 * b1, p10 = a1 * b0, p11 = a1 * b1;
  const mid = (p00 >>> 16) + (p01 & 0xffff) + (p10 & 0xffff);
  out[0] = (p11 + (p01 >>> 16) + (p10 >>> 16) + (mid >>> 16)) >>> 0;
  out[1] = (((mid & 0xffff) << 16) | (p00 & 0xffff)) >>> 0;
}

function seedSequenceWords(entropy: number): Uint32Array {
  // _coerce_to_uint32_array for an int: little-endian 32-bit words
  const ent: number[] = [];
  let n = Math.floor(entropy);
  do { ent.push(n % T32); n = Math.floor(n / T32); } while (n > 0);
  const INIT_A = 0x43b0d7e5, MULT_A = 0x931e8875, INIT_B = 0x8b51f9dd, MULT_B = 0x58f38ded, MIX_L = 0xca01f9dd, MIX_R = 0x4973f715;
  let hc = INIT_A;
  const hashmix = (v: number) => { v = (v ^ hc) >>> 0; hc = Math.imul(hc, MULT_A) >>> 0; v = Math.imul(v, hc) >>> 0; return (v ^ (v >>> 16)) >>> 0; };
  const mix = (x: number, y: number) => { const r = (Math.imul(MIX_L, x) - Math.imul(MIX_R, y)) >>> 0; return (r ^ (r >>> 16)) >>> 0; };
  const pool = new Uint32Array(4);
  for (let i = 0; i < 4; i++) pool[i] = hashmix(i < ent.length ? ent[i] : 0);
  for (let s = 0; s < 4; s++) for (let d = 0; d < 4; d++) if (s !== d) pool[d] = mix(pool[d], hashmix(pool[s]));
  for (let s = 4; s < ent.length; s++) for (let d = 0; d < 4; d++) pool[d] = mix(pool[d], hashmix(ent[s]));
  // generate_state(4, uint64) = 8 x uint32
  hc = INIT_B;
  const out = new Uint32Array(8);
  for (let i = 0; i < 8; i++) {
    let v = (pool[i % 4] ^ hc) >>> 0;
    hc = Math.imul(hc, MULT_B) >>> 0;
    v = Math.imul(v, hc) >>> 0;
    out[i] = (v ^ (v >>> 16)) >>> 0;
  }
  return out;
}

/** np.random.default_rng(int) */
export class Generator {
  private s = new Uint32Array(4); // 128-bit state, low to high
  private inc = new Uint32Array(4);
  private has32 = false;
  private buf32 = 0;
  private t = new Uint32Array(2);

  constructor(seed: number) {
    const w = seedSequenceWords(seed);
    const initstate = [w[2], w[3], w[0], w[1]], initseq = [w[6], w[7], w[4], w[5]];
    // inc = (initseq << 1) | 1
    const inc = this.inc;
    inc[0] = ((initseq[0] << 1) | 1) >>> 0;
    inc[1] = ((initseq[1] << 1) | (initseq[0] >>> 31)) >>> 0;
    inc[2] = ((initseq[2] << 1) | (initseq[1] >>> 31)) >>> 0;
    inc[3] = ((initseq[3] << 1) | (initseq[2] >>> 31)) >>> 0;
    this.s.set(inc);                    // state = 0 * M + inc
    let c = 0;                          // state += initstate
    for (let i = 0; i < 4; i++) { const sum = this.s[i] + initstate[i] + c; this.s[i] = sum >>> 0; c = sum >= T32 ? 1 : 0; }
    this.step();
  }

  private step() {
    const s = this.s, t = this.t, inc = this.inc;
    const a0 = s[0], a1 = s[1], a2 = s[2], a3 = s[3];
    mul32(a0, M0, t); const h00 = t[0], l00 = t[1];
    mul32(a0, M1, t); const h01 = t[0], l01 = t[1];
    mul32(a1, M0, t); const h10 = t[0], l10 = t[1];
    mul32(a0, M2, t); const h02 = t[0], l02 = t[1];
    mul32(a1, M1, t); const h11 = t[0], l11 = t[1];
    mul32(a2, M0, t); const h20 = t[0], l20 = t[1];
    const l03 = Math.imul(a0, M3) >>> 0, l12 = Math.imul(a1, M2) >>> 0, l21 = Math.imul(a2, M1) >>> 0, l30 = Math.imul(a3, M0) >>> 0;
    let v = l00 + inc[0];
    const r0 = v % T32; let c = Math.floor(v / T32);
    v = h00 + l01 + l10 + inc[1] + c;
    const r1 = v % T32; c = Math.floor(v / T32);
    v = h01 + h10 + l02 + l11 + l20 + inc[2] + c;
    const r2 = v % T32; c = Math.floor(v / T32);
    v = h02 + h11 + h20 + l03 + l12 + l21 + l30 + inc[3] + c;
    s[0] = r0; s[1] = r1; s[2] = r2; s[3] = v % T32;
  }

  /** next 64 bits as [hi, lo] in this.t */
  private next64(): void {
    this.step();
    const s = this.s;
    const xl = (s[2] ^ s[0]) >>> 0, xh = (s[3] ^ s[1]) >>> 0, rot = s[3] >>> 26;
    let hi = xh, lo = xl, r = rot;
    if (r >= 32) { const tmp = hi; hi = lo; lo = tmp; r -= 32; }
    if (r > 0) { const nh = ((hi >>> r) | (lo << (32 - r))) >>> 0, nl = ((lo >>> r) | (hi << (32 - r))) >>> 0; hi = nh; lo = nl; }
    this.t[0] = hi; this.t[1] = lo;
  }

  nextU32(): number {
    if (this.has32) { this.has32 = false; return this.buf32; }
    this.next64();
    this.has32 = true; this.buf32 = this.t[0];
    return this.t[1];
  }

  /** double in [0, 1) */
  random(): number {
    this.next64();
    return (this.t[0] * 2097152 + (this.t[1] >>> 11)) / 9007199254740992;
  }
  /** np.random.random(dtype=float32): 24-bit steps */
  float32(): number { return (this.nextU32() >>> 8) * (1 / 16777216); }
  uniform(lo: number, hi: number): number { return lo + (hi - lo) * this.random(); }

  /** integers(lo, hi): hi is exclusive (Lemire's method on 32 bits, like NumPy) */
  integers(lo: number, hi: number): number {
    const rng = hi - lo - 1;
    if (rng <= 0) return lo;
    const excl = rng + 1, t = this.t;
    mul32(this.nextU32(), excl, t);
    let h = t[0], l = t[1];
    if (l < excl) {
      const thr = (4294967295 - rng) % excl;
      while (l < thr) { mul32(this.nextU32(), excl, t); h = t[0]; l = t[1]; }
    }
    return lo + h;
  }

  private interval(max: number): number {
    if (max === 0) return 0;
    let mask = max;
    mask |= mask >>> 1; mask |= mask >>> 2; mask |= mask >>> 4; mask |= mask >>> 8; mask |= mask >>> 16;
    mask >>>= 0;
    let v: number;
    while ((v = (this.nextU32() & mask) >>> 0) > max);
    return v;
  }
  /** in-place Fisher-Yates like Generator.shuffle */
  shuffle<T>(a: T[]): T[] {
    for (let i = a.length - 1; i > 0; i--) { const j = this.interval(i); const x = a[i]; a[i] = a[j]; a[j] = x; }
    return a;
  }
  permutation(n: number): number[] { return this.shuffle(Array.from({ length: n }, (_, i) => i)); }
}
