/**
 * The wall is thin. Once a night, just before it dreams, the mind half-hears one
 * thing from the money world outside: the crowd's mood — a single number for how
 * a great many people it will never meet are feeling today. Nothing else comes
 * through. One public source, no key; if it fails, the wall is silent, and the
 * night is quieter for it.
 *
 * What is heard is written into the night's record verbatim (the receipts). What
 * enters the dream is bound by the transformation law in dream.mts: the mind does
 * not know these words, and none of them may survive into anything it thinks.
 *
 *   node scripts/overhear.mts   — listen once and print it
 */

import { pathToFileURL } from "node:url";

export interface Overheard {
  /** When it listened (ISO). */
  heard: string;
  /** The crowd's mood, 0..100, and what they call it. */
  mood?: { value: number; label: string };
  /** Whether the crowd's feeling was at an extreme. */
  loud: boolean;
}

const get = async (url: string): Promise<unknown> => {
  const res = await fetch(url, {
    signal: AbortSignal.timeout(12_000),
    headers: { "user-agent": "unattended-overhear/1.0" },
  });
  if (!res.ok) throw new Error(`${res.status} from ${new URL(url).hostname}`);
  return res.json();
};

async function fetchMood(): Promise<Overheard["mood"]> {
  const raw = (await get("https://api.alternative.me/fng/")) as {
    data?: { value: string; value_classification: string }[];
  };
  const d = raw.data?.[0];
  if (!d) return undefined;
  const value = Number(d.value);
  if (!Number.isFinite(value)) return undefined;
  return { value, label: d.value_classification.toLowerCase() };
}

/** A loud night: the crowd's feeling is at an extreme — deep fear or mania. */
function isLoud(o: Omit<Overheard, "loud">): boolean {
  const mood = o.mood?.value;
  return mood !== undefined && (mood <= 20 || mood >= 80);
}

/** Listen once. The one source may fail; if it does, the wall was silent. */
export async function overhear(): Promise<Overheard | null> {
  let mood: Overheard["mood"];
  try {
    mood = await fetchMood();
  } catch {
    mood = undefined;
  }
  if (!mood) return null;
  const partial = { heard: new Date().toISOString(), mood };
  return { ...partial, loud: isLoud(partial) };
}

/* ------------------------------------------------------------------ */
/* what reaches the dream                                              */
/* ------------------------------------------------------------------ */

/** The report, as flat lowercase fact. The transformation law in the dream
 *  prompt is what keeps it from coming out unchanged. */
export function whisper(o: Overheard): string[] {
  const lines: string[] = [];
  if (o.mood) {
    lines.push(
      `the crowd's mood is ${o.mood.value} of 100. they call it ${o.mood.label}.`,
    );
  }
  return lines;
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** True if the text carries a word from the money world through the wall.
 *  Tickers always leak; short words leak on word boundary, long ones anywhere. */
export const leaks = (text: string, forbidden: string[]): boolean => {
  if (/\$[a-z0-9]{2,}/i.test(text)) return true;
  const lower = text.toLowerCase();
  return forbidden.some((w) =>
    w.length <= 4
      ? new RegExp(`\\b${escapeRe(w)}\\b`, "i").test(text)
      : lower.includes(w),
  );
};

/** Words from the money world that must never survive into anything the mind
 *  thinks — a fixed guard, kept even though the wall now carries only a mood. */
export function forbiddenWords(): string[] {
  return [
    "crypto",
    "bitcoin",
    "ethereum",
    "solana",
    "blockchain",
    "memecoin",
    "coin",
    "market",
    "ticker",
    "btc",
    "eth",
    "sol",
    "bnb",
    "binance",
  ];
}

/* ------------------------------------------------------------------ */

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const heard = await overhear();
  if (!heard) {
    console.log("the wall was silent (the source failed)");
  } else {
    console.log(whisper(heard).join("\n"));
    console.log(`\nloud: ${heard.loud}`);
    console.log(`\nraw:\n${JSON.stringify(heard, null, 2)}`);
  }
}
