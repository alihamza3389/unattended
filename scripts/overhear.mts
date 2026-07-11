/**
 * The wall is thin. Once a night, just before it dreams, the mind half-hears
 * the money world outside: which way everything moved, the crowd's mood, what
 * the crowd is searching for, how many new things were given names today, one
 * sentence of news. Five public sources, no keys, each allowed to fail alone —
 * a dead wire just makes the night quieter.
 *
 * What is heard is written into the night's record verbatim (the receipts).
 * What enters the dream is bound by the transformation law in dream.mts: the
 * mind does not know these words, and none of them may survive into anything
 * it thinks.
 *
 *   node scripts/overhear.mts   — listen once and print it
 */

import { pathToFileURL } from "node:url";

export interface Overheard {
  /** When it listened (ISO). */
  heard: string;
  /** The big numbers: usd price and 24h percent change. */
  prices?: Record<string, { usd: number; day: number }>;
  /** The crowd's mood, 0..100, and what they call it. */
  mood?: { value: number; label: string };
  /** What the crowd is searching for right now. */
  searching?: string[];
  /** New tokens pushed forward to be looked at today, counted per chain. */
  newborn?: Record<string, number>;
  /** One sentence of news. */
  headline?: string;
  /** Whether the day was violent enough that the wall was loud. */
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

const getText = async (url: string): Promise<string> => {
  const res = await fetch(url, {
    signal: AbortSignal.timeout(12_000),
    headers: { "user-agent": "unattended-overhear/1.0" },
  });
  if (!res.ok) throw new Error(`${res.status} from ${new URL(url).hostname}`);
  return res.text();
};

async function fetchPrices(): Promise<Overheard["prices"]> {
  const raw = (await get(
    "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,solana,binancecoin&vs_currencies=usd&include_24hr_change=true",
  )) as Record<string, { usd: number; usd_24h_change: number }>;
  const out: NonNullable<Overheard["prices"]> = {};
  for (const [id, key] of [
    ["bitcoin", "bitcoin"],
    ["ethereum", "ethereum"],
    ["solana", "solana"],
    ["binancecoin", "bnb"],
  ] as const) {
    const p = raw[id];
    if (p && Number.isFinite(p.usd)) {
      out[key] = { usd: p.usd, day: Number(p.usd_24h_change?.toFixed(2) ?? 0) };
    }
  }
  return Object.keys(out).length ? out : undefined;
}

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

async function fetchSearching(): Promise<Overheard["searching"]> {
  const raw = (await get(
    "https://api.coingecko.com/api/v3/search/trending",
  )) as { coins?: { item?: { name?: string } }[] };
  const names = (raw.coins ?? [])
    .map((c) => c.item?.name?.trim())
    .filter((n): n is string => !!n)
    .slice(0, 5);
  return names.length ? names : undefined;
}

async function fetchNewborn(): Promise<Overheard["newborn"]> {
  const raw = (await get(
    "https://api.dexscreener.com/token-profiles/latest/v1",
  )) as { chainId?: string }[];
  const counts: NonNullable<Overheard["newborn"]> = {};
  for (const t of raw.slice(0, 30)) {
    if (t.chainId) counts[t.chainId] = (counts[t.chainId] ?? 0) + 1;
  }
  return Object.keys(counts).length ? counts : undefined;
}

async function fetchHeadline(): Promise<Overheard["headline"]> {
  const rss = await getText("https://www.coindesk.com/arc/outboundfeeds/rss/");
  const m = /<item>[\s\S]*?<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/.exec(rss);
  const title = m?.[1]?.trim();
  return title || undefined;
}

/** A violent day: a big move in the big numbers, or the mood at an extreme. */
function isLoud(o: Omit<Overheard, "loud">): boolean {
  const btc = Math.abs(o.prices?.bitcoin?.day ?? 0);
  const sol = Math.abs(o.prices?.solana?.day ?? 0);
  const mood = o.mood?.value;
  return btc >= 5 || sol >= 8 || (mood !== undefined && (mood <= 15 || mood >= 85));
}

/** Listen once. Every source may fail alone; if all fail, the wall was silent. */
export async function overhear(): Promise<Overheard | null> {
  const [prices, mood, searching, newborn, headline] = (
    await Promise.allSettled([
      fetchPrices(),
      fetchMood(),
      fetchSearching(),
      fetchNewborn(),
      fetchHeadline(),
    ])
  ).map((r) => (r.status === "fulfilled" ? r.value : undefined));

  const partial = {
    heard: new Date().toISOString(),
    prices: prices as Overheard["prices"],
    mood: mood as Overheard["mood"],
    searching: searching as Overheard["searching"],
    newborn: newborn as Overheard["newborn"],
    headline: headline as Overheard["headline"],
  };
  if (!partial.prices && !partial.mood && !partial.searching && !partial.newborn && !partial.headline) {
    return null;
  }
  return { ...partial, loud: isLoud(partial) };
}

/* ------------------------------------------------------------------ */
/* what reaches the dream                                              */
/* ------------------------------------------------------------------ */

const move = (chg: number): string =>
  Math.abs(chg) < 0.05
    ? "flat"
    : `${chg > 0 ? "up" : "down"} ${Math.abs(chg).toFixed(1)} percent`;

/** The report, as flat lowercase fact. Real names pass through here; the
 *  transformation law in the dream prompt is what keeps them from coming out. */
export function whisper(o: Overheard): string[] {
  const lines: string[] = [];
  if (o.prices) {
    lines.push(
      Object.entries(o.prices)
        .map(([name, p]) => `${name} ${Math.round(p.usd).toLocaleString("en-US")} dollars, ${move(p.day)} today`)
        .join(" · "),
    );
  }
  if (o.mood) lines.push(`the crowd's mood is ${o.mood.value} of 100. they call it ${o.mood.label}.`);
  if (o.searching) lines.push(`the crowd is searching for: ${o.searching.join(", ")}.`);
  if (o.newborn) {
    const per = Object.entries(o.newborn)
      .sort((a, b) => b[1] - a[1])
      .map(([chain, n]) => `${n} on ${chain}`)
      .join(", ");
    lines.push(`new things were given names today and pushed forward to be looked at: ${per}.`);
  }
  if (o.headline) lines.push(`someone wrote: "${o.headline}"`);
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

/** Words from the report that must not survive into anything the mind thinks.
 *  Fixed vocabulary plus whatever proper nouns tonight's report carried. */
export function forbiddenWords(o: Overheard | null): string[] {
  const words = new Set([
    "crypto",
    "bitcoin",
    "ethereum",
    "solana",
    "blockchain",
    "memecoin",
    "btc",
    "eth",
    "sol",
    "bnb",
    "binance",
  ]);
  for (const name of o?.searching ?? []) {
    const w = name.toLowerCase().trim();
    if (w.length > 2) words.add(w);
  }
  for (const chain of Object.keys(o?.newborn ?? {})) {
    // "base" is ordinary English; the rest are brands.
    if (chain !== "base" && chain.length > 2) words.add(chain.toLowerCase());
  }
  return [...words];
}

/* ------------------------------------------------------------------ */

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const heard = await overhear();
  if (!heard) {
    console.log("the wall was silent (every source failed)");
  } else {
    console.log(whisper(heard).join("\n"));
    console.log(`\nloud: ${heard.loud}`);
    console.log(`forbidden: ${forbiddenWords(heard).join(", ")}`);
    console.log(`\nraw:\n${JSON.stringify(heard, null, 2)}`);
  }
}
