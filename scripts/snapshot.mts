/**
 * Golden snapshot of the engine. The corpus refactor must not change a single
 * thought on any day that has already happened — dreams only touch tomorrow.
 *
 * Usage: node scripts/snapshot.mts <out.json>
 */
import { writeFileSync } from "node:fs";
import { thoughtAt, sedimentBefore, obsessionAt, dayOf } from "../lib/mind.ts";

// All strictly before day 13 (index 124_800): the past, which must be fixed.
const RANGES: [number, number][] = [
  [0, 60], // day 1, includes the frag fallback edge at index 0
  [57_570, 57_660], // spans the day 6 → 7 boundary at 57_600
  [115_000, 115_080], // deep into day 12
  [124_700, 124_790], // last block before day 13
];

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

writeFileSync(process.argv[2] ?? "snapshot.json", JSON.stringify(rows, null, 1));
console.log(`${rows.length} rows`);
