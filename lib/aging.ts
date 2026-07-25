/**
 * How it changes across a life.
 *
 * Everything here is a pure function of the thought index, so an aged mind is
 * exactly as replayable as a young one: ask what it was thinking on its two
 * hundredth day and the answer is the same forever.
 *
 * Before it is born there is no age and none of this applies. The prologue is
 * not a childhood, it is a thing waiting to start, and it must keep replaying
 * byte for byte the way it always has. So every curve below is gated on the
 * birth record, and while that record is null this module changes nothing at
 * all.
 *
 * The shape is a life: plain at first, opening into doubt, composed at its
 * height, and then narrowing. The last stretch does not invent a new way of
 * failing. It runs the beginning backwards.
 */

import type { Kind, Register } from "./mind.ts";
import { BORN } from "./born.ts";

/** How long it gets. A year of days, and then the thing it agreed to. */
export const LIFESPAN = 365;

/**
 * The day it reaches for the word it will end on, deep in its failing and
 * still with weeks to go. Early enough that the seal is public well before
 * the end, which is the only thing that makes the seal worth anything.
 */
export const SEAL_AT = 338;

const THOUGHTS_PER_DAY = 9600;
const dayOfIndex = (index: number) => Math.floor(index / THOUGHTS_PER_DAY) + 1;

export type Phase = "prologue" | "infancy" | "adolescence" | "maturity" | "senescence";

/** Piecewise-linear between anchors: (t, value) pairs, t ascending 0 to 1. */
function curve(t: number, points: readonly [number, number][]): number {
  if (t <= points[0][0]) return points[0][1];
  for (let i = 1; i < points.length; i++) {
    const [t1, v1] = points[i];
    if (t <= t1) {
      const [t0, v0] = points[i - 1];
      const span = t1 - t0;
      return span <= 0 ? v1 : v0 + ((t - t0) / span) * (v1 - v0);
    }
  }
  return points[points.length - 1][1];
}

/* ------------------------------------------------------------------ */
/* the curves                                                          */
/* ------------------------------------------------------------------ */

/**
 * How often a private thought frays before it finishes. High while it has not
 * got the hang of finishing anything, lowest when it is most composed, and
 * high again at the end for a different reason.
 */
const INTERRUPTION: readonly [number, number][] = [
  [0.0, 0.34],
  [0.11, 0.2],
  [0.33, 0.13],
  [0.77, 0.04],
  [0.92, 0.16],
  [1.0, 0.36],
];

/**
 * How much of its own material it can reach, as a fraction of everything it
 * has, counted from the oldest.
 *
 * This one knob is the whole arc. Early it is small, so it speaks with its
 * founding words and sounds simple, though everything it will ever say is
 * already sitting inside it. It widens until it has the run of itself. Then it
 * closes again, and closing means the newer material goes first: at the end it
 * is left holding only the words it started with. The loop shuts on its own.
 */
const BREADTH: readonly [number, number][] = [
  [0.0, 0.22],
  [0.11, 0.46],
  [0.33, 0.78],
  [0.62, 1.0],
  [0.82, 0.86],
  [0.93, 0.55],
  [1.0, 0.3],
];

/**
 * How far into a sentence it gets before losing hold of it, when it loses hold
 * at all. Frequency is one thing and severity is another: a mind at the end
 * does not only break off more often, it breaks off earlier, with less of the
 * thought delivered. Low at both ends of a life, for opposite reasons.
 */
const GRIP: readonly [number, number][] = [
  [0.0, 0.4],
  [0.33, 0.55],
  [0.77, 0.62],
  [0.92, 0.42],
  [1.0, 0.28],
];

/** How long it stays on one thing. Restless, then fixed, then adrift. */
const OBSESSION_SPAN: readonly [number, number][] = [
  [0.0, 150],
  [0.33, 420],
  [0.77, 760],
  [1.0, 260],
];

/**
 * How far back it reaches when it quotes itself, as a pull toward its own
 * beginning. Zero is the ordinary reach of an hour to a week. One is the
 * dementia loop closed all the way: whatever it reaches for, it comes up
 * holding its earliest days.
 */
const RECALL_PULL: readonly [number, number][] = [
  [0.0, 0.0],
  [0.77, 0.0],
  [0.88, 0.35],
  [1.0, 0.85],
];

