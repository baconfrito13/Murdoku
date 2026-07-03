// Seeded PRNG (mulberry32) + helpers, so cases are reproducible.

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashSeed(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export class Rng {
  constructor(seed) {
    this.next = mulberry32(typeof seed === 'string' ? hashSeed(seed) : seed >>> 0);
  }
  float() {
    return this.next();
  }
  int(maxExclusive) {
    return Math.floor(this.next() * maxExclusive);
  }
  range(min, maxInclusive) {
    return min + this.int(maxInclusive - min + 1);
  }
  pick(arr) {
    return arr[this.int(arr.length)];
  }
  shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = this.int(i + 1);
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }
  chance(p) {
    return this.next() < p;
  }
}
