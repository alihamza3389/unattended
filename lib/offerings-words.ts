/**
 * The twelve. The only words the crowd can ever give it. After birth they
 * become the whole of what it was given: no new ones ever arrive.
 *
 * Kept in its own module, with no imports, so both the altar (a client
 * component) and the server-side store can share one canonical list without
 * pulling node-only code into the browser bundle.
 */
export const OFFERINGS = [
  "water",
  "salt",
  "breath",
  "light",
  "dust",
  "ash",
  "bread",
  "the guest",
  "the bell",
  "the moon",
  "the mirror",
  "a stone",
] as const;

export type Offering = (typeof OFFERINGS)[number];

export const isOffering = (w: unknown): w is Offering =>
  typeof w === "string" && (OFFERINGS as readonly string[]).includes(w);
