import { describe, expect, it } from "vitest";
import { Generator, PyRandom, RandomState } from "../src/engine/nprng";
import fixtures from "./rng.fixtures.json";

type Fx = Record<string, Record<string, number[]>>;
const FX = fixtures as unknown as Fx;
const close = (a: number[], b: number[]) => { expect(a.length).toBe(b.length); a.forEach((v, i) => expect(v).toBeCloseTo(b[i], 14)); };
const f32 = (a: number[]) => a.map((v) => v);

describe("random generators match NumPy and Python bit for bit", () => {
  for (const seed of Object.keys(FX)) {
    const fx = FX[seed], s = Number(seed);
    it(`PCG64 default_rng(${seed})`, () => {
      let g = new Generator(s); close(Array.from({ length: 6 }, () => g.random()), fx.pcg_random);
      g = new Generator(s); close(Array.from({ length: 3 }, () => g.uniform(-1, 1)), fx.pcg_uniform);
      g = new Generator(s);
      expect([...Array.from({ length: 6 }, () => g.integers(0, 1080)), ...Array.from({ length: 8 }, () => g.integers(-15, 16))]).toEqual(fx.pcg_integers);
      g = new Generator(s);
      expect([g.random(), g.integers(0, 7), g.random(), g.integers(-3, 4), g.random()]).toEqual([fx.pcg_mix[0], fx.pcg_mix[1], fx.pcg_mix[2], fx.pcg_mix[3], fx.pcg_mix[4]]);
      g = new Generator(s);
      const vals = g.shuffle(Array.from({ length: 9 }, (_, i) => i / 8));
      close(vals, fx.pcg_perm);
      g = new Generator(s); close(Array.from({ length: 6 }, () => g.float32()), f32(fx.pcg_f32));
      g = new Generator(s); close([g.float32(), g.float32(), g.float32(), g.random()], fx.pcg_f32_then_f64);
      g = new Generator(s);
      expect([...Array.from({ length: 3 }, () => g.integers(-5, 6)), ...Array.from({ length: 3 }, () => g.integers(-5, 6))]).toEqual(fx.pcg_two_fills);
    });
    if (fx.rs_perm) it(`legacy RandomState(${seed})`, () => {
      let r = new RandomState(s); expect(r.permutation(256).slice(0, 24)).toEqual(fx.rs_perm);
      r = new RandomState(s); r.permutation(256); close(Array.from({ length: 6 }, () => r.uniform(0, 2 * Math.PI)), fx.rs_uniform);
    });
    it(`Python random.Random(${s + 11})`, () => {
      const p = new PyRandom(s + 11); close(Array.from({ length: 6 }, () => p.random()), fx.py_random);
    });
  }
});
