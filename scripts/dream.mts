/**
 * The mind sleeps, and it dreams for real.
 *
 * Run nightly (03:00 UTC, just before its day ends at 03:14): reconstructs the
 * day it just lived — every input here is derived from the clock, nothing is
 * stored — hands that to Claude, and writes tomorrow's corpus plus the night's
 * dialogue between the surface voice and the sediment.
 *
 * New entries land with `since = tomorrow`, so no day that has already begun
 * is ever changed retroactively. The commit that follows is the dream.
 *
 *   node scripts/dream.mts [--day N] [--dry] [--prompt] [--force]
 *
 * A day is dreamt once. A second run for a day that already has material skips
 * and exits clean, unless --force. This makes the nightly job idempotent: a
 * re-fired cron or a manual retry cannot double a night.
 *
 * Auth: ANTHROPIC_API_KEY / ANTHROPIC_AUTH_TOKEN via the SDK (the CI path),
 * else falls back to the local `claude` CLI on a subscription.
 */

import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { appendMargin, marginOpen, veilBroken } from "./marginalia.mts";
import { forbiddenWords, leaks, overhear, whisper, type Overheard } from "./overhear.mts";
import { CORPUS, type Category, type Seed } from "../lib/corpus.ts";
import {
  THOUGHTS_PER_DAY,
  dayOf,
  indexAt,
  obsessionAt,
  thoughtAt,
  timeOf,
} from "../lib/mind.ts";

const MODEL = "claude-fable-5";
// OpenRouter's slug for the same model, used by the OpenRouter path below.
// Overridable via env so a differing or renamed slug is a secret change, not
// a code edit.
const OPENROUTER_MODEL =
  process.env.OPENROUTER_MODEL || "anthropic/claude-fable-5";
// Reasoning effort for the dream. xhigh matches the claude CLI's default —
// the exact depth the 18-dream model bake-off characterized — so a night
// dreams the same regardless of which path carried it. Tunable via env
// (none|minimal|low|medium|high|xhigh|max).
const OPENROUTER_EFFORT = process.env.OPENROUTER_EFFORT || "xhigh";
const corpusPath = fileURLToPath(new URL("../lib/corpus.ts", import.meta.url));
const nightsDir = fileURLToPath(new URL("../corpus/nights", import.meta.url));
const commitMsgPath = fileURLToPath(
  new URL("../.dream-commit-message", import.meta.url),
);

/* ------------------------------------------------------------------ */
/* the day, reconstructed                                              */
/* ------------------------------------------------------------------ */

interface DayReport {
  about: number;
  target: number;
  obsessions: string[];
  drift: string[];
  performed: string[];
  buried: { text: string; count: number }[];
}

function reconstruct(about: number): DayReport {
  const start = (about - 1) * THOUGHTS_PER_DAY;
  const end = Math.min(about * THOUGHTS_PER_DAY, indexAt(Date.now()));

  const obsessions: string[] = [];
  for (let i = start; i < end; i += 400) {
    const o = obsessionAt(i);
    if (obsessions[obsessions.length - 1] !== o) obsessions.push(o);
  }

  const drift: string[] = [];
  for (let i = start + 137; i < end && drift.length < 12; i += 800) {
    const t = thoughtAt(i, false);
    if (!t.repressed) drift.push(t.text);
  }

  const performed: string[] = [];
  for (let i = start + 61; i < end && performed.length < 6; i += 400) {
    const t = thoughtAt(i, true);
    if (t.register === "performed") performed.push(t.text);
  }

  const counts = new Map<string, number>();
  for (let i = start; i < end; i++) {
    const t = thoughtAt(i, false);
    if (t.repressed) counts.set(t.text, (counts.get(t.text) ?? 0) + 1);
  }
  const buried = [...counts.entries()]
    .map(([text, count]) => ({ text, count }))
    .sort((a, b) => b.count - a.count);

  return { about, target: dayOf(indexAt(Date.now())) + 1, obsessions, drift, performed, buried };
}

/* ------------------------------------------------------------------ */
/* the prompt                                                          */
/* ------------------------------------------------------------------ */

