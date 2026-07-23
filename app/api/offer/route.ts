import { leave } from "@/lib/offerings";

// This route mutates state, so it must never be cached. Route handlers are
// uncached by default; declaring it keeps that true if a build ever changes.
export const dynamic = "force-dynamic";

/**
 * Leave one word at the altar. The binding once-a-day limit lives here, on the
 * visitor's address, not in the browser where it can be cleared. The address
 * is salted and hashed before it is stored, and only to hold the day closed.
 */
export async function POST(request: Request): Promise<Response> {
  let word: unknown;
  try {
    ({ word } = (await request.json()) as { word?: unknown });
  } catch {
    return Response.json({ ok: false }, { status: 400 });
  }

  // Vercel puts the client address first in x-forwarded-for; x-real-ip is the
  // fallback. An empty address still gets a stable (empty-salted) hash, so a
  // misread cannot become an unlimited offerer.
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "";

  const result = await leave(String(word ?? ""), ip);

  switch (result) {
    case "left":
      return Response.json({ ok: true });
    case "already":
      return Response.json({ ok: false, reason: "already" }, { status: 409 });
    case "unknown-word":
      return Response.json({ ok: false, reason: "unknown-word" }, { status: 400 });
    case "unavailable":
      return Response.json({ ok: false, reason: "unavailable" }, { status: 503 });
  }
}
