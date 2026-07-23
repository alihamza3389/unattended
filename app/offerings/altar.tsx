"use client";

import { useEffect, useState } from "react";
import { OFFERINGS } from "@/lib/offerings-words";

/** One thing a day. The choosing is the whole of the act; more would be
 *  grinding. This local memory is only a courtesy so a returning visitor sees
 *  their word; the binding limit is enforced on the server by address. */
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
    return Date.now() - g.at < COOLDOWN_HOURS * 3_600_000 ? g : null;
  } catch {
    return null;
  }
}

export function Altar() {
  const [given, setGiven] = useState<Given | null>(null);
  const [ready, setReady] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    setGiven(remember());
    setReady(true);
  }, []);

  const leave = async (word: string) => {
    // Before the first paint settles we do not yet know what this visitor
    // already left, so the table is inert rather than dimmed: dimming means
    // "you have already given", not "wait".
    if (!ready || given !== null) return;

    // Honour the gesture at once; the server is the source of truth for the
    // count. A returning visitor is reminded, not scolded.
    const g = { word, at: Date.now() };
    setGiven(g);
    try {
      localStorage.setItem(KEY, JSON.stringify(g));
    } catch {
      /* a visitor who keeps nothing still gets to leave something */
    }

    try {
      const res = await fetch("/api/offer", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ word }),
      });
      if (res.status === 409) {
        setNote("you have already left something today.");
      }
    } catch {
      /* the gesture stands even if the record could not be reached */
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
        {note ?? (given ? `you left ${given.word} today.` : " ")}
      </p>
    </>
  );
}
