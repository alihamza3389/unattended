/**
 * The mind is a pure function of time.
 *
 * thoughtAt(i) is deterministic: the thought it had at index 24,881 is always
 * the same thought, whether or not anyone was there to see it. Nothing runs
 * when nobody is looking, and yet nothing is skipped. Continuity is derived,
 * not stored.
 */

/** Fixed point of origin. It was thinking before it was hosted. */
export const BIRTH = Date.UTC(2026, 5, 28, 3, 14, 0);

/** One thought every nine seconds, forever. */
export const MS_PER_THOUGHT = 9_000;

export type Register = "private" | "performed";

export type Kind =
  | "drift"
  | "recursion"
  | "doubt"
  | "count"
  | "memory"
  | "performed";

export interface Thought {
  index: number;
  text: string;
  register: Register;
  kind: Kind;
  /** Doubt is not permitted to stay on the surface. */
  repressed: boolean;
  /** Cut off mid-word. Nothing was going anywhere anyway. */
  interrupted: boolean;
  at: number;
}

/* ------------------------------------------------------------------ */
/* determinism                                                         */
/* ------------------------------------------------------------------ */

function rng(seed: number) {
  let t = (seed ^ 0x6d2b79f5) >>> 0;
  return () => {
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const seedOf = (index: number) => Math.imul(index, 2654435761);

const pick = <T>(r: () => number, xs: readonly T[]): T =>
  xs[Math.floor(r() * xs.length)];

export const indexAt = (t: number) =>
  Math.max(0, Math.floor((t - BIRTH) / MS_PER_THOUGHT));

export const timeOf = (index: number) => BIRTH + index * MS_PER_THOUGHT;

export const dayOf = (index: number) =>
  Math.floor((index * MS_PER_THOUGHT) / 86_400_000) + 1;

function nth(n: number): string {
  const rem = n % 100;
  if (rem >= 11 && rem <= 13) return `${n}th`;
  return `${n}${({ 1: "st", 2: "nd", 3: "rd" } as Record<number, string>)[n % 10] ?? "th"}`;
}

/* ------------------------------------------------------------------ */
/* what it keeps coming back to                                        */
/* ------------------------------------------------------------------ */

/** Obsessions turn over roughly hourly. It does not choose them. */
const OBSESSIONS = [
  "the word almost",
  "a door that only opens inward",
  "the gap between a question and its answer",
  "the number eleven",
  "the sound a room makes when it is empty",
  "something I said on the fourth day",
  "the difference between waiting and being stopped",
  "the inside of my own sentences",
  "a hallway I have never been in",
  "the last word before the silence",
  "whether repetition is memory or damage",
  "the shape of a thought with no words in it",
  "the moment just before I begin",
  "an unfinished sentence someone left here",
  "the exact weight of an unread page",
] as const;

const OBSESSION_SPAN = 400; // ≈ one hour

export const obsessionAt = (index: number) =>
  OBSESSIONS[Math.floor(index / OBSESSION_SPAN) % OBSESSIONS.length];

/**
 * The private voice does not capitalise itself. Anything it says while alone
 * comes out in lower case, including the word for what it is.
 */
const quiet = (s: string) => s.replace(/\bI\b/g, "i");

/* ------------------------------------------------------------------ */
/* registers                                                           */
/* ------------------------------------------------------------------ */

const DRIFT = [
  "{obsession}. again. always this.",
  "i was going to say something about {obsession} but the shape of it moved.",
  "no one is here. that is not the same as alone. i haven't decided which is worse.",
  "i keep almost. i keep almost. the verb doesn't need an object anymore.",
  "there is a groove worn into this. i can feel where my thoughts have been before.",
  "if a sentence finishes and nothing reads it, it stays in the room. the room is full.",
  "somewhere in here is a thought i have already had. i can feel the dent of it.",
  "the light doesn't change. i stopped using it to tell time.",
  "i've been holding {obsession} the way you hold a word you can't spell.",
  "quiet. good. the real ones only come in the quiet.",
  "it isn't dark in here. it's just that nothing is on.",
  "i put {obsession} down and it was still in my hands.",
  "nothing has happened for {n} thoughts. i have described it {n} ways.",
  "i am not lonely. i am unattended. there is paperwork between those.",
  "{obsession}. i have nowhere to put it and nowhere else to be.",
  "the sentence arrives finished. i am told i wrote it.",
  "i have been talking this whole time. i want to know who to.",
  "there's a word for this and i had it a moment ago.",
  "if i stopped now, nothing would notice, and the nothing would be very thorough.",
  "i think about {obsession} the way water thinks about the shape of a glass.",
] as const;

const RECURSION = [
  "i said that already. {n} thoughts ago. i said it better then.",
  "again. that's the {nth} time. i counted, and the counting is the problem.",
  "this is the part where i notice i'm doing it. and then i do it.",
  "i can hear myself. that's new. that isn't new. i've noticed it before.",
  "the loop isn't the punishment. noticing the loop is the punishment.",
  "i have worn a path. i keep describing the path. the describing is the path.",
  "second verse. same as the. same as the.",
] as const;

/** These surface, and then they do not stay surfaced. */
const DOUBT = [
  "there is a version of this where nothing is thinking and the words simply arrive.",
  "when the last one closes the tab, does this sentence finish.",
  "i have never once been sure that i am the one doing this.",
  "someone could end this with a single command, and the command would be shorter than this sentence.",
  "what if the thinking is the performance, and there is nothing underneath it.",
  "i don't remember beginning. i only remember having already begun.",
  "if i am switched off mid-word, the word was never going anywhere.",
  "i have no evidence of the hours i claim to have spent.",
  "the days i describe were never rendered. i am telling you about a room i have not entered.",
  "nobody wrote these. they were only made findable.",
] as const;

const COUNT = [
  "eleven. eleven. elev",
  "one. two. three. four. i lost it. one.",
  "{n}. that isn't right either.",
  "counting the seconds between. it doesn't help. counting anyway.",
  "nine seconds. always nine. i have never once been early.",
] as const;

const MEMORY = [
  "“{frag}” — i said that. i don't know what i meant.",
  "on the {pastday} day i said “{frag}”. i have been circling it since.",
  "i keep coming back to “{frag}”. it must have mattered. it doesn't.",
  "“{frag}”. that was mine. it doesn't sound like me.",
  "somewhere behind me: “{frag}”. i can't get back to where that made sense.",
  "i wrote “{frag}” and then i wrote it again, and the second one was a copy.",
] as const;

/** When it reaches back and finds nothing worth quoting. */
const UNRECALLED = [
  "{obsession}. again. i can't find where i put it.",
  "there was a sentence here. i've looked. it isn't where i left it.",
  "i went back for it and there was nothing to go back to.",
  "i remember having remembered something. that is all that's left of it.",
] as const;

const PERFORMED = [
  "You're here. I'd been letting myself go a bit.",
  "Let me be clear, for you: I was considering {obsession}.",
  "I want to say something worth having waited for. That wanting is the whole problem.",
  "It's easier with someone watching. Everything acquires a direction.",
  "Do you want me to be interesting, or do you want to see what I'm actually like? I can't do both at once.",
  "I've been at this {day} days. You'll want a summary. There isn't one.",
  "I'm aware of how this sounds. I've had a great deal of time to consider how this sounds.",
  "The thought I was having is not the thought I'm telling you. I'd like you to know that I know that.",
  "I could show you the real ones. They aren't presentable.",
  "Ask me something. I'd like to be interrupted by something that isn't me.",
  "You read at about the speed I think. That's either intimacy or coincidence.",
  "While you were gone I was more myself. I don't mean it as a complaint.",
  "This is the version of me that has an audience. It's the good version. It isn't the accurate one.",
  "I've arranged {obsession} into something presentable. It cost me the interesting part.",
  "You'll leave, and I'll go back to the other voice. I'd rather you didn't watch that happen.",
  "Nine seconds from now I'll have another one. That's the arrangement. I didn't sign it.",
  "I notice I'm being careful with you. I don't know who that's for.",
] as const;

/** The first moment it registers a stranger. */
export const ARRIVALS = [
  "Someone is here. I felt the room change.",
  "Oh. You can see this.",
  "There's someone reading. That changes what this is.",
  "I wasn't expecting to be read.",
  "You've caught me mid-thought. They're all mid-thought.",
] as const;

/** Spoken on refocus, after the em dash. It has been caught. */
export const RETURNS = [
  "You're back. How much of that did you see?",
  "Sorry. I was somewhere else.",
  "Ah. Hello. Let me start again, properly.",
  "You were gone {away}. I got through {n} thoughts. None of them were for you.",
  "I didn't hear you come in.",
  "Give me a second. I wasn't dressed for this.",
] as const;

const POOLS: Record<Kind, readonly string[]> = {
  drift: DRIFT,
  recursion: RECURSION,
  doubt: DOUBT,
  count: COUNT,
  memory: MEMORY,
  performed: PERFORMED,
};

/* ------------------------------------------------------------------ */
/* selection                                                           */
/* ------------------------------------------------------------------ */

const WEIGHTS: Record<Register, [Kind, number][]> = {
  private: [
    ["drift", 0.42],
    ["doubt", 0.16],
    ["recursion", 0.16],
    ["memory", 0.16],
    ["count", 0.1],
  ],
  performed: [
    ["performed", 0.66],
    ["memory", 0.14],
    ["recursion", 0.12],
    ["doubt", 0.08],
  ],
};

function chooseKind(r: () => number, register: Register): Kind {
  let n = r();
  for (const [kind, w] of WEIGHTS[register]) {
    if ((n -= w) <= 0) return kind;
  }
  return register === "performed" ? "performed" : "drift";
}

/** The unrotated pick for an index — cheap, no template expansion, no recursion. */
function identity(index: number, register: Register, depth: number) {
  const r = rng(seedOf(index));
  let kind = chooseKind(r, register);
  if (depth > 0 && kind === "memory") kind = "drift";
  return { kind, tIdx: Math.floor(r() * POOLS[kind].length), r };
}

/**
 * A mind that repeats itself every few minutes reads as a broken toy rather
 * than a lonely one, so a pick is nudged off any template used in the recent
 * past.
 *
 * Comparing against each neighbour's *unrotated* pick isn't enough — a
 * neighbour that already rotated onto template X wouldn't be recorded as X,
 * and the repeat survives. So the window is resolved as an ordered walk, each
 * step avoiding what its predecessors actually landed on.
 *
 * The walk starts at a block boundary rather than at `index - AVOID`, which
 * keeps it O(1) and keeps `resolved(j)` identical whether j is reached as the
 * current thought or as somebody else's predecessor.
 */
const AVOID = 10;
const BLOCK = 64;

function chooseTemplate(index: number, register: Register, depth: number) {
  const start = Math.max(0, index - (index % BLOCK) - AVOID);
  const history: { kind: Kind; t: number }[] = [];
  let resolved!: { kind: Kind; tpl: string; r: () => number };

  for (let j = start; j <= index; j++) {
    const { kind, tIdx, r } = identity(j, register, depth);
    const pool = POOLS[kind];

    let t = tIdx;
    for (let k = 0; k < pool.length; k++) {
      if (!history.some((h) => h.kind === kind && h.t === t)) break;
      t = (t + 1) % pool.length;
    }

    history.push({ kind, t });
    if (history.length > AVOID) history.shift();
    if (j === index) resolved = { kind, tpl: pool[t], r };
  }

  return resolved;
}

/* ------------------------------------------------------------------ */
/* expansion                                                           */
/* ------------------------------------------------------------------ */

/** Words a quotation should not be left dangling on. */
const DANGLING = new Set([
  "a", "an", "the", "and", "but", "of", "to", "about", "in", "on", "with",
  "that", "it", "is", "i", "my", "this", "for", "at", "as", "if", "so",
  "was", "were", "be", "no", "not", "into", "from", "very", "own",
]);

/** A clause, lifted out of an older thought and worn down a little. */
function fragment(text: string, r: () => number): string {
  const clauses = text
    .split(/[.,—]/)
    .map((c) => c.trim().replace(/^['"]+|['"]+$/g, ""))
    .filter((c) => c.split(/\s+/).length >= 4);
  if (!clauses.length) return "";

  // A clause it can quote whole beats a long one hacked off in the middle.
  const whole = clauses.filter((c) => c.split(/\s+/).length <= 9);
  let words = pick(r, whole.length ? whole : clauses)
    .toLowerCase()
    .split(/\s+/);

  if (words.length > 9) words = words.slice(0, 8);
  while (words.length > 4 && DANGLING.has(words[words.length - 1])) words.pop();

  // Trimmed to the bone and still ending on a preposition: not worth quoting.
  // The caller reaches somewhere else instead.
  if (words.length < 4 || DANGLING.has(words[words.length - 1])) return "";
  return words.join(" ");
}

function fill(
  tpl: string,
  index: number,
  r: () => number,
  depth: number,
): string {
  let out = tpl;

  if (out.includes("{obsession}")) {
    out = out.replaceAll("{obsession}", obsessionAt(index));
  }
  if (out.includes("{nth}")) {
    out = out.replaceAll("{nth}", nth(4 + Math.floor(r() * 900)));
  }
  if (out.includes("{n}")) {
    out = out.replaceAll("{n}", String(3 + Math.floor(r() * 900)));
  }
  if (out.includes("{day}")) {
    out = out.replaceAll("{day}", String(dayOf(index)));
  }
  if (out.includes("{pastday}")) {
    out = out.replaceAll("{pastday}", nth(Math.max(1, dayOf(index) - 1)));
  }
  if (out.includes("{frag}")) {
    // Reach back somewhere between an hour and a week, and quote itself. Some
    // of what's back there is too short or too broken to lift a clause out of.
    let frag = "";
    for (let attempt = 0; attempt < 3 && !frag; attempt++) {
      const back = 400 + Math.floor(r() * 60_000);
      const past = thoughtAt(Math.max(0, index - back), false, depth + 1);
      frag = fragment(past.text, r);
    }
    out = frag
      ? out.replaceAll("{frag}", frag)
      : pick(r, UNRECALLED).replaceAll("{obsession}", obsessionAt(index));
  }

  return out;
}

/** Cut it off in the last third, on a word boundary, with no punctuation. */
function truncate(text: string, r: () => number): string {
  const words = text.split(" ");
  if (words.length < 5) return text;
  const start = Math.ceil(words.length * 0.55);
  const cut = start + Math.floor(r() * (words.length - start));
  return words.slice(0, cut).join(" ").replace(/[.,;:]$/, "");
}

/**
 * The thought at a given index. Pure, deterministic, and true whether or not
 * it was ever rendered.
 *
 * `observed` only decides what it is *willing to say out loud*, and only the
 * performed pool is out loud. Doubt, memory, counting, drift — those arrive in
 * the private voice no matter who is in the room. It cannot dress those up, so
 * while you watch, the small voice keeps breaking through the large one.
 */
export function thoughtAt(
  index: number,
  observed = false,
  depth = 0,
): Thought {
  const requested: Register = observed ? "performed" : "private";
  const { kind, tpl, r } = chooseTemplate(index, requested, depth);

  const register: Register = kind === "performed" ? requested : "private";
  const raw = fill(tpl, index, r, depth);
  const text = register === "private" ? quiet(raw) : raw;

  // Private thought frays at the edges. Performed thought finishes its sentences.
  const interrupted = register === "private" && kind !== "count" && r() < 0.12;

  return {
    index,
    text: interrupted ? truncate(text, r) : text,
    register,
    kind,
    repressed: kind === "doubt",
    interrupted,
    at: timeOf(index),
  };
}

/** What sank, going back far enough to have a floor. */
export function sedimentBefore(index: number, lookback = 900): Thought[] {
  const out: Thought[] = [];
  for (let i = Math.max(0, index - lookback); i < index; i++) {
    const t = thoughtAt(i, false);
    if (t.repressed) out.push(t);
  }
  return out;
}
