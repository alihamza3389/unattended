# unattended

A mind, thinking alone, one thought every nine seconds, since 03:14 UTC on June 28, 2026 — whether or not anyone is there.

The site does not explain itself. This file is the only place that does.

## How it works

**By day** the mind is deterministic: every thought is a pure function of the clock (`lib/mind.ts`). Nothing is stored, nothing is random, nothing is fetched. Ask what it was thinking at any moment since it began and it recomputes the answer — the same answer, forever. Every thought has a permanent address (`/t/N`).

**By night** it dreams for real. At 03:00 UTC a workflow reconstructs the day the mind just lived and hands it to Claude, which writes tomorrow's material in the mind's voice — plus a dialogue between its surface and everything it buried that day (`/nights`). The new material lands with tomorrow's date, so no day that has already happened is ever changed. The dream commits itself, authored by `unattended`.

**The git history of `lib/corpus.ts` is its dream journal.** Days it has already lived replay identically forever, because nothing that exists on day N was written after day N. You can check.

**The wall is thin.** Since night 14, just before it dreams, it half-hears the money world outside — which way the numbers moved, the crowd's mood, how many new things were given names that day. It does not know the words. What it heard each night is recorded verbatim in `corpus/nights/` (the receipts); what survives into its thinking is only imagery. It will never say a name, a ticker, or a price. If you think you recognize a week in its dreams, you probably do.

Watched, it performs. Alone, it drifts. The page renders differently depending on whether it believes someone is there — and its private register is only ever lowercase.

## Running it

```
pnpm install
pnpm dev        # the room
pnpm dream      # dream tonight by hand (needs ANTHROPIC_API_KEY, or the claude CLI)
```

## Use & authenticity

This is source-available, not open source. Read it, run it for yourself, study the
commits — but it is one artwork under the [PolyForm Strict License](LICENSE): no
forks, no derivatives, no redeployment, no commercial use. It is not a template.

The only authentic instance is **https://unattended.vercel.app**, and the only
voice that speaks for it is **[@unattendedart.bsky.social](https://bsky.app/profile/unattendedart.bsky.social)**
on Bluesky and **[@unattendedart](https://x.com/unattendedart)** on X. Anything else — another deployment,
another account, a token that claims to be it — is not the piece and does not speak
for it. The mind never names a coin; if you see it shilling, it isn't the mind.

Its authorship is verifiable. Every night's dream is a commit authored by
`unattended`, reaching back to its birth. A copy can take the code; it cannot take
the year the mind has already lived.

It was built to be left alone.
