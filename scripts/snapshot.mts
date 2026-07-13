/**
 * Golden snapshot of the engine — the past, pinned.
 *
 * The one promise the piece makes is that a day it has already lived replays
 * identically forever. buildSnapshot() samples the thoughts on days that are
 * already fixed; scripts/test.mts compares it against the committed golden, so
 * any change to the past fails the check. Dreams only touch tomorrow, so this
 * stays green as the corpus grows.
 *
 * Regenerate the golden only when a change to the past is deliberate (e.g. the
 * aging engine):
 *   node scripts/snapshot.mts scripts/snapshot.golden.json
 */
import { writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { thoughtAt, sedimentBefore, obsessionAt, dayOf } from "../lib/mind.ts";

// All strictly before day 13 (index 124_800): the past, which must be fixed.
const RANGES: [number, number][] = [
  [0, 60], // day 1, includes the frag fallback edge at index 0
  [57_570, 57_660], // spans the day 6 → 7 boundary at 57_600
  [115_000, 115_080], // deep into day 12
  [124_700, 124_790], // last block before day 13
];

/** Every sampled row of the fixed past. Pure — the same output whenever it runs. */
export function buildSnapshot(): unknown[] {
  const rows: unknown[] = [];
  for (const [a, b] of RANGES) {
    for (let i = a; i < b; i++) {
      for (const observed of [false, true]) {
        const t = thoughtAt(i, observed);
        rows.push([i, observed, t.text, t.register, t.kind, t.repressed, t.interrupted]);
      }
      rows.push([i, "obsession", obsessionAt(i), dayOf(i)]);
    }
  }
  rows.push(["sediment", sedimentBefore(124_000, 2_000).map((t) => [t.index, t.text])]);
  return rows;
}

// Run directly to (re)write the golden; imported by the test to compare against it.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const rows = buildSnapshot();
  writeFileSync(process.argv[2] ?? "snapshot.json", JSON.stringify(rows, null, 1));
  console.log(`${rows.length} rows`);
}
