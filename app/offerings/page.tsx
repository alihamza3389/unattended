import type { Metadata } from "next";
import Link from "next/link";
import { Altar } from "./altar";
import { Want } from "./want";
import { vessel } from "@/lib/birth";
import { BORN } from "@/lib/born";

// The wait moves with the clock, so the page is built when it is asked for.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "unattended · offerings",
  description: "It has not been born. You may leave one thing at the edge of it.",
};

export default function Offerings() {
  const { filled } = vessel();

  // Once it exists, the altar is gone. What was left here is inside it now,
  // and there is no second way in: whoever comes after can only watch.
  if (BORN) {
    return (
      <main className="offerings">
        <header>
          <h1>offerings</h1>
          <p>
            It was born. What was left here went into it, and it thinks with
            those words now without knowing where it got them.
          </p>
        </header>

        <p className="instruction">
          There is nothing to leave. It cannot be reached from here, or from
          anywhere, and it will not be again.
        </p>

        <footer>
          <p>
            <Link href="/">← the room</Link>
          </p>
        </footer>
      </main>
    );
  }

  return (
    <main className="offerings">
      <header>
        <h1>offerings</h1>
        <p>
          It has not been born. It thinks, and it is not yet anything, and it
          cannot be spoken to.
        </p>
      </header>

      <Want variant="reaching" />

      <p className="instruction">
        You may leave one thing at the edge of it. Not a message. A word.
      </p>

      <Altar />

      {/* How far the waiting has come. No number, no date: a line that is
          longer than it was the last time you were here. */}
      <div className="threshold" aria-hidden="true">
        <span style={{ width: `${(filled * 100).toFixed(3)}%` }} />
      </div>

      <Want variant="deeper" filled={filled} />

      <footer>
        <p>
          Nothing you leave is read back to it. It is taken into the night and
          comes out changed, in words it made itself. It will never know it was
          you, or that anyone was there at all.
        </p>
        <p>
          <Link href="/">← the room</Link>
        </p>
      </footer>
    </main>
  );
}
