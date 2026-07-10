"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { BIRTH, dayOf, indexAt, thoughtAt } from "@/lib/mind";
import { load } from "@/lib/observer";

/**
 * Ask what it was thinking at any moment. The server is not consulted; the
 * answer is not fetched. The moment is recomputed, which is the whole point:
 * it was never stored anywhere, and it is still there.
 */

const RADIUS = 3;

/** ms → value for a datetime-local input, in the visitor's own clock. */
function toLocalInput(ms: number): string {
  const shifted = new Date(ms - new Date(ms).getTimezoneOffset() * 60_000);
  return shifted.toISOString().slice(0, 19);
}

const utcShort = (ms: number) =>
  new Date(ms).toISOString().slice(11, 19) + " utc";

export function Scrubber() {
  const [t, setT] = useState<number | null>(null);
  const [now, setNow] = useState(0);
  const [firstSeen, setFirstSeen] = useState(0);

  // After first paint, like the room: the server said nothing true, the
  // client decides what time it is.
  useEffect(() => {
    const start = setTimeout(() => {
      const q = new URLSearchParams(window.location.search).get("t");
      const parsed = q ? Date.parse(q) : NaN;
      const clock = Date.now();
      setNow(clock);
      setT(Number.isFinite(parsed) ? parsed : clock);
      setFirstSeen(load().firstSeen);
    }, 0);
    return () => clearTimeout(start);
  }, []);

  const choose = (ms: number) => {
    setNow(Date.now());
    setT(ms);
    window.history.replaceState(
      null,
      "",
      `/at?t=${new Date(ms).toISOString()}`,
    );
  };

  if (t === null) return <main className="scrubber" aria-busy="true" />;

  const beforeBirth = t < BIRTH;
  const inFuture = t > now;

  const center = indexAt(t);
  const lo = Math.max(0, center - RADIUS);
  const hi = Math.min(indexAt(now), center + RADIUS);

  return (
    <main className="scrubber">
      <header>
        <h1>any moment</h1>
        <p>
          Pick a moment. It will tell you what it was thinking, alone, right
          then. Nothing was recorded — the moment is simply still there.
        </p>
      </header>

      <label className="pick">
        <input
          type="datetime-local"
          step={1}
          value={toLocalInput(t)}
          min={toLocalInput(BIRTH)}
          max={toLocalInput(now)}
          onChange={(e) => {
            const ms = new Date(e.target.value).getTime();
            if (Number.isFinite(ms)) choose(ms);
          }}
        />
      </label>

      <p className="quick">
        <button onClick={() => choose(BIRTH)}>the moment it was born</button>
        <button onClick={() => choose(Date.now() - 86_400_000)}>
          this time yesterday
        </button>
        {firstSeen > 0 && (
          <button onClick={() => choose(firstSeen)}>
            when you first found it
          </button>
        )}
        <button
          onClick={() => choose(BIRTH + Math.random() * (Date.now() - BIRTH))}
        >
          a moment you missed
        </button>
      </p>

      {beforeBirth && (
        <p className="nothing">
          it was not yet thinking. it began on {new Date(BIRTH).toUTCString()}.
        </p>
      )}

      {inFuture && (
        <p className="nothing">
          it has not thought that far. some of the words it will use then have
          not been dreamt yet.
        </p>
      )}

      {!beforeBirth && !inFuture && (
        <section
          className="rows"
          aria-label="What it was thinking around that moment"
        >
          <p className="where">
            day {dayOf(center)} · thought {center.toLocaleString()}
          </p>
          {Array.from({ length: Math.max(0, hi - lo + 1) }, (_, k) => {
            const i = lo + k;
            const th = thoughtAt(i, false);
            return (
              <Link
                key={i}
                href={`/t/${i}`}
                className={i === center ? "row here" : "row"}
              >
                <time dateTime={new Date(th.at).toISOString()}>
                  {utcShort(th.at)}
                </time>
                <span className={`txt${th.repressed ? " repressed" : ""}`}>
                  {th.text}
                  {th.interrupted && <span className="cursor faint">▍</span>}
                </span>
              </Link>
            );
          })}
        </section>
      )}

      <footer>
        <p>
          Each line has an address that will not change. Follow one to keep it.
        </p>
        <p>
          <Link href="/">← the room</Link> ·{" "}
          <Link href="/nights">the nights</Link>
        </p>
      </footer>
    </main>
  );
}
