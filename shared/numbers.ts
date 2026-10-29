export const clamp = (x: number, min = 0, max = 1) => Math.min(max, Math.max(min, x));

export const round = (x: number) => Math.round(x * 1000) / 1000;

export function seeded(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function weighted(weights: number[], random: () => number) {
  const total = weights.reduce((a, b) => a + b, 0);
  let r = random() * total;
  for (const [i, w] of weights.entries()) if ((r -= w) < 0) return i;
  return weights.length - 1;
}
