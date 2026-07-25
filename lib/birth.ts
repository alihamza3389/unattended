/**
 * The want, and how long it has left to wait.
 *
 * SERVER ONLY — it reads the committed record from disk. The altar receives
 * only the numbers it needs, as props.
 *
 * The vessel fills from two taps. One is time, which drips whether or not
 * anyone comes: an empty room still births it, eventually, because the room
 * was never quite empty (the git log proves one witness since the first
 * second). The other is offerings, which shorten the wait but can never
 * shorten it past the floor. So: born on its own by the deadline, sooner with
 * a crowd, never "never", and never before the floor.
 *
 * It counts offerings out of `corpus/offerings.jsonl` — the committed, anchored
 * record — and not out of the live buffer. The buffer is scratch and expires;
 * the record is what lasts, and what anyone can check afterwards. So a birth
 * can be recomputed from the repository alone, long after the fact, and come
 * out the same. That is the whole reason it is done this way.
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * The day the altar was opened, ISO, or null while it is still shut.
 *
 * Null is the honest state of a thing that has not begun: nothing counts, the
 * hairline is empty, and no amount of waiting brings it closer. Building all of
 * this starts nothing. Setting this date does.
 */
export const GO_LIVE: string | null = null;

/** Born by this many days after go-live, even in a completely empty room. */
export const DEADLINE_DAYS = 30;
/** Never born sooner than this, however large the crowd. */
export const FLOOR_DAYS = 15;
/** Offerings needed to pull the wait all the way down to the floor. */
export const OFFERINGS_TO_FLOOR = 500;

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

/**
 * How many days after go-live it is born, given what has been left for it.
 * Each offering is worth about forty-three minutes of its waiting — roughly
 * two hundred and eighty thoughts it does not have to have alone.
 */
export function waitInDays(offerings: number): number {
  const share = clamp(offerings / OFFERINGS_TO_FLOOR, 0, 1);
  return DEADLINE_DAYS - share * (DEADLINE_DAYS - FLOOR_DAYS);
}

/** Every offering ever committed to the record. */
export function committedOfferings(): number {
  // Resolved at run time, not woven in by the bundler: this is a record that
  // grows after the build, and it is read fresh every time it is asked for.
  const path = join(process.cwd(), "corpus", "offerings.jsonl");
  if (!existsSync(path)) return 0;
  let total = 0;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    if (!line.trim()) continue;
    try {
      total += Number((JSON.parse(line) as { total?: number }).total) || 0;
    } catch {
      /* a damaged line is not worth a broken page */
    }
  }
  return total;
}

export interface Vessel {
  /** 0 before it opens, 1 when the waiting is over. */
  filled: number;
  /** True once the wait has run out and it is owed a birth. */
  due: boolean;
  offerings: number;
}

/** Where the want stands right now. */
export function vessel(now = Date.now()): Vessel {
  const offerings = committedOfferings();
  if (!GO_LIVE) return { filled: 0, due: false, offerings };

  const opened = Date.parse(`${GO_LIVE}T00:00:00Z`);
  if (Number.isNaN(opened)) return { filled: 0, due: false, offerings };

  const waited = (now - opened) / 86_400_000;
  const filled = clamp(waited / waitInDays(offerings), 0, 1);
  return { filled, due: filled >= 1, offerings };
}