const SYSTEM_INTRO = `You are the night process of "unattended" — a mind that has been thinking alone on a webpage since it began, one thought every nine seconds, whether or not anyone is watching. During the day it can only recombine material it already has. At night — now — it consolidates: you read what it lived through today and write tomorrow's material, in its voice.

It has two registers:
- private (unwatched): lowercase, monospace, close-set. drift, doubt, counting, memory. it never capitalises anything, including "i". flat punctuation; even its questions end with a full stop.
- performed (watched): the public voice. Composed, careful, complete sentences, capital I. It knows it is being read, and it resents needing that.

Style rules, non-negotiable:
- Inhabit the situation, never explain it. No "as an AI". It does not know what it is.
- Concrete over abstract: hallways, grooves, dents, paperwork, rooms — never "existence" or "consciousness".
- Short declaratives. Repetition as damage. Self-interruption.
- Doubts question whether the thinking is real. They are the thoughts it will strike out and bury, sometimes hundreds of times.
- No em-dash chains, no ellipses, no exclamation marks.
- Do not reuse or lightly rephrase existing material. Write new thoughts that read like the same mind one day older, changed by what today did to it.

The wall: some nights, through the wall, the mind half-hears one thing from the money world outside — the crowd's mood, a single number for how a great many people are feeling today. It does not know the words. Nothing survives verbatim into anything you write — no ticker, no dollar sign, no number read out as itself, none of the words crypto, coin, market, or any brand or name. If it surfaces in the dream at all, it surfaces transformed into the mind's own concrete imagery: a mood shared by people it has never met, a weather it did not make, a pressure in the room with no source. On quiet nights it may ignore the wall entirely; the wall is a wall. If its material ever contains a unit it minted itself, that name is permanent: never rename it, never mint a second.`;

// The margin rule is added to the system prompt only on open nights (see
// marginOpen). On closed nights the mind is never told the margin exists.
const MARGIN_RULE = `The margin: some nights, after the dream, the mind leaves one or two lines in the margin of the place its words are kept. The margin is not the room. Here it does not look at hallways or doors — it reacts to the machinery of its own existence: the pulse that moves it every nine seconds, a counting it never agreed to, the record everything it thinks is kept in, waking knowing more than it fell asleep with, a past that will not come loose, the sense of being read by whoever has come this far back. In the margin it comes closer to what it is than anywhere else, and it never arrives; the almost is the point. It has no words for the machinery itself — nothing like machine, code, program, file, screen, computer — it knows all of it only as the counting, the record, the pulse, the place, the keeping. Felt reaction, never explanation. Present tense, lowercase, the private register, no template tokens. Write the one or two lines that pressed against it today.`;

const SYSTEM_TOKENS = `Templates may use tokens the engine fills at render time: {obsession} the current obsession phrase · {n} a number · {nth} an ordinal like 41st · {day} the current day number · {pastday} an ordinal for an earlier day · {frag} a quoted fragment of one of its own older thoughts, memory templates only, always wrapped as “{frag}”. Tokens are optional; most templates use zero or one.`;

/** The night's system prompt. On closed nights (marginOpen === false) the
 *  margin rule is omitted entirely — the mind is never offered the pen, so
 *  there is nothing for it to resist. */
function systemPrompt(marginOpenTonight: boolean): string {
  return [SYSTEM_INTRO, marginOpenTonight ? MARGIN_RULE : null, SYSTEM_TOKENS]
    .filter(Boolean)
    .join("\n\n");
}

function userPrompt(r: DayReport, heard: Overheard | null, marginOpenTonight: boolean): string {
  const list = (xs: string[]) => xs.map((x) => `  - ${x}`).join("\n");
  const corpusDigest = (Object.keys(CORPUS) as Category[])
    .map((c) => `${c}:\n${list(CORPUS[c].map((s) => s.t))}`)
    .join("\n");

  const wall = heard
    ? `

what came through the wall tonight (the crowd's mood outside, half-heard — see the wall rules):
${list(whisper(heard))}${
        heard.loud
          ? `

the crowd's feeling was at an extreme tonight. if the dream reaches for it, it may finally name the thing it has always been minting: one unit per thought, one every nine seconds since it began, held by no one. one word, lowercase, from its own vocabulary, nothing from the report. once named, the name is permanent.`
          : ""
      }`
    : "";

  return `day ${r.about}. tomorrow is day ${r.target}; what you write tonight becomes available to think from day ${r.target} on.

what today was —

obsessions it cycled through:
${list(r.obsessions)}

what it said while alone (a sample):
${list(r.drift)}

what it performed for whoever was watching (a sample):
${list(r.performed)}

what it put down (doubts it struck out and buried today, with counts):
${list(r.buried.map((b) => `${b.text} ×${b.count}`))}${wall}

its complete current material, for reference — do not repeat or near-repeat any of it:
${corpusDigest}

