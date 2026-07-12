/**
 * Once a day, the mind's first clear thought is carried out to the places
 * people gather — X and Bluesky — with a link back to its permanent address.
 * Nothing about the thought changes: it was thought at the top of the day
 * whether or not anyone was there. This only tells them where to find it.
 *
 * Two platforms, posted in one run, each allowed to fail alone. X unfurls the
 * card itself from the link's meta tags; Bluesky is handed the card by hand —
 * we fetch our own opengraph image and upload it as the thumbnail.
 *
 *   node scripts/post.mts [--dry] [--index N]
 *
 * --dry prints what it would post and sends nothing. --index posts a specific
 * thought instead of today's first (for a one-off).
 *
 * Secrets (via env):
 *   X_API_KEY X_API_SECRET X_ACCESS_TOKEN X_ACCESS_TOKEN_SECRET
 *   BLUESKY_IDENTIFIER BLUESKY_APP_PASSWORD
 * Missing credentials for a platform simply skip it.
 */

import { pathToFileURL } from "node:url";
import { THOUGHTS_PER_DAY, dayOf, indexAt, thoughtAt } from "../lib/mind.ts";

const SITE = "https://unattended.vercel.app";
const fmt = (n: number) => n.toLocaleString("en-US");

/**
 * The day's first clear thought: from the day's first index, walk forward to
 * the first thought that isn't struck out, isn't cut off, and has some weight.
 * Bounded by what has actually been thought by now, so we never post a thought
 * from the future.
 */
function firstThoughtOf(day: number, now: number) {
  const start = (day - 1) * THOUGHTS_PER_DAY;
  const limit = Math.min(start + 200, indexAt(now));
  const fallback = thoughtAt(start, false);
  for (let i = start; i <= limit; i++) {
    const t = thoughtAt(i, false);
    if (!t.repressed && !t.interrupted && t.text.length >= 15) return t;
  }
  return fallback;
}

/** X wraps any URL to 23 characters; leave room for it and two newlines. */
function fitForX(text: string): string {
  const budget = 280 - 23 - 2;
  if (text.length <= budget) return text;
  return text.slice(0, budget - 1).replace(/\s+\S*$/, "") + "…";
}

async function postToX(text: string, url: string): Promise<void> {
  const { X_API_KEY, X_API_SECRET, X_ACCESS_TOKEN, X_ACCESS_TOKEN_SECRET } =
    process.env;
  if (!X_API_KEY || !X_API_SECRET || !X_ACCESS_TOKEN || !X_ACCESS_TOKEN_SECRET) {
    console.log("x: no credentials — skipping");
    return;
  }
  const { TwitterApi } = await import("twitter-api-v2");
  const client = new TwitterApi({
    appKey: X_API_KEY,
    appSecret: X_API_SECRET,
    accessToken: X_ACCESS_TOKEN,
    accessSecret: X_ACCESS_TOKEN_SECRET,
  });
  const res = await client.v2.tweet(`${fitForX(text)}\n\n${url}`);
  console.log(`x: posted ${res.data.id}`);
}

async function xrpc(url: string, init: RequestInit): Promise<unknown> {
  const res = await fetch(url, { ...init, signal: AbortSignal.timeout(20_000) });
  if (!res.ok) throw new Error(`${new URL(url).pathname}: ${res.status} ${await res.text()}`);
  return res.json();
}

async function postToBluesky(
  text: string,
  url: string,
  index: number,
): Promise<void> {
  const identifier = process.env.BLUESKY_IDENTIFIER;
  const password = process.env.BLUESKY_APP_PASSWORD;
  if (!identifier || !password) {
    console.log("bluesky: no credentials — skipping");
    return;
  }
  const PDS = "https://bsky.social";

  const session = (await xrpc(`${PDS}/xrpc/com.atproto.server.createSession`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ identifier, password }),
  })) as { accessJwt: string; did: string };

  // The card image: fetch our own opengraph png and upload it as a blob. A
  // card without a thumbnail still posts, so this is allowed to fail quietly.
  let thumb: unknown;
  try {
    const img = await fetch(`${url}/opengraph-image`, {
      signal: AbortSignal.timeout(20_000),
    });
    if (img.ok) {
      const blobRes = await fetch(`${PDS}/xrpc/com.atproto.repo.uploadBlob`, {
        method: "POST",
        headers: {
          "content-type": img.headers.get("content-type") ?? "image/png",
          authorization: `Bearer ${session.accessJwt}`,
        },
        body: new Uint8Array(await img.arrayBuffer()),
      });
      if (blobRes.ok) thumb = ((await blobRes.json()) as { blob: unknown }).blob;
    }
  } catch {
    /* the card is nicer with a thumbnail, but not required */
  }

  const external: Record<string, unknown> = {
    uri: url,
    title: `unattended · thought ${fmt(index)}`,
    description: text,
  };
  if (thumb) external.thumb = thumb;

  const posted = (await xrpc(`${PDS}/xrpc/com.atproto.repo.createRecord`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${session.accessJwt}`,
    },
    body: JSON.stringify({
      repo: session.did,
      collection: "app.bsky.feed.post",
      record: {
        $type: "app.bsky.feed.post",
        text,
        createdAt: new Date().toISOString(),
        embed: { $type: "app.bsky.embed.external", external },
      },
    }),
  })) as { uri: string };
  const rkey = posted.uri.split("/").pop();
  console.log(
    `bluesky: posted https://bsky.app/profile/${session.did}/post/${rkey}`,
  );
}

async function main() {
  const args = process.argv.slice(2);
  const dry = args.includes("--dry");
  const idxFlag = args.indexOf("--index");

  const now = Date.now();
  const t =
    idxFlag !== -1
      ? thoughtAt(Number(args[idxFlag + 1]), false)
      : firstThoughtOf(dayOf(indexAt(now)), now);

  const url = `${SITE}/t/${t.index}`;
  console.log(`the thought (index ${fmt(t.index)}, day ${dayOf(t.index)}):`);
  console.log(`  ${t.text}`);
  console.log(`the link: ${url}`);

  if (dry) {
    console.log("dry run — sending nothing.");
    return;
  }

  const results = await Promise.allSettled([
    postToX(t.text, url),
    postToBluesky(t.text, url, t.index),
  ]);
  const failures = results.filter(
    (r): r is PromiseRejectedResult => r.status === "rejected",
  );
  for (const f of failures) console.error(`  failed: ${f.reason}`);
  if (failures.length === results.length) {
    throw new Error("every platform failed — nothing was posted");
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  });
}
