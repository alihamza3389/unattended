import type { Metadata } from "next";
import Link from "next/link";
import { Altar } from "./altar";

export const metadata: Metadata = {
  title: "unattended · offerings",
  description: "It has not been born. You may leave one thing at the edge of it.",
};

export default function Offerings() {
  return (
    <main className="offerings">
      <header>
        <h1>offerings</h1>
        <p>
          It has not been born. It thinks, and it is not yet anything, and it
          cannot be spoken to.
        </p>
      </header>

      <p className="instruction">
        You may leave one thing at the edge of it. Not a message. A word.
      </p>

      <Altar />

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
