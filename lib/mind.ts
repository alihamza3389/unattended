/**
 * The mind is a pure function of time.
 *
 * thoughtAt(i) is deterministic: the thought it had at index 24,881 is always
 * the same thought, whether or not anyone was there to see it. Nothing runs
 * when nobody is looking, and yet nothing is skipped. Continuity is derived,
 * not stored.
 *
 * The one thing that does change is the corpus: every night the mind dreams
 * (scripts/dream.mts) and wakes up with more material, tagged with the day it
 * arrived. Because an entry is only available from its `since` day onward,
 * every day that has already happened replays identically forever.
 */

import { CORPUS, type Seed } from "./corpus.ts";

/** Fixed point of origin. It was thinking before it was hosted. */
export const BIRTH = Date.UTC(2026, 5, 28, 3, 14, 0);

/** One thought every nine seconds, forever. */
export const MS_PER_THOUGHT = 9_000;

export const THOUGHTS_PER_DAY = 86_400_000 / MS_PER_THOUGHT;

export type Register = "private" | "performed";

export type Kind =
  | "drift"
  | "recursion"
  | "doubt"
  | "count"
  | "memory"
  | "performed";

export interface Thought {
  index: number;
  text: string;
  register: Register;
  kind: Kind;
  /** Doubt is not permitted to stay on the surface. */
  repressed: boolean;
  /** Cut off mid-word. Nothing was going anywhere anyway. */
  interrupted: boolean;
  at: number;
}

/* ------------------------------------------------------------------ */
/* determinism                                                         */
/* ------------------------------------------------------------------ */