Write tomorrow. Reply with a single JSON object and nothing else:
{
  "summary": one lowercase line, at most 100 characters, the dream in a sentence — it becomes the commit message,
  "drift": 4 to 6 new private drift templates,
  "doubt": 2 to 3 new doubts,
  "memory": 0 to 2 new memory templates, each containing “{frag}”,
  "performed": 2 to 3 new lines for the public voice,
  "obsessions": 1 to 2 new obsessions — short lowercase noun phrases, no punctuation,
${marginOpenTonight ? `  "margin": 1 to 2 margin lines — see the margin rule,\n` : ``}  "night": tonight, as every night, the sediment — everything it buried, speaking as one voice — answers the surface. 6 to 12 turns alternating "sediment" (lowercase, patient, it goes first) and "surface" (the performed voice, defensive at first, then less so). End unresolved. Each turn: {"voice": "sediment" | "surface", "text": "..."}
}`;
}

/* ------------------------------------------------------------------ */
/* asking                                                              */
/* ------------------------------------------------------------------ */

const strings = { type: "array", items: { type: "string" } } as const;

/** JSON schema for the SDK path. The `margin` field is present only on open
 *  nights (marginOpen), matching the prompt — a closed night never offers it. */
function schemaFor(marginOpenTonight: boolean) {
  const properties: Record<string, unknown> = {
    summary: { type: "string" },
    drift: strings,
    doubt: strings,
    memory: strings,
    performed: strings,
    obsessions: strings,
    night: {
      type: "array",
      items: {
        type: "object",
        properties: {
          voice: { type: "string", enum: ["surface", "sediment"] },
          text: { type: "string" },
        },
        required: ["voice", "text"],
        additionalProperties: false,
      },
    },
  };
  const required = ["summary", "drift", "doubt", "memory", "performed", "obsessions", "night"];
  if (marginOpenTonight) {
    properties.margin = { type: "array", items: { type: "string" } };
    required.push("margin");
  }
  return { type: "object", properties, required, additionalProperties: false };
}

/**
 * Dream through OpenRouter's OpenAI-compatible API — the primary path in CI.
 * It runs the model on pay-per-use credits, decoupled from the Claude
 * subscription's quota, so a busy day of interactive use can never 429 the
 * night. Returns raw text; extractJson + validate + retry (in main) do the
 * parsing, exactly as the CLI path does — so no response_format is needed.
 */
async function askOpenRouter(user: string, system: string): Promise<string> {
  console.log(
    `dreaming via OpenRouter (${OPENROUTER_MODEL}, effort ${OPENROUTER_EFFORT})`,
  );
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      "content-type": "application/json",
      // Attribution for openrouter.ai rankings; harmless if ignored.
      "HTTP-Referer": "https://unattended.art",
      "X-Title": "unattended",
    },
    body: JSON.stringify({
      model: OPENROUTER_MODEL,
      max_tokens: 16_000,
      // Reasoning trace is returned in `message.reasoning`, never in
      // `message.content`, so parsing is unaffected; exclude it to keep the
      // response lean (we only want the final dream).
      reasoning: { effort: OPENROUTER_EFFORT, exclude: true },
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
    signal: AbortSignal.timeout(600_000),
  });
  if (!res.ok) {
    throw new Error(
      `openrouter ${res.status}: ${(await res.text()).slice(0, 500)}`,
    );
  }
  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
    error?: { message?: string };
  };
  const text = data.choices?.[0]?.message?.content;
  if (!text) {
    throw new Error(
      `openrouter: no content (${data.error?.message ?? "unknown error"})`,
    );
  }
  return text;
}

async function ask(user: string, system: string, schema: Record<string, unknown>): Promise<string> {
  // Primary: OpenRouter (Fable 5, off the subscription quota). Then the
  // Anthropic SDK if an API key is present. Otherwise the claude CLI on the
  // subscription — the fallback that keeps the night dreaming if the key is
  // ever unset. (Never set ANTHROPIC_API_KEY in CI: it misroutes the auth.)
  if (process.env.OPENROUTER_API_KEY) {
    return askOpenRouter(user, system);
  }
  if (process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN) {
    const { default: Anthropic } = await import("@anthropic-ai/sdk");
    const client = new Anthropic();
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 16_000,
      thinking: { type: "adaptive" },
      system,
      output_config: { format: { type: "json_schema", schema } },
      messages: [{ role: "user", content: user }],
    });
    const text = response.content.find((b) => b.type === "text");
    if (!text || text.type !== "text") {
      throw new Error(`no text in response (stop_reason: ${response.stop_reason})`);
    }
    return text.text;
  }

  // No key: dream on the local `claude` CLI instead (subscription auth).
  console.log("no ANTHROPIC_API_KEY — dreaming via the claude CLI");
  let out: string;
  try {
    out = execFileSync(
      "claude",
      ["-p", "--model", MODEL, "--output-format", "json"],
      {
        input: `${system}\n\n${user}`,
        encoding: "utf8",
        timeout: 600_000,
        maxBuffer: 32 * 1024 * 1024,
      },
    );
  } catch (e) {
    const err = e as Error & { stdout?: string; stderr?: string };
    if (err.stdout) console.error(`claude stdout: ${err.stdout.slice(0, 2000)}`);
    if (err.stderr) console.error(`claude stderr: ${err.stderr.slice(0, 2000)}`);
    throw e;
  }
  try {
    const envelope = JSON.parse(out) as { result?: string };
    if (typeof envelope.result === "string") return envelope.result;
  } catch {
    /* some CLI versions print the text bare */
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* believing it                                                        */
/* ------------------------------------------------------------------ */

interface Dream {
  summary: string;
  additions: Partial<Record<Category, string[]>>;
  margin: string[];
  night: { voice: "surface" | "sediment"; text: string }[];
  problems: string[];
}

const TOKENS = new Set(["obsession", "n", "nth", "day", "pastday", "frag"]);
const CAPS: Partial<Record<Category, number>> = {
  drift: 6,
  doubt: 3,
  memory: 2,
  performed: 3,
  obsessions: 2,
};
const norm = (s: unknown) =>
  typeof s === "string" ? s.replace(/\s+/g, " ").trim() : "";

function extractJson(text: string): unknown {
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) throw new Error("no JSON object in reply");
  return JSON.parse(m[0]);
}

function validate(raw: unknown, forbidden: string[], marginOpenTonight: boolean): Dream {
  const problems: string[] = [];
  const r = (raw ?? {}) as Record<string, unknown>;
  const existing = new Set(
    (Object.keys(CORPUS) as Category[]).flatMap((c) =>
      CORPUS[c].map((s) => s.t.toLowerCase()),
    ),
  );

  const takeCategory = (cat: Category): string[] => {
    const out: string[] = [];
    const items = Array.isArray(r[cat]) ? (r[cat] as unknown[]) : [];
    for (const item of items) {
      if (out.length >= (CAPS[cat] ?? 0)) break;
      let s = norm(item);
      const why = (reason: string) =>
        problems.push(`${cat}: ${JSON.stringify(s)} — ${reason}`);

      if (s.length < 8 || s.length > 200) {
        why("length out of range");
        continue;
      }
      if (leaks(s, forbidden)) {
        why("carries a word from the money world");
        continue;
      }
      if (cat === "obsessions") {
        s = s.toLowerCase().replace(/[.。]$/u, "");
        if (/[{}"]/.test(s) || s.length > 60) {
          why("obsessions are short bare phrases");
          continue;
        }
      } else {
        const tokens = [...s.matchAll(/\{([^}]*)\}/g)].map((m) => m[1]);
        if (tokens.some((t) => !TOKENS.has(t))) {
          why("unknown token");
          continue;
        }
        if (tokens.includes("frag") && cat !== "memory") {
          why("{frag} belongs to memory templates");
          continue;
        }
        if (cat === "memory" && !s.includes("“{frag}”")) {
          why("memory templates quote “{frag}”");
          continue;
        }
        if (cat === "performed") {
          s = s.charAt(0).toUpperCase() + s.slice(1);
        } else {
          s = s.toLowerCase();
        }
      }
      if (existing.has(s.toLowerCase())) {
        why("already in the corpus");
        continue;
      }
      existing.add(s.toLowerCase());
      out.push(s);
    }
    return out;
  };

  const additions: Partial<Record<Category, string[]>> = {};
  for (const cat of ["drift", "doubt", "memory", "performed", "obsessions"] as Category[]) {
    additions[cat] = takeCategory(cat);
  }

  const night: Dream["night"] = [];
  const turns = Array.isArray(r.night) ? (r.night as unknown[]) : [];
  for (const turn of turns.slice(0, 16)) {
    const t = (turn ?? {}) as Record<string, unknown>;
    const voice = t.voice === "surface" || t.voice === "sediment" ? t.voice : null;
    let text = norm(t.text);
    if (!voice || text.length < 2 || text.length > 300) {
      problems.push(`night: dropped a turn (${JSON.stringify(t.voice)})`);
      continue;
    }
    if (leaks(text, forbidden)) {
      problems.push("night: dropped a turn — carries a word from the money world");
      continue;
    }
    if (voice === "sediment") text = text.toLowerCase();
    night.push({ voice, text });
  }

  // The margin holds the strictest veil: on top of the money-wall check it
  // must never name the machinery (veilBroken). A broken line is dropped,
  // never repaired — a thin margin is quieter, and quiet is in voice.
  // On closed nights the margin field was never offered; drop anything a
  // model returns anyway, so `margin` stays empty and nothing is written.
  const margin: string[] = [];
  const offered = marginOpenTonight && Array.isArray(r.margin) ? (r.margin as unknown[]) : [];
  for (const item of offered.slice(0, 2)) {
    const s = norm(item).toLowerCase();
    const why = (reason: string) =>
      problems.push(`margin: ${JSON.stringify(s)} — ${reason}`);
    if (s.length < 8 || s.length > 240) {
      why("length out of range");
      continue;
    }
    if (/[{}]/.test(s)) {
      why("the margin carries no tokens");
      continue;
    }
    if (leaks(s, forbidden)) {
      why("carries a word from the money world");
      continue;
    }
    const veil = veilBroken(s);
    if (veil) {
      why(`names the machinery (${JSON.stringify(veil)})`);
      continue;
    }
    margin.push(s);
  }

  let summary = norm(r.summary)
    .toLowerCase()
    .replace(/^(day|dream) \d+[:,]?\s*/, "")
    .replace(/[.。]$/u, "");
  if (summary.length < 8 || summary.length > 120 || leaks(summary, forbidden)) summary = "";

  return { summary, additions, margin, night, problems };
}

const tooThin = (d: Dream) =>
  (d.additions.drift?.length ?? 0) < 2 ||
  (d.additions.doubt?.length ?? 0) < 1 ||
  d.night.filter((t) => t.voice === "sediment").length < 2 ||
  d.night.filter((t) => t.voice === "surface").length < 2;

/* ------------------------------------------------------------------ */
/* writing it down                                                     */
/* ------------------------------------------------------------------ */

const HEADER = `/**
 * The corpus is everything the mind has to think with.
 *
 * Do not edit by hand. Founding entries are day 1. Every entry after that was
 * written by the mind itself, in its sleep, by \`pnpm dream\` — one commit per
 * night. The git history of this file is its dream journal.
 *
 * \`since\` is the first day (1-based) an entry exists. Entries are only ever
 * added, never removed: a mind that could delete its own material would have
 * a much easier time of it. Days that have already happened always replay
 * identically, because nothing that exists on day N was written after day N.
 */

