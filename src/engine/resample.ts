// Pillow's Image.resize(..., BICUBIC) for float images (one channel), so enlarged noise looks like the desktop version.

function cubic(x: number): number {
  const a = -0.5;
  x = Math.abs(x);
  if (x < 1) return ((a + 2) * x - (a + 3)) * x * x + 1;
  if (x < 2) return (((x - 5) * x + 8) * x - 4) * a;
  return 0;
}

interface Coeffs { bounds: Int32Array; k: Float64Array; ksize: number }

function precompute(inSize: number, outSize: number): Coeffs {
  const scale = inSize / outSize;
  const filterScale = Math.max(scale, 1);
  const support = 2 * filterScale;
  const ksize = Math.ceil(support) * 2 + 1;
  const k = new Float64Array(outSize * ksize);
  const bounds = new Int32Array(outSize * 2);
  const ss = 1 / filterScale;
  for (let xx = 0; xx < outSize; xx++) {
    const center = (xx + 0.5) * scale;
    let xmin = Math.trunc(center - support + 0.5);
    if (xmin < 0) xmin = 0;
    let xmax = Math.trunc(center + support + 0.5);
    if (xmax > inSize) xmax = inSize;
    xmax -= xmin;
    let ww = 0;
    for (let x = 0; x < xmax; x++) {
      const w = cubic((x + xmin - center + 0.5) * ss);
      k[xx * ksize + x] = w;
      ww += w;
    }
    if (ww !== 0) for (let x = 0; x < xmax; x++) k[xx * ksize + x] /= ww;
    bounds[xx * 2] = xmin;
    bounds[xx * 2 + 1] = xmax;
  }
  return { bounds, k, ksize };
}

/** horizontal pass first, then vertical (as Pillow does) */
export function bicubicResize(src: Float32Array, sw: number, sh: number, dw: number, dh: number): Float32Array {
  if (sw === dw && sh === dh) return src;
  let cur = src, cw = sw;
  if (dw !== sw) {
    const c = precompute(sw, dw);
    const out = new Float32Array(dw * sh);
    for (let y = 0; y < sh; y++) {
      const row = y * sw;
      for (let x = 0; x < dw; x++) {
        const xmin = c.bounds[x * 2], n = c.bounds[x * 2 + 1], kb = x * c.ksize;
        let acc = 0;
        for (let i = 0; i < n; i++) acc += cur[row + xmin + i] * c.k[kb + i];
        out[y * dw + x] = acc;
      }
    }
    cur = out;
    cw = dw;
  }
  if (dh !== sh) {
    const c = precompute(sh, dh);
    const out = new Float32Array(cw * dh);
    for (let y = 0; y < dh; y++) {
      const ymin = c.bounds[y * 2], n = c.bounds[y * 2 + 1], kb = y * c.ksize;
      for (let x = 0; x < cw; x++) {
        let acc = 0;
        for (let i = 0; i < n; i++) acc += cur[(ymin + i) * cw + x] * c.k[kb + i];
        out[y * cw + x] = acc;
      }
    }
    cur = out;
  }
  return cur;
}
