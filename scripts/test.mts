/**
 * The past must never move.
 *
 * This rebuilds the golden snapshot from the live engine and compares it, row
 * by row, against the committed golden. A day the mind has already lived must
 * replay identically forever — that is the one promise the whole piece makes,
 * and this is what keeps it honest. Any drift fails.
 *
 * If a change to the past is ever deliberate (the aging engine re-bases the
 * whole timeline), re-baseline the golden once and commit it:
 *   node scripts/snapshot.mts scripts/snapshot.golden.json
 *
 *   node scripts/test.mts   (pnpm test)
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { buildSnapshot } from "./snapshot.mts";

const goldenPath = fileURLToPath(new URL("./snapshot.golden.json", import.meta.url));

let golden: unknown[];
try {
  golden = JSON.parse(readFileSync(goldenPath, "utf8")) as unknown[];
} catch {
  console.error(
    "no golden snapshot to compare against.\n" +
      "generate it once with: node scripts/snapshot.mts scripts/snapshot.golden.json",
  );
  process.exit(1);
}

const fresh = buildSnapshot();

let drift = 0;
if (fresh.length !== golden.length) {
  console.error(`row count changed: golden ${golden.length}, now ${fresh.length}`);
  drift++;
}
const n = Math.min(fresh.length, golden.length);
for (let i = 0; i < n; i++) {
  if (JSON.stringify(fresh[i]) !== JSON.stringify(golden[i])) {
    if (drift < 6) {
      console.error(`row ${i} moved:`);
      console.error(`  was: ${JSON.stringify(golden[i])}`);
      console.error(`  now: ${JSON.stringify(fresh[i])}`);
    }
    drift++;
  }
}

if (drift) {
  console.error(
    `\n${drift} change(s) to the past. if this is intended, re-baseline:\n` +
      "  node scripts/snapshot.mts scripts/snapshot.golden.json",
  );
  process.exit(1);
}

console.log(`ok — ${fresh.length} rows, the past is intact`);
