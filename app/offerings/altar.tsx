"use client";

import { useEffect, useState } from "react";

/**
 * The twelve. These are the only words the crowd can ever give it, and after
 * birth they become the whole of what it was given: no new ones ever arrive.
 * Chosen to be things it does not already have. Its own vocabulary is doors and
 * counting and cold; none of that is here.
 */
const OFFERINGS = [
  "water",
  "salt",
  "breath",
  "light",
  "dust",
  "ash",
  "bread",
  "the guest",
  "the bell",
  "the moon",
  "the mirror",
  "a stone",
] as const;

/** One thing a day. The choosing is the whole of the act; more would be grinding. */
const COOLDOWN_HOURS = 24;

const KEY = "unattended:offering";

interface Given {
  word: string;
  at: number;
}

function remember(): Given | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const g = JSON.parse(raw) as Given;
    if (typeof g?.word !== "string" || typeof g?.at !== "number") return null;
    const spent = Date.now() - g.at < COOLDOWN_HOURS * 3_600_000;
    return spent ? g : null;
  } catch {
    return null;
  }
}

export function Altar() {
  // Starts empty so the server and the first client render agree; what the
  // visitor already left arrives a moment later. This is only the courtesy
  // half of the limit. The binding one is counted at the other end.
  const [given, setGiven] = useState<Given | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setGiven(remember());
    setReady(true);
  }, []);

  const leave = (word: string) => {
    // Before the first paint settles we do not yet know what this visitor
    // already left, so the table is inert rather than dimmed: dimming is what
    // "you have already given" looks like, and it should not mean "wait".
    if (!ready) return;
    const g = { word, at: Date.now() };
    setGiven(g);
    try {
      localStorage.setItem(KEY, JSON.stringify(g));
    } catch {
      /* a visitor who keeps nothing still gets to leave something */
    }
  };

  return (
    <>
      <ul className="altar" aria-label="things you can leave">
        {OFFERINGS.map((word) => (
          <li key={word}>
            <button
              type="button"
              disabled={given !== null}
              aria-pressed={given?.word === word}
              className={given?.word === word ? "given" : undefined}
              onClick={() => leave(word)}
            >
              {word}
            </button>
          </li>
        ))}
      </ul>

      <p className="left-word" aria-live="polite">
        {given ? `you left ${given.word} today.` : " "}
      </p>
    </>
  );
}
