/**
 * Deterministic sample data. Everything a part shows that the user did not
 * type comes from here, seeded by the part's contents, so the board, the live
 * preview and the generated site all show the same numbers.
 */

/** FNV-1a. */
export function hash(str: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** mulberry32. */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pick = <T,>(r: () => number, xs: readonly T[]): T => xs[Math.floor(r() * xs.length)]!;

const FIRST = ["Ada", "Ravi", "Mina", "Theo", "Sol", "Ines", "Kai", "Nora", "Idris", "Yara", "Leo", "Zia"];
const LAST = ["Okafor", "Lindqvist", "Marsh", "Tanaka", "Reyes", "Novak", "Adeyemi", "Byrne", "Costa", "Halvorsen"];
const WORDS = ["clear", "steady", "quiet", "bright", "warm", "quick", "plain", "deep", "open", "sharp", "soft", "wide"];
const NOUNS = ["signal", "harbour", "ledger", "orbit", "meadow", "compass", "lantern", "thread", "summit", "canvas"];
const STATUS = ["Active", "Pending", "Done", "Paused"];

export const sample = {
  int(r: () => number, min: number, max: number): number {
    return min + Math.floor(r() * (max - min + 1));
  },
  name(r: () => number): string {
    return `${pick(r, FIRST)} ${pick(r, LAST)}`;
  },
  word(r: () => number): string {
    return `${pick(r, WORDS)} ${pick(r, NOUNS)}`;
  },
  sentence(r: () => number, words = 9): string {
    const parts: string[] = [];
    for (let i = 0; i < words; i++) parts.push(i % 2 ? pick(r, NOUNS) : pick(r, WORDS));
    const s = parts.join(" ");
    return s.charAt(0).toUpperCase() + s.slice(1) + ".";
  },
  /** A short answer that sounds like it belongs under `title`. */
  answer(title: string): string {
    const r = rng(hash(title));
    return `${title.replace(/[?:.]+$/, "")} is ${pick(r, WORDS)} and ${pick(r, WORDS)}: ${this.sentence(r, 7)}`;
  },
  /** A price-like number with two decimals, as a string. */
  money(r: () => number, min = 8, max = 240): string {
    return (min + r() * (max - min)).toFixed(2);
  },
  /** Rows for a table. Column names steer the kind of value in each cell. */
  rows(columns: string[], n: number, seed: string): Record<string, string>[] {
    const r = rng(hash(seed + "|" + columns.join("|")));
    const out: Record<string, string>[] = [];
    for (let i = 0; i < n; i++) {
      const row: Record<string, string> = {};
      for (const c of columns) {
        const k = c.toLowerCase();
        row[c] =
          /name|player|customer|owner|author|user/.test(k) ? this.name(r)
          : /status|state/.test(k) ? pick(r, STATUS)
          : /amount|price|revenue|total|cost|\$/.test(k) ? "$" + this.money(r)
          : /date|updated|when|created/.test(k) ? `${this.int(r, 1, 28)} ${pick(r, ["Jan", "Feb", "Mar", "Apr", "May", "Jun"])}`
          : /score|rank|users|orders|count|qty|views|#/.test(k) ? String(this.int(r, 1, 9800))
          : /email|mail/.test(k) ? `${pick(r, FIRST).toLowerCase()}@example.com`
          : /id/.test(k) ? `#${1000 + i}`
          : this.word(r);
      }
      out.push(row);
    }
    return out;
  },
  /** A smooth-ish series of n values between 0 and 100. */
  series(n: number, seed: string): number[] {
    const r = rng(hash(seed));
    const out: number[] = [];
    let v = 40 + r() * 20;
    for (let i = 0; i < n; i++) {
      v = Math.max(4, Math.min(96, v + (r() - 0.48) * 18));
      out.push(Math.round(v));
    }
    return out;
  },
  products(names: string[], seed: string): { name: string; price: string; tag: string }[] {
    const r = rng(hash(seed));
    return names.map((name) => ({ name, price: "$" + this.money(r), tag: pick(r, ["New", "Popular", "Limited", "Classic"]) }));
  },
  people(n: number, seed: string): { name: string; role: string; initials: string }[] {
    const r = rng(hash(seed));
    return Array.from({ length: n }, () => {
      const name = this.name(r);
      return { name, role: pick(r, ["Design", "Engineering", "Support", "Founder", "Community"]), initials: name.split(" ").map((x) => x[0]).join("") };
    });
  },
};
