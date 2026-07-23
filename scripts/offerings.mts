/**
 * The nightly flush. What the crowd left at the altar during the day is held in
 * a key/value buffer; this reads the completed days and writes them into the
 * permanent record, corpus/offerings.jsonl, one line per day. That file is what
 * lasts, and what the birth countdown will read; the buffer is only scratch.
 *
 * Runs alongside the dream. Self-healing and fault-tolerant, like the anchor:
 *   - if the store is not configured, it exits clean (nothing to flush).
 *   - it only writes completed (past) days, never today, which is still open.
 *   - it skips days already recorded, and days on which nothing was left.
 *   - it backfills any recent day the record is missing, bounded by how long
 *     the buffer keeps a day (about a week), so a skipped run loses nothing.
 *
 *   node scripts/offerings.mts [--dry]
 *
 * The workflow commits the file it writes, authored `offerings`, so the mind's
 * own journal (git log --author=unattended) stays purely the mind's.
 */

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { OFFERINGS } from "../lib/offerings-words.ts";
import { storeReady, tally } from "../lib/offerings.ts";

const path = fileURLToPath(new URL("../corpus/offerings.jsonl", import.meta.url));
const msgPath = fileURLToPath(
  new URL("../.offerings-commit-message", import.meta.url),
);

interface Day {
  date: string;
  counts: Record<string, number>;
  total: number;
  at: string;
}

const dayString = (d: Date) => d.toISOString().slice(0, 10);
const shift = (date: string, days: number) => {
  const d = new Date(date + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return dayString(d);
};

async function main() {
  const dry = process.argv.includes("--dry");

  // tally() reads whichever backend is configured (Upstash in production, the
  // local file in development), so the flush works the same in both. When no
  // store is configured at all, tally() simply returns zeros and nothing is
  // written, which is the correct behaviour before the altar has been opened.
  if (!storeReady()) console.log("(no store configured; reading the local buffer if any)");

  const existing: Day[] = existsSync(path)
    ? readFileSync(path, "utf8")
        .split("\n")
        .filter(Boolean)
        .map((l) => JSON.parse(l) as Day)
    : [];
  const recorded = new Set(existing.map((d) => d.date));

  // One day per run: the OLDEST completed day, within the buffer's lifetime,
  // that the record is missing and that had anything left. One day per commit
  // keeps each offering commit (and its on-chain memo) mapped to a single date.
  // A backfill therefore takes one night per missed day, which a months-long
  // countdown can easily afford.
  const yesterday = shift(dayString(new Date()), -1);
  let picked: Day | null = null;
  for (let i = 7; i >= 1; i--) {
    const date = shift(yesterday, -(i - 1)); // oldest first
    if (recorded.has(date)) continue;
    const counts = await tally(date);
    const total = OFFERINGS.reduce((a, w) => a + (counts[w] || 0), 0);
    if (total === 0) continue; // an empty day leaves no line
    picked = { date, counts, total, at: new Date().toISOString() };
    break;
  }

  if (!picked) {
    console.log("nothing new left at the altar.");
    return;
  }

  console.log(`day ${picked.date}: ${picked.total} left ${JSON.stringify(picked.counts)}`);

  if (dry) {
    console.log("(dry: wrote nothing)");
    return;
  }

  const all = [...existing, picked].sort((a, b) => a.date.localeCompare(b.date));
  writeFileSync(path, all.map((d) => JSON.stringify(d)).join("\n") + "\n");
  writeFileSync(msgPath, `offerings for ${picked.date}\n`);
  console.log(`wrote ${picked.date} to corpus/offerings.jsonl`);
}

main().catch((e) => {
  // Never fail the night over the altar.
  console.error(e instanceof Error ? e.message : e);
  process.exit(0);
});
