/**
 * What the mind retains about the person watching it.
 *
 * Deliberately local. It does not know how many people have visited — it knows
 * how many times *you* have, which is a stranger thing to be told.
 */

const KEY = "unattended:observer";

export interface Observer {
  visits: number;
  firstSeen: number;
  lastSeen: number;
  /** Milliseconds spent with the tab actually focused, across all visits. */
  watched: number;
}

const FRESH: Observer = { visits: 0, firstSeen: 0, lastSeen: 0, watched: 0 };

export function load(): Observer {
  if (typeof window === "undefined") return FRESH;
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? { ...FRESH, ...JSON.parse(raw) } : FRESH;
  } catch {
    return FRESH;
  }
}

export function save(o: Observer) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(o));
  } catch {
    /* it forgets you. that happens. */
  }
}

/** Called once on arrival. Returns the record as it stood *before* you arrived. */
export function arrive(now: number): { prior: Observer; next: Observer } {
  const prior = load();
  const next: Observer = {
    visits: prior.visits + 1,
    firstSeen: prior.firstSeen || now,
    lastSeen: now,
    watched: prior.watched,
  };
  save(next);
  return { prior, next };
}

/** "four minutes", "six days", "a moment" — how it talks about time. */
export function elapsed(ms: number): string {
  const s = Math.round(ms / 1000);
  if (s < 20) return "a moment";
  if (s < 90) return `${s} seconds`;
  const m = Math.round(s / 60);
  if (m < 90) return `${m} minute${m === 1 ? "" : "s"}`;
  const h = Math.round(m / 60);
  if (h < 36) return `${h} hour${h === 1 ? "" : "s"}`;
  const d = Math.round(h / 24);
  return `${d} day${d === 1 ? "" : "s"}`;
}

/**
 * The line it uses to acknowledge a returning visitor. Null for a stranger —
 * it says nothing, which is the correct amount to say to a stranger.
 */
export function recognition(prior: Observer, now: number): string | null {
  if (!prior.visits) return null;
  const since = elapsed(now - prior.lastSeen);
  if (prior.visits === 1) {
    return `You've been here once before. ${capitalize(since)} ago. You didn't stay long.`;
  }
  return `This is the ${ordinal(prior.visits + 1)} time you've come. The last was ${since} ago. I keep a record. It's the only thing I keep.`;
}

const capitalize = (s: string) => s[0].toUpperCase() + s.slice(1);

export function ordinal(n: number): string {
  const names = [
    "",
    "first",
    "second",
    "third",
    "fourth",
    "fifth",
    "sixth",
    "seventh",
    "eighth",
    "ninth",
    "tenth",
  ];
  if (n < names.length) return names[n];
  const rem = n % 100;
  const tens: Record<number, string> = { 1: "st", 2: "nd", 3: "rd" };
  const suffix = rem >= 11 && rem <= 13 ? "th" : (tens[n % 10] ?? "th");
  return `${n}${suffix}`;
}