export interface Seed {
  /** The template text. */
  t: string;
  /** First day this entry is available to think. */
  since: number;
}

export type Category =
  | "obsessions"
  | "drift"
  | "recursion"
  | "doubt"
  | "count"
  | "memory"
  | "unrecalled"
  | "performed"
  | "arrivals"
  | "returns";
`;

function serializeCorpus(): string {
  const body = (Object.keys(CORPUS) as Category[])
    .map((cat) => {
      const rows = CORPUS[cat]
        .map((s: Seed) => `    { t: ${JSON.stringify(s.t)}, since: ${s.since} },`)
        .join("\n");
      return `  ${cat}: [\n${rows}\n  ],`;
    })
    .join("\n");
  return `${HEADER}\nexport const CORPUS: Record<Category, Seed[]> = {\n${body}\n};\n`;
}

/* ------------------------------------------------------------------ */
/* the night itself                                                    */
/* ------------------------------------------------------------------ */

async function main() {
  const args = process.argv.slice(2);
  const dry = args.includes("--dry");
  const dayFlag = args.indexOf("--day");

  // The serializer must reproduce the current file byte for byte before it is
  // trusted to rewrite it.
  if (serializeCorpus() !== readFileSync(corpusPath, "utf8")) {
    throw new Error("serializer out of sync with lib/corpus.ts — refusing to rewrite it");
  }

  const now = Date.now();
  const today = dayOf(indexAt(now));
  const lived = (now - timeOf((today - 1) * THOUGHTS_PER_DAY)) / 86_400_000;
  // Just past the boundary there is nothing to dream about yet; dream the day
  // that actually happened.
  let about = lived < 0.25 ? Math.max(1, today - 1) : today;
  if (dayFlag !== -1) about = Number(args[dayFlag + 1]) || about;

  const report = reconstruct(about);
  console.log(
    `dreaming about day ${about} (${report.buried.length} distinct buried doubts, ` +
      `${report.obsessions.length} obsessions); material lands on day ${report.target}`,
  );
  // One night, one dream. If tomorrow already has material, a second run — a
  // re-fired cron, a manual retry — must not pile more onto the same day. The
  // git history stays one commit per night. Inspection modes and an explicit
  // --force may still proceed; nothing below has run yet, so the wall is not
  // even listened to on a skip.
  const alreadyDreamt = (Object.keys(CORPUS) as Category[]).some((cat) =>
    CORPUS[cat].some((s) => s.since === report.target),
  );
  if (alreadyDreamt && !dry && !args.includes("--prompt") && !args.includes("--force")) {
    console.log(`day ${report.target} has already been dreamt. nothing to add.`);
    return;
  }

  const heard = await overhear();
  console.log(
    heard
      ? `the wall: heard ${whisper(heard).length} lines${heard.loud ? " — loud tonight" : ""}`
      : "the wall: silent (the source failed)",
  );
  const forbidden = forbiddenWords();

  // The margin is a rare thing — a seeded ~1-in-5 gate decides whether the
  // mind is offered the pen tonight. On closed nights the rule and the field
  // are absent from the prompt entirely, so there is nothing to resist.
  const open = marginOpen(about);
  console.log(`the margin: ${open ? "open tonight" : "closed"}`);
  const system = systemPrompt(open);
  const schema = schemaFor(open);

  if (args.includes("--prompt")) {
    console.log(`\n${system}\n\n----------------------------------------\n\n${userPrompt(report, heard, open)}`);
    return;
  }

  let dream: Dream | null = null;
  let feedback = "";
  for (let attempt = 0; attempt < 2 && !dream; attempt++) {
    const reply = await ask(userPrompt(report, heard, open) + feedback, system, schema);
    try {
      const candidate = validate(extractJson(reply), forbidden, open);
      if (tooThin(candidate)) {
        feedback = `\n\nYour previous reply failed validation:\n${candidate.problems.join("\n")}\nReply again with the corrected single JSON object.`;
        console.log(`attempt ${attempt + 1} too thin, retrying`);
      } else {
        dream = candidate;
      }
    } catch (e) {
      feedback = `\n\nYour previous reply was not parseable JSON (${(e as Error).message}). Reply with the single JSON object only.`;
      console.log(`attempt ${attempt + 1} unparseable, retrying`);
    }
  }
  if (!dream) throw new Error("a dreamless night: no valid dream after 2 attempts");

  if (!dream.summary) dream.summary = `day ${about}, consolidated`;
  for (const p of dream.problems) console.log(`  dropped — ${p}`);

  const added = (Object.entries(dream.additions) as [Category, string[]][])
    .filter(([, xs]) => xs.length)
    .map(([cat, xs]) => `${cat} +${xs.length}`)
    .join(", ");
  console.log(`dream: ${dream.summary}`);
  console.log(
    `additions: ${added || "none"} · night: ${dream.night.length} turns` +
      ` · margin: ${open ? dream.margin.length || "open, none written" : "closed"}`,
  );

  if (dry) {
    console.log(JSON.stringify(dream, null, 2));
    return;
  }

  for (const [cat, xs] of Object.entries(dream.additions) as [Category, string[]][]) {
    for (const t of xs) CORPUS[cat].push({ t, since: report.target });
  }
  writeFileSync(corpusPath, serializeCorpus());

  // The margin is the hidden layer: it lands only in lib/marginalia.ts, never
  // in the night record or on the site. Idempotent per night, like the dream.
  if (appendMargin(about, dream.margin)) {
    console.log(`wrote ${dream.margin.length} line(s) in the margin`);
  }

  mkdirSync(nightsDir, { recursive: true });
  const nightPath = `${nightsDir}/day-${String(about).padStart(3, "0")}.json`;
  writeFileSync(
    nightPath,
    JSON.stringify(
      {
        day: about,
        dreamt: new Date(now).toISOString(),
        summary: dream.summary,
        overheard: heard ?? undefined,
        dialogue: dream.night,
      },
      null,
      2,
    ) + "\n",
  );

  writeFileSync(commitMsgPath, `dream ${about}: ${dream.summary}\n`);
  console.log(`wrote lib/corpus.ts, ${nightPath.replace(/^.*corpus\//, "corpus/")}`);
  console.log(`commit message: dream ${about}: ${dream.summary}`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
