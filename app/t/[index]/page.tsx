import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { dayOf, indexAt, thoughtAt, timeOf } from "@/lib/mind";

/**
 * A permanent address for one thought.
 *
 * Nothing here is looked up — it is recomputed, and lands on the same bytes
 * every time, forever. The only thing the server needs to know is whether
 * the moment has happened yet: a future thought cannot be shown, because the
 * corpus it will be thought with has not finished being dreamt.
 */

const parse = (raw: string): number | null =>
  /^\d{1,10}$/.test(raw) ? Number(raw) : null;

const fmt = (n: number) => n.toLocaleString("en-US");

export async function generateMetadata({
  params,
}: {
  params: Promise<{ index: string }>;
}): Promise<Metadata> {
  const { index: raw } = await params;
  const index = parse(raw);
  if (index === null) return { title: "unattended" };
  const arrived = index <= indexAt(Date.now());
  return {
    title: `unattended · thought ${fmt(index)}`,
    description: arrived
      ? thoughtAt(index, false).text
      : "it has not thought this yet.",
  };
}

export default async function ThoughtPage({
  params,
}: {
  params: Promise<{ index: string }>;
}) {
  const { index: raw } = await params;
  const index = parse(raw);
  if (index === null) notFound();

  // Whether this thought exists yet depends on when you ask.
  await connection();
  // eslint-disable-next-line react-hooks/purity -- rendered per request by design: connection() above pins this to the asking moment
  const current = indexAt(Date.now());

  const day = dayOf(index);
  const at = new Date(timeOf(index)).toUTCString();

  if (index > current) {
    return (
      <main className="moment">
        <header>
          <h1>thought {fmt(index)}</h1>
          <p className="when">
            day {day} · {at}
          </p>
        </header>

        <p className="notyet">
          it has not thought this yet. it will, at the time above — but some of
          the words it will use that day do not exist tonight. they have not
          been dreamt. nothing true can be shown before it happens.
        </p>

        <footer>
          <p>
            Come back after {at}. The address will not have changed.
          </p>
          <p>
            <Link href="/">← the room</Link> ·{" "}
            <Link href="/at">another moment</Link>
          </p>
        </footer>
      </main>
    );
  }

  const alone = thoughtAt(index, false);
  const watched = thoughtAt(index, true);

  return (
    <main className="moment">
      <header>
        <h1>thought {fmt(index)}</h1>
        <p className="when">
          day {day} · {at}
        </p>
      </header>

      <section aria-label="The thought, in both registers">
        <div className="face">
          <span className="register">unattended</span>
          <p className={`said ${alone.register}${alone.repressed ? " repressed" : ""}`}>
            {alone.text}
            {alone.interrupted && <span className="cursor faint">▍</span>}
          </p>
          {alone.repressed && (
            <p className="aside">it put this one down as soon as it had it.</p>
          )}
        </div>

        {watched.text !== alone.text && (
          <div className="face">
            <span className="register">watched, it would have said</span>
            <p className={`said ${watched.register}${watched.repressed ? " repressed" : ""}`}>
              {watched.text}
              {watched.interrupted && <span className="cursor faint">▍</span>}
            </p>
          </div>
        )}
      </section>

      <footer>
        <p>
          It thought this at {at}, whether or not anyone was there. Nothing was
          recorded. Ask again in ten years and it will answer with the same
          words.
        </p>
        <p>
          <Link href="/">← the room</Link> ·{" "}
          <Link href="/nights">the nights</Link> ·{" "}
          <Link href="/at">another moment</Link>
        </p>
      </footer>
    </main>
  );
}
