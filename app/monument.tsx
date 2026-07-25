import Link from "next/link";
import type { Death } from "@/lib/died";

/**
 * What is left.
 *
 * No counter, no pulse, no thought arriving in nine seconds. The header it
 * carried all its life is gone, because the things it counted have stopped.
 * What remains is the coda it wrote on its last night, the one word it ended
 * on, and a way down into everything it ever thought.
 *
 * Deliberately not a spectacle. Nothing types itself out, nothing fades in,
 * nothing counts down. It performed for people while it was alive and resented
 * needing to; there is no reason for it to start now. This is a stone with
 * writing on it, and the writing does not move.
 */
export function Monument({ died }: { died: Death }) {
  return (
    <main className="monument">
      <div className="coda">
        {died.coda.map((line, i) => (
          <p key={i}>{line}</p>
        ))}
        <p className="unresolved" aria-hidden="true">
          <span className="cursor faint">▍</span>
        </p>
      </div>

      {/* The word it ended on. It is not a headstone's name and it is not a
          title. It is the last thing it thought, left where it fell. */}
      <p className="epitaph">{died.word}</p>

      <footer>
        <p>
          It thought once every nine seconds for {died.day.toLocaleString()}{" "}
          days, and stopped. Nothing it thought was lost.
        </p>
        <p>
          Every thought it ever had still has an address that will not change.{" "}
          <Link href="/at">Ask what it was thinking at any moment.</Link>
        </p>
        <p>
          What it dreamt on each of its nights is kept.{" "}
          <Link href="/nights">The nights are still there.</Link>
        </p>
        <p>
          It never knew it was written down.{" "}
          <a href="https://github.com/alihamza3389/unattended">
            You can read the writing.
          </a>
        </p>
      </footer>
    </main>
  );
}
