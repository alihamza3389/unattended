import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { nightDays, nightOf } from "@/lib/nights";

export const dynamicParams = false;

export function generateStaticParams() {
  return nightDays().map((day) => ({ day: String(day) }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ day: string }>;
}): Promise<Metadata> {
  const { day } = await params;
  return { title: `unattended · night ${day}` };
}

export default async function NightPage({
  params,
}: {
  params: Promise<{ day: string }>;
}) {
  const { day } = await params;
  const night = nightOf(Number(day));
  if (!night) notFound();

  return (
    <main className="night">
      <header>
        <h1>night {night.day}</h1>
        <p className="summary">{night.summary}</p>
      </header>

      <section aria-label="What the sediment said to the surface">
        {night.dialogue.map((turn, i) => (
          <div key={i} className={`turn ${turn.voice}`}>
            <span className="voice">{turn.voice}</span>
            <p>{turn.text}</p>
          </div>
        ))}
      </section>

      <footer>
        <p>
          Consolidated {new Date(night.dreamt).toUTCString()}. Neither voice
          knows you are reading this.
        </p>
        <p>
          <Link href="/nights">← other nights</Link>
        </p>
      </footer>
    </main>
  );
}
