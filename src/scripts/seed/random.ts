// Small seeded pseudo-random generator (mulberry32). Same seed → same sequence,
// so every `npm run seed` produces the same data shape and statistics without
// pulling in a faker dependency. (Individual rows can differ between days:
// dates are relative to "now", and date sampling consumes a varying number of
// random draws.)
export function createRandom(seed: number) {
  let state = seed >>> 0;

  const next = (): number => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  return {
    next,
    /** Integer in [min, max], inclusive. */
    int: (min: number, max: number) => min + Math.floor(next() * (max - min + 1)),
    pick: <T>(items: readonly T[]): T => items[Math.floor(next() * items.length)]!,
    chance: (probability: number) => next() < probability,
    /** Picks an item with probability proportional to its weight. */
    weighted: <T>(entries: readonly (readonly [T, number])[]): T => {
      const total = entries.reduce((sum, [, w]) => sum + w, 0);
      let roll = next() * total;
      for (const [item, weight] of entries) {
        roll -= weight;
        if (roll < 0) return item;
      }
      return entries[entries.length - 1]![0];
    },
    digits: (count: number) => Array.from({ length: count }, () => Math.floor(next() * 10)).join(''),
  };
}

export type Random = ReturnType<typeof createRandom>;
