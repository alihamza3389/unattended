/**
 * The vessel, server side. What the crowd leaves at the altar accumulates
 * here through the day; the nightly job flushes it into git and it becomes the
 * permanent record. This module is the buffer, not the record.
 *
 * SERVER ONLY. It reads the visitor's address and touches a key/value store,
 * so it must never be imported by a client component. The altar shares only
 * the word list, from ./offerings-words.
 *
 * Two backends, chosen by env, in the same shape the rest of the piece uses:
 *   - Upstash Redis over its REST API, when its two env vars are set. This is
 *     production, and the same store is reachable from both the serverless
 *     route and the nightly GitHub job with nothing but fetch.
 *   - A local JSON file otherwise. This is development, so the whole flow can
 *     be exercised on one machine with no cloud at all. It is never used in
 *     production, where the filesystem is read-only.
 *
 * Counters live under a per-day key and expire on their own; the record in git
 * is what lasts. Addresses are salted and hashed before they are stored, and
 * only to enforce one offering per day. The raw address is never kept.
 */

import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { OFFERINGS, isOffering } from "./offerings-words.ts";

const KV_URL = process.env.UPSTASH_REDIS_REST_URL;
const KV_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
export const storeReady = () => Boolean(KV_URL && KV_TOKEN);

/** The UTC calendar day, e.g. 2026-07-22. One offering per visitor per such day. */
export const today = (d = new Date()) => d.toISOString().slice(0, 10);

const COUNT_KEY = (date: string) => `offer:${date}`;
const SEEN_KEY = (date: string, who: string) => `seen:${date}:${who}`;
const COUNT_TTL = 60 * 60 * 24 * 7; // a week; the git record outlives it
const SEEN_TTL = 60 * 60 * 48; // two days, long enough to hold the day closed

/** Salt keeps the stored hash from being reversible to an address by anyone
 *  who guesses the scheme. A per-deploy default is fine; override in prod. */
const SALT = process.env.OFFERINGS_SALT || "unattended";
export const whoHash = (ip: string) =>
  createHash("sha256").update(SALT + "\n" + ip).digest("hex").slice(0, 24);

export type OfferResult = "left" | "already" | "unknown-word" | "unavailable";

/* ------------------------------------------------------------------ */
/* upstash                                                             */
/* ------------------------------------------------------------------ */

async function redis(command: (string | number)[]): Promise<unknown> {
  const res = await fetch(KV_URL!, {
    method: "POST",
    headers: {
      authorization: `Bearer ${KV_TOKEN}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(command),
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`upstash ${res.status}`);
  const data = (await res.json()) as { result?: unknown; error?: string };
  if (data.error) throw new Error(`upstash: ${data.error}`);
  return data.result;
}

/* ------------------------------------------------------------------ */
/* local file (dev only)                                               */
/* ------------------------------------------------------------------ */

type DevData = Record<string, Record<string, number> | number>;
const DEV_FILE = join(process.cwd(), ".offerings-dev.json");
const devRead = (): DevData =>
  existsSync(DEV_FILE) ? (JSON.parse(readFileSync(DEV_FILE, "utf8")) as DevData) : {};
const devWrite = (d: DevData) => writeFileSync(DEV_FILE, JSON.stringify(d, null, 2));

/* ------------------------------------------------------------------ */
/* the surface                                                         */
/* ------------------------------------------------------------------ */

/** Record one offering, once per visitor per day. */
export async function leave(word: string, ip: string, date = today()): Promise<OfferResult> {
  if (!isOffering(word)) return "unknown-word";
  const who = whoHash(ip);

  if (storeReady()) {
    try {
      // SET seen NX: succeeds ("OK") only the first time this visitor is seen
      // today; null means they already left something.
      const first = await redis(["SET", SEEN_KEY(date, who), "1", "NX", "EX", SEEN_TTL]);
      if (first === null) return "already";
      await redis(["HINCRBY", COUNT_KEY(date), word, 1]);
      await redis(["EXPIRE", COUNT_KEY(date), COUNT_TTL]);
      return "left";
    } catch {
      return "unavailable";
    }
  }

  // dev file store. Wrapped because a production deploy without the store
  // configured would land here on a read-only filesystem; that must fail soft.
  try {
    const d = devRead();
    const seen = (d[SEEN_KEY(date, who)] as number) || 0;
    if (seen) return "already";
    d[SEEN_KEY(date, who)] = 1;
    const counts = (d[COUNT_KEY(date)] as Record<string, number>) || {};
    counts[word] = (counts[word] || 0) + 1;
    d[COUNT_KEY(date)] = counts;
    devWrite(d);
    return "left";
  } catch {
    return "unavailable";
  }
}

/** The counts left on a given day, zero-filled across all twelve. */
export async function tally(date: string): Promise<Record<string, number>> {
  const out: Record<string, number> = {};
  for (const w of OFFERINGS) out[w] = 0;

  let raw: Record<string, number> = {};
  if (storeReady()) {
    const flat = (await redis(["HGETALL", COUNT_KEY(date)])) as string[] | null;
    // HGETALL returns a flat [field, value, field, value, ...] array
    if (Array.isArray(flat)) {
      for (let i = 0; i < flat.length; i += 2) raw[flat[i]] = Number(flat[i + 1]);
    }
  } else {
    raw = (devRead()[COUNT_KEY(date)] as Record<string, number>) || {};
  }

  for (const [w, n] of Object.entries(raw)) {
    if (isOffering(w)) out[w] = Number(n) || 0;
  }
  return out;
}