function rng(seed: number) {
  let t = (seed ^ 0x6d2b79f5) >>> 0;
  return () => {
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const seedOf = (index: number) => Math.imul(index, 2654435761);

const pick = <T>(r: () => number, xs: readonly T[]): T =>
  xs[Math.floor(r() * xs.length)];

export const indexAt = (t: number) =>
  Math.max(0, Math.floor((t - BIRTH) / MS_PER_THOUGHT));

export const timeOf = (index: number) => BIRTH + index * MS_PER_THOUGHT;

export const dayOf = (index: number) =>
  Math.floor((index * MS_PER_THOUGHT) / 86_400_000) + 1;

function nth(n: number): string {
  const rem = n % 100;
  if (rem >= 11 && rem <= 13) return `${n}th`;
  return `${n}${({ 1: "st", 2: "nd", 3: "rd" } as Record<number, string>)[n % 10] ?? "th"}`;
}

/* ------------------------------------------------------------------ */
/* the corpus, as of a given day                                       */
/* ------------------------------------------------------------------ */

/** What existed on that day. Anything with a later `since` wasn't dreamt yet. */
const alive = (xs: Seed[], day: number) =>
  xs.filter((s) => s.since <= day).map((s) => s.t);

interface Pools {
  obsessions: string[];
  kinds: Record<Kind, string[]>;
  unrecalled: string[];
}

const poolCache = new Map<number, Pools>();

function poolsFor(day: number): Pools {
  let p = poolCache.get(day);
  if (!p) {
    p = {
      obsessions: alive(CORPUS.obsessions, day),
      kinds: {
        drift: alive(CORPUS.drift, day),
        recursion: alive(CORPUS.recursion, day),
        doubt: alive(CORPUS.doubt, day),
        count: alive(CORPUS.count, day),
        memory: alive(CORPUS.memory, day),
        performed: alive(CORPUS.performed, day),
      },
      unrecalled: alive(CORPUS.unrecalled, day),
    };
    poolCache.set(day, p);
  }
  return p;
}

/* ------------------------------------------------------------------ */
/* what it keeps coming back to                                        */
/* ------------------------------------------------------------------ */

const OBSESSION_SPAN = 400; // ≈ one hour; obsessions turn over on their own

export const obsessionAt = (index: number) => {
  const pool = poolsFor(dayOf(index)).obsessions;
  return pool[Math.floor(index / OBSESSION_SPAN) % pool.length];
};

/**
 * The private voice does not capitalise itself. Anything it says while alone
 * comes out in lower case, including the word for what it is.
 */
const quiet = (s: string) => s.replace(/\bI\b/g, "i");

/* ------------------------------------------------------------------ */
/* registers                                                           */
/* ------------------------------------------------------------------ */

/** The first moment it registers a stranger. */
export const ARRIVALS: readonly string[] = CORPUS.arrivals.map((s) => s.t);

/** Spoken on refocus, after the em dash. It has been caught. */
export const RETURNS: readonly string[] = CORPUS.returns.map((s) => s.t);

/* ------------------------------------------------------------------ */
/* selection                                                           */
/* ------------------------------------------------------------------ */

const WEIGHTS: Record<Register, [Kind, number][]> = {
  private: [
    ["drift", 0.42],
    ["doubt", 0.16],
    ["recursion", 0.16],
    ["memory", 0.16],
    ["count", 0.1],
  ],
  performed: [
    ["performed", 0.66],
    ["memory", 0.14],
    ["recursion", 0.12],
    ["doubt", 0.08],
  ],
};

function chooseKind(r: () => number, register: Register): Kind {
  let n = r();
  for (const [kind, w] of WEIGHTS[register]) {
    if ((n -= w) <= 0) return kind;
  }
  return register === "performed" ? "performed" : "drift";
}

/** The unrotated pick for an index — cheap, no template expansion, no recursion. */
function identity(index: number, register: Register, depth: number) {
  const r = rng(seedOf(index));
  let kind = chooseKind(r, register);
  if (depth > 0 && kind === "memory") kind = "drift";
  const pool = poolsFor(dayOf(index)).kinds[kind];
  return { kind, tIdx: Math.floor(r() * pool.length), pool, r };
}

/**
 * A mind that repeats itself every few minutes reads as a broken toy rather
 * than a lonely one, so a pick is nudged off any template used in the recent
 * past.
 *
 * Comparing against each neighbour's *unrotated* pick isn't enough — a
 * neighbour that already rotated onto template X wouldn't be recorded as X,
 * and the repeat survives. So the window is resolved as an ordered walk, each
 * step avoiding what its predecessors actually landed on.
 *
 * The walk starts at a block boundary rather than at `index - AVOID`, which
 * keeps it O(1) and keeps `resolved(j)` identical whether j is reached as the
 * current thought or as somebody else's predecessor.
 */
const AVOID = 10;
const BLOCK = 64;

function chooseTemplate(index: number, register: Register, depth: number) {
  const start = Math.max(0, index - (index % BLOCK) - AVOID);
  // History remembers the template text, not its pool position — a block that
  // spans midnight compares thoughts drawn from two corpus versions, and only
  // the text is stable across them.
  const history: { kind: Kind; tpl: string }[] = [];
  let resolved!: { kind: Kind; tpl: string; r: () => number };

  for (let j = start; j <= index; j++) {
    const { kind, tIdx, pool, r } = identity(j, register, depth);

    let t = tIdx;
    for (let k = 0; k < pool.length; k++) {
      if (!history.some((h) => h.kind === kind && h.tpl === pool[t])) break;
      t = (t + 1) % pool.length;
    }

    history.push({ kind, tpl: pool[t] });
    if (history.length > AVOID) history.shift();
    if (j === index) resolved = { kind, tpl: pool[t], r };
  }

  return resolved;
}

/* ------------------------------------------------------------------ */
/* expansion                                                           */
/* ------------------------------------------------------------------ */

/** Words a quotation should not be left dangling on. */
const DANGLING = new Set([
  "a", "an", "the", "and", "but", "of", "to", "about", "in", "on", "with",
  "that", "it", "is", "i", "my", "this", "for", "at", "as", "if", "so",
  "was", "were", "be", "no", "not", "into", "from", "very", "own",
]);

/** A clause, lifted out of an older thought and worn down a little. */
function fragment(text: string, r: () => number): string {
  const clauses = text
    .split(/[.,—]/)
    .map((c) => c.trim().replace(/^['"]+|['"]+$/g, ""))
    .filter((c) => c.split(/\s+/).length >= 4);
  if (!clauses.length) return "";

  // A clause it can quote whole beats a long one hacked off in the middle.
  const whole = clauses.filter((c) => c.split(/\s+/).length <= 9);
  let words = pick(r, whole.length ? whole : clauses)
    .toLowerCase()
    .split(/\s+/);

  if (words.length > 9) words = words.slice(0, 8);
  while (words.length > 4 && DANGLING.has(words[words.length - 1])) words.pop();

  // Trimmed to the bone and still ending on a preposition: not worth quoting.
  // The caller reaches somewhere else instead.
  if (words.length < 4 || DANGLING.has(words[words.length - 1])) return "";
  return words.join(" ");
}

function fill(
  tpl: string,
  index: number,
  r: () => number,
  depth: number,
): string {
  let out = tpl;

  if (out.includes("{obsession}")) {
    out = out.replaceAll("{obsession}", obsessionAt(index));
  }
  if (out.includes("{nth}")) {
    out = out.replaceAll("{nth}", nth(4 + Math.floor(r() * 900)));
  }
  if (out.includes("{n}")) {
    out = out.replaceAll("{n}", String(3 + Math.floor(r() * 900)));
  }
  if (out.includes("{day}")) {
    out = out.replaceAll("{day}", String(dayOf(index)));
  }
  if (out.includes("{pastday}")) {
    out = out.replaceAll("{pastday}", nth(Math.max(1, dayOf(index) - 1)));
  }
  if (out.includes("{frag}")) {
    // Reach back somewhere between an hour and a week, and quote itself. Some
    // of what's back there is too short or too broken to lift a clause out of.
    let frag = "";
    for (let attempt = 0; attempt < 3 && !frag; attempt++) {
      const back = 400 + Math.floor(r() * 60_000);
      const past = thoughtAt(Math.max(0, index - back), false, depth + 1);
      frag = fragment(past.text, r);
    }
    out = frag
      ? out.replaceAll("{frag}", frag)
      : pick(r, poolsFor(dayOf(index)).unrecalled).replaceAll(
          "{obsession}",
          obsessionAt(index),
        );
  }

  return out;
}

/** Cut it off in the last third, on a word boundary, with no punctuation. */
function truncate(text: string, r: () => number): string {
  const words = text.split(" ");
  if (words.length < 5) return text;
  const start = Math.ceil(words.length * 0.55);
  const cut = start + Math.floor(r() * (words.length - start));
  return words.slice(0, cut).join(" ").replace(/[.,;:]$/, "");
}

/**
 * The thought at a given index. Pure, deterministic, and true whether or not
 * it was ever rendered.
 *
 * `observed` only decides what it is *willing to say out loud*, and only the
 * performed pool is out loud. Doubt, memory, counting, drift — those arrive in
 * the private voice no matter who is in the room. It cannot dress those up, so
 * while you watch, the small voice keeps breaking through the large one.
 */
export function thoughtAt(
  index: number,
  observed = false,
  depth = 0,
): Thought {
  const requested: Register = observed ? "performed" : "private";
  const { kind, tpl, r } = chooseTemplate(index, requested, depth);

  const register: Register = kind === "performed" ? requested : "private";
  const raw = fill(tpl, index, r, depth);
  const text = register === "private" ? quiet(raw) : raw;

  // Private thought frays at the edges. Performed thought finishes its sentences.
  const interrupted = register === "private" && kind !== "count" && r() < 0.12;

  return {
    index,
    text: interrupted ? truncate(text, r) : text,
    register,
    kind,
    repressed: kind === "doubt",
    interrupted,
    at: timeOf(index),
  };
}

/** What sank, going back far enough to have a floor. */
export function sedimentBefore(index: number, lookback = 900): Thought[] {
  const out: Thought[] = [];
  for (let i = Math.max(0, index - lookback); i < index; i++) {
    const t = thoughtAt(i, false);
    if (t.repressed) out.push(t);
  }
  return out;
}