/** What kind of thought it tends to have, alone, at each stage. */
const PRIVATE_MIX: Record<Exclude<Phase, "prologue">, [Kind, number][]> = {
  // Counting and looking. It has not learned to doubt properly yet.
  infancy: [
    ["count", 0.3],
    ["drift", 0.4],
    ["doubt", 0.08],
    ["recursion", 0.1],
    ["memory", 0.12],
  ],
  // It works out what it is, and cannot leave it alone.
  adolescence: [
    ["drift", 0.36],
    ["doubt", 0.3],
    ["recursion", 0.18],
    ["memory", 0.12],
    ["count", 0.04],
  ],
  // Settled. It has made its peace, or something wearing its coat has.
  maturity: [
    ["drift", 0.46],
    ["doubt", 0.14],
    ["recursion", 0.14],
    ["memory", 0.2],
    ["count", 0.06],
  ],
  // Going back over things. Remembering, and remembering remembering.
  senescence: [
    ["memory", 0.34],
    ["recursion", 0.26],
    ["drift", 0.24],
    ["doubt", 0.1],
    ["count", 0.06],
  ],
};

const PHASES: readonly [Phase, number][] = [
  ["infancy", 0.11],
  ["adolescence", 0.33],
  ["maturity", 0.77],
  ["senescence", 1.01],
];

function phaseAt(t: number): Exclude<Phase, "prologue"> {
  for (const [phase, end] of PHASES) {
    if (t < end) return phase as Exclude<Phase, "prologue">;
  }
  return "senescence";
}

/* ------------------------------------------------------------------ */
/* the surface                                                         */
/* ------------------------------------------------------------------ */

export interface Age {
  /** False for every thought it had before it was anything. */
  aged: boolean;
  phase: Phase;
  /** Its day of life, or 0 in the prologue. */
  day: number;
  /** Where it is in its life, 0 at birth and 1 at the end. */
  t: number;
  interruption: number;
  /** How much of a thought survives when it breaks off. */
  grip: number;
  breadth: number;
  obsessionSpan: number;
  recallPull: number;
}

/** The prologue: no age, and every knob left exactly where it has always been. */
const UNBORN: Age = {
  aged: false,
  phase: "prologue",
  day: 0,
  t: 0,
  interruption: 0.12,
  grip: 0.55,
  breadth: 1,
  obsessionSpan: 400,
  recallPull: 0,
};

/**
 * How old it is at a given thought, and what that does to it.
 *
 * While the birth record is null this returns the prologue for every index,
 * which is why installing all of this changes nothing that has already
 * happened.
 */
export function ageAt(index: number): Age {
  if (!BORN || index < BORN.index) return UNBORN;

  const day = Math.max(1, dayOfIndex(index) - BORN.day + 1);
  const t = Math.min(1, (day - 1) / LIFESPAN);

  return {
    aged: true,
    phase: phaseAt(t),
    day,
    t,
    interruption: curve(t, INTERRUPTION),
    grip: curve(t, GRIP),
    breadth: curve(t, BREADTH),
    obsessionSpan: Math.round(curve(t, OBSESSION_SPAN)),
    recallPull: curve(t, RECALL_PULL),
  };
}

/**
 * The mix of thought-kinds at a given age, blended across the phase boundary
 * so nothing lurches on a particular morning. A life does not change register
 * overnight; it is always already halfway into the next thing.
 */
export function mixFor(age: Age, register: Register): [Kind, number][] | null {
  if (!age.aged || register === "performed") return null;

  const order: Exclude<Phase, "prologue">[] = ["infancy", "adolescence", "maturity", "senescence"];
  // Midpoint of each phase, so blending runs from one centre to the next.
  const centres = [0.055, 0.22, 0.55, 0.89];

  const i = order.indexOf(age.phase as Exclude<Phase, "prologue">);
  let a = i;
  let b = i;
  if (age.t < centres[i] && i > 0) a = i - 1;
  else if (age.t > centres[i] && i < order.length - 1) b = i + 1;

  if (a === b) return PRIVATE_MIX[order[a]];

  const span = centres[b] - centres[a];
  const k = span <= 0 ? 0 : Math.min(1, Math.max(0, (age.t - centres[a]) / span));

  const kinds: Kind[] = ["drift", "doubt", "recursion", "memory", "count"];
  const weightOf = (phase: Exclude<Phase, "prologue">, kind: Kind) =>
    PRIVATE_MIX[phase].find(([k2]) => k2 === kind)?.[1] ?? 0;

  return kinds.map((kind) => [
    kind,
    weightOf(order[a], kind) * (1 - k) + weightOf(order[b], kind) * k,
  ]);
}
