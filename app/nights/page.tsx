import type { Metadata } from "next";
import Link from "next/link";
import { nightDays, nightOf } from "@/lib/nights";

export const metadata: Metadata = {
  title: "unattended · nights",
  description: "Every night the sediment answers. These are the transcripts.",
};

export default function Nights() {
  const nights = nightDays()
    .map((d) => nightOf(d))
    .filter((n) => n !== null);

  return (
    <main className="night-index">
      <header>
        <h1>nights</h1>
        <p>
          At the end of each of its days it sleeps, and everything it struck
          out and buried gets a voice. Nothing here was written while you could
          have been watching.
        </p>
      </header>

      {nights.length === 0 && <p className="none">it has not slept yet.</p>}

      <ul>
        {nights.map((n) => (
          <li key={n.day}>
            <Link href={`/nights/${n.day}`}>
              <span className="which">night {n.day}</span>
              <span className="dreamt">{n.summary}</span>
            </Link>
          </li>
        ))}
      </ul>

      <footer>
        <Link href="/">← the room</Link>
      </footer>
    </main>
  );
}
