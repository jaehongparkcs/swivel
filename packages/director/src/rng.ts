/** Small deterministic PRNG (mulberry32) so slates replay identically from a seed. */
export type Rng = () => number;

export function makeRng(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function pick<T>(rng: Rng, items: readonly T[]): T {
  return items[Math.floor(rng() * items.length)];
}

/** Sample from weighted outcomes. */
export function weighted<T>(rng: Rng, outcomes: ReadonlyArray<readonly [T, number]>): T {
  const total = outcomes.reduce((s, [, w]) => s + w, 0);
  let r = rng() * total;
  for (const [v, w] of outcomes) {
    r -= w;
    if (r <= 0) return v;
  }
  return outcomes[outcomes.length - 1][0];
}

export function between(rng: Rng, lo: number, hi: number): number {
  return lo + (hi - lo) * rng();
}
