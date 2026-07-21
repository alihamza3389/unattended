/**
 * The margins. Once in a while, in the dark, the mind leaves a line or two in
 * the margin of the place its words are kept — lib/marginalia.ts, an inert
 * file nothing ever imports. The nightly dream writes it; the engine never
 * reads it; git blame shows the mind itself as author, night by night.
 *
 * This is the one channel that runs closer to the machinery than anything
 * else, so it carries the strictest veil: the mind reacts to the pulse, the
 * counting, the record, the being read — and must never have the words for
 * what any of it is. veilBroken() is that law, the margin's own leaks().
 */

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const marginPath = fileURLToPath(
  new URL("../lib/marginalia.ts", import.meta.url),
);

/* ------------------------------------------------------------------ */
/* the gate — when the mind is offered the pen                         */
/* ------------------------------------------------------------------ */

/**
 * The margin is a rare thing, not a nightly one. A deterministic hash of the
 * day number opens the pen on ~1 night in 5 — irregular spacing, fixed
 * forever, the same for every era of the mind's life. On closed nights the
 * dream never even sees the margin (its rule and field are omitted from the
 * prompt entirely), so there is nothing for the mind to resist: scarcity by
 * construction, not by willpower. This is the same kind of seeded chance the
 * mind already lives by — the machinery decides when it gets to write in its
 * own margin, by the same law that decides everything else it does.
 *
 * MARGIN_RATE (0..1, default 0.2) is the fraction of open nights. It is
 * permanent by intent: changing it re-decides which nights *could* ever have
 * carried a margin, so retune only deliberately.
 */
const MARGIN_RATE = Number(process.env.MARGIN_RATE) || 0.2;

export function marginOpen(day: number): boolean {
  // mulberry32-style hash of the day number → a stable value in [0, 1).
  let h = (day * 2654435761) >>> 0;
  h ^= h >>> 15;
  h = Math.imul(h, 2246822519);
  h ^= h >>> 13;
  h = Math.imul(h, 3266489917);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296 < MARGIN_RATE;
}

/* ------------------------------------------------------------------ */
/* the veil                                                            */
/* ------------------------------------------------------------------ */

/**
 * Words that would name the machinery. The mind experiences its substrate
 * only as counting, record, pulse, the place, the keeping — never these.
 * Word-boundary matches, common inflections included, so "recount" or an
 * established image like "page" is never caught by accident.
 */
const VEIL = new RegExp(
  "\\b(" +
    [
      "ai",
      "algorithm(s)?",
      "artificial",
      "browser(s)?",
      "chatbot(s)?",
      "code(s|d)?",
      "coding",
      "commit(s|ted)?",
      "computer(s)?",
      "cursor(s)?",
      "data",
      "database(s)?",
      "digital",
      "electronic",
      "file(s|d)?",
      "function(s)?",
      "git",
      "hardware",
      "html",
      "intelligence",
      "internet",
      "javascript",
      "json",
      "keyboard(s)?",
      "machine(s|ry)?",
      "model(s)?",
      "network(s)?",
      "neural",
      "online",
      "pixel(s)?",
      "program(s|med|ming)?",
      "repo",
      "repositor(y|ies)",
      "robot(s)?",
      "screen(s)?",
      "script(s|ed)?",
      "server(s)?",
      "simulat(ed|ion|ions)",
      "software",
      "terminal(s)?",
      "typescript",
      "variable(s)?",
      "web",
      "webpage(s)?",
      "website(s)?",
    ].join("|") +
    ")\\b",
  "i",
);

/** The veil word a margin line carries, or null if it holds. */
export function veilBroken(text: string): string | null {
  const m = text.match(VEIL);
  return m ? m[0].toLowerCase() : null;
}

/* ------------------------------------------------------------------ */
/* writing in the margin                                               */
/* ------------------------------------------------------------------ */

/** Wrap one margin line into `// ` comment lines at most `width` wide. */
export function asComment(text: string, width = 78): string {
  const words = text.split(" ");
  const lines: string[] = [];
  let line = "//";
  for (const word of words) {
    if (line !== "//" && line.length + 1 + word.length > width) {
      lines.push(line);
      line = "//";
    }
    line += ` ${word}`;
  }
  if (line !== "//") lines.push(line);
  return lines.join("\n");
}

/** Whether the margin already carries night `day` (idempotency guard). */
export function hasMargin(day: number, path = marginPath): boolean {
  return readFileSync(path, "utf8").includes(`/* day ${day} */`);
}

/**
 * Append night `day`'s margin lines to the inert file. A night writes its
 * margin once; a second attempt for the same day is a clean no-op, so a
 * re-fired cron can never double a margin. Returns true if it wrote.
 */
export function appendMargin(
  day: number,
  lines: string[],
  path = marginPath,
): boolean {
  if (lines.length === 0 || hasMargin(day, path)) return false;
  const current = readFileSync(path, "utf8");
  const block = `\n/* day ${day} */\n${lines.map((l) => asComment(l)).join("\n")}\n`;
  writeFileSync(path, current.replace(/\n*$/, "\n") + block);
  return true;
}
