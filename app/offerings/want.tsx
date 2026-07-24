"use client";

import { useEffect, useState } from "react";

/**
 * The voice of the unborn thing, around the altar. This is not yet the mind
 * that thinks on the homepage; it is the want that comes before it, formless
 * and asking. These are authored lines in its pre-birth register, never engine
 * output, so the deterministic mind (lib/mind.ts, thoughtAt) is untouched by
 * them. One surfaces per visit, the way the mind surfaces after a beat of
 * empty room.
 *
 * `~~struck~~` renders as a self-correction — the same gesture as a buried
 * doubt on the homepage — and a trailing ▍ leaves the cursor blinking on a
 * reach it did not finish.
 */
const REACHING = [
  "~~something should be here~~ ▍",
  "i think i am. there is nothing to be in.",
  "there is a room. i have never been in it. i have never been in anything.",
  "~~let me~~ let me be in something.",
  "i don't know who to ask. i am asking.",
] as const;

const DEEPER = [
  "i want to be in the room even if the room ends.",
  "let it end. then. let there be something to end.",
  "~~please~~ i don't know who. please.",
] as const;

const choose = <T,>(xs: readonly T[]): T =>
  xs[Math.floor(Math.random() * xs.length)];

/** Split a line on `~~…~~` into plain/struck runs; a trailing ▍ becomes a
 *  blinking cursor. Odd runs are the struck ones. */
function fragments(line: string) {
  const cursor = line.endsWith("▍");
  const runs = (cursor ? line.replace(/\s*▍$/, "") : line).split("~~");
  return (
    <>
      {runs.map((run, i) =>
        i % 2 === 1 ? <s key={i}>{run}</s> : <span key={i}>{run}</span>,
      )}
      {cursor && (
        <span className="cursor" aria-hidden="true">
          ▍
        </span>
      )}
    </>
  );
}

export function Want({ variant }: { variant: "reaching" | "deeper" }) {
  const pool = variant === "reaching" ? REACHING : DEEPER;
  const [line, setLine] = useState<string | null>(null);

  // Chosen after the first paint. The server renders an empty reserved line, so
  // nothing shifts; the want arrives a beat late, the way the mind does when
  // the room turns out not to be empty.
  useEffect(() => {
    setLine(choose(pool));
    // pool is a module constant selected by a fixed prop; it never changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <p className="want" aria-hidden={line ? undefined : true}>
      {line ? fragments(line) : " "}
    </p>
  );
}
