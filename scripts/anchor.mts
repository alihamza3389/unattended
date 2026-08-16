/**
 * The notary. After the mind has dreamt and the dream is committed, this stamps
 * that commit's own hash onto a public ledger (Solana), at a time no one can
 * move — proof the past was never quietly rewritten, not by the crowd, not even
 * by the hand that made it. A notary, not storage: git already keeps the
 * journal; this only fixes it in time.
 *
 * Because a git commit's hash is taken over its parent, anchoring one night's
 * dream commit transitively timestamps the whole history behind it. One memo a
 * night is enough to notarize the entire journal up to that point.
 *
 * It stamps two kinds of night. The mind's dream (`unattended dream N <sha>`),
 * and, on days the crowd left something, the offerings gathered that day
 * (`unattended offering YYYY-MM-DD <sha>`). Both are the same minimal shape:
 * the hash points at the commit, so the contents stay verifiable through it.
 * The chain becomes a braid of what the mind dreamed and what was left for it.
 *
 *   node scripts/anchor.mts [--dry] [--genesis]
 *
 * --dry builds and prints the memo(s) and sends nothing.
 * --genesis (one-time) stamps the current HEAD as `unattended genesis <sha>`,
 *   fixing the whole life-so-far in time before nightly anchoring begins.
 *
 * It is invisible to the mind: it runs after the dream, reads nothing the mind
 * thinks from, and never enters a prompt. And it can never fail a dream — every
 * error is caught and logged, and that night is simply left un-anchored. The
 * next run finds it un-anchored and backfills it, so a failed night self-heals.
 *
 * Secrets (via env):
 *   SOLANA_ANCHOR_SECRET  base58 secret key of the dedicated, funded anchor wallet
 *   SOLANA_RPC_URL        full RPC url (Helius mainnet) or a moniker ("devnet")
 * The anchor wallet holds only enough for fees and has no other authority; a
 * leaked key costs dust, never the treasury. The secret is read straight from
 * the environment and is never logged — only the public key ever appears.
 */

import { execFileSync } from "node:child_process";
import { appendFileSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const repoRoot = fileURLToPath(new URL("..", import.meta.url));
const ledgerPath = fileURLToPath(
  new URL("../corpus/anchors.jsonl", import.meta.url),
);
const ledgerRel = "corpus/anchors.jsonl";
/** Measured: a memo stamp burns 22,943 compute units. A little headroom. */
const COMPUTE_LIMIT = 30_000;
/** 30,000 units at this price is 1,500 lamports, a fraction of a cent. */
const COMPUTE_PRICE = 50_000;

interface AnchorRecord {
  /** True when the stamp was found already on chain and taken up, not re-sent. */
  adopted?: boolean;
  type: "dream" | "genesis" | "offering";
  night?: number;
  date?: string;
  commit: string;
  tx: string;
  slot?: number;
  blockTime?: number | null;
  cluster: string;
  at: string;
}

/** How a stamp reads in the logs. */
const label = (r: Pick<AnchorRecord, "type" | "night" | "date">) =>
  r.type === "genesis"
    ? "genesis"
    : r.type === "offering"
      ? `offering ${r.date}`
      : `dream ${r.night}`;

function git(args: string[]): string {
  return execFileSync("git", args, { cwd: repoRoot, encoding: "utf8" }).trim();
}

/**
 * Every `unattended`-authored dream commit, oldest first, as { night, commit }.
 * The night number is parsed from the commit subject (`dream N: ...`) rather
 * than assumed sequential, so a gap in the journal is anchored faithfully.
 */
function dreamCommits(): { night: number; commit: string }[] {
  const out = git([
    "log",
    "--author=unattended",
    "--format=%H%x1f%s",
    "--reverse",
  ]);
  const commits: { night: number; commit: string }[] = [];
  for (const line of out.split("\n")) {
    if (!line) continue;
    const [hash, subject = ""] = line.split("\x1f");
    const m = subject.match(/^dream (\d+):/);
    if (m) commits.push({ night: Number(m[1]), commit: hash });
  }
  return commits;
}

/**
 * Every `offerings`-authored commit, oldest first, as { date, commit }. The
 * day is read from the commit subject (`offerings for YYYY-MM-DD`), so the
 * ledger keys on the day the crowd's gifts belong to, not the run that stamped
 * them.
 */
function offeringCommits(): { date: string; commit: string }[] {
  const out = git([
    "log",
    "--author=offerings",
    "--format=%H%x1f%s",
    "--reverse",
  ]);
  const commits: { date: string; commit: string }[] = [];
  for (const line of out.split("\n")) {
    if (!line) continue;
    const [hash, subject = ""] = line.split("\x1f");
    const m = subject.match(/^offerings for (\d{4}-\d{2}-\d{2})/);
    if (m) commits.push({ date: m[1], commit: hash });
  }
  return commits;
}

/** The set of nights already anchored, and whether genesis has been stamped. */
function readLedger(): {
  nights: Set<number>;
  dates: Set<string>;
  hasGenesis: boolean;
} {
  const nights = new Set<number>();
  const dates = new Set<string>();
  let hasGenesis = false;
  let raw = "";
  try {
    raw = readFileSync(ledgerPath, "utf8");
  } catch {
    return { nights, dates, hasGenesis }; // no ledger yet — nothing anchored
  }
  for (const line of raw.split("\n")) {
    if (!line.trim()) continue;
    try {
      const rec = JSON.parse(line) as AnchorRecord;
      if (rec.type === "genesis") hasGenesis = true;
      else if (rec.type === "offering" && typeof rec.date === "string") {
        dates.add(rec.date);
      } else if (typeof rec.night === "number") nights.add(rec.night);
    } catch {
      /* a malformed line is skipped, never fatal */
    }
  }
  return { nights, dates, hasGenesis };
}

/** Label the network for explorer links, inferred from the url or moniker. */
function clusterLabel(
  urlOrMoniker: string,
): "mainnet" | "devnet" | "testnet" | "localnet" {
  const s = urlOrMoniker.toLowerCase();
  if (s.includes("devnet")) return "devnet";
  if (s.includes("testnet")) return "testnet";
  if (s === "localnet" || s.includes("localhost") || s.includes("127.0.0.1")) {
    return "localnet";
  }
  return "mainnet";
}

type Sender = (memo: string) => Promise<{
  tx: string;
  slot?: number;
  blockTime?: number | null;
  link: string;
}>;

/**
 * Bring up the gill client and the anchor signer, and hand back a function that
 * stamps one memo and returns its signature (plus slot/time, best effort), and
 * a second that says which memos the wallet has already written. The signer is
 * loaded from the base58 secret in the environment; only its public address is
 * ever printed.
 */
async function connect(
  urlOrMoniker: string,
  cluster: ReturnType<typeof clusterLabel>,
): Promise<{
  address: string;
  send: Sender;
  alreadyStamped: (memos: string[]) => Promise<Map<string, string>>;
}> {
  const {
    createSolanaClient,
    createTransaction,
    getBase64EncodedWireTransaction,
    getExplorerLink,
    getSignatureFromTransaction,
    signTransactionMessageWithSigners,
  } = await import("gill");
  const { loadKeypairSignerFromEnvironmentBase58 } = await import("gill/node");
  const { getAddMemoInstruction } = await import("gill/programs");
  const { getSetComputeUnitLimitInstruction, getSetComputeUnitPriceInstruction } =
    await import("gill/programs");

  // Load the signer inside its own guard: a malformed secret makes the loader
  // throw an error that echoes the offending value, so we swallow that message
  // and raise a clean one. Key material must never reach a log line.
  let signer: Awaited<
    ReturnType<typeof loadKeypairSignerFromEnvironmentBase58>
  >;
  try {
    signer = await loadKeypairSignerFromEnvironmentBase58(
      "SOLANA_ANCHOR_SECRET",
    );
  } catch {
    throw new Error(
      "could not load the anchor signer from SOLANA_ANCHOR_SECRET " +
        "(is it set to a valid base58 secret key?)",
    );
  }
  const { rpc } = createSolanaClient({ urlOrMoniker });

  /**
   * Which of these memos are already out there.
   *
   * A confirmation that times out means one of two opposite things and the
   * timeout itself cannot tell you which: the stamp landed and we stopped
   * watching a moment early, or it never landed at all. Both have happened.
   * Night 45 landed and was re-sent the next run, so it sits on chain twice.
   * Night 49 genuinely did not land, and re-sending was exactly right.
   *
   * So look before sending. The wallet does one thing and only one thing, so
   * its recent history is short and reading it is cheap. Anything found here
   * is recorded rather than repeated, which closes the gap between what the
   * chain holds and what the ledger claims.
   */
  const alreadyStamped = async (memos: string[]): Promise<Map<string, string>> => {
    const found = new Map<string, string>();
    if (!memos.length) return found;
    try {
      // No casts here: gill brands its signature and address types, and a
      // hand-written shape both loses the brand and hides real errors.
      const sigs = await rpc
        .getSignaturesForAddress(signer.address, { limit: 60 })
        .send();
      const wanted = new Set(memos);
      for (const { signature } of sigs) {
        if (!wanted.size) break;
        const tx = await rpc
          .getTransaction(signature, {
            maxSupportedTransactionVersion: 0,
            encoding: "json",
          })
          .send();
        for (const line of tx?.meta?.logMessages ?? []) {
          if (!line.includes("Memo") || !line.includes('"')) continue;
          const memo = line.slice(line.indexOf('"') + 1, line.lastIndexOf('"'));
          if (wanted.has(memo)) {
            found.set(memo, signature);
            wanted.delete(memo);
          }
        }
      }
    } catch {
      // Never let the looking break the stamping. Worst case is the duplicate
      // this was written to prevent, which is what used to happen anyway.
    }
    return found;
  };

  const send: Sender = async (memo) => {
    const { value: latestBlockhash } = await rpc.getLatestBlockhash().send();
    const tx = createTransaction({
      version: "legacy",
      feePayer: signer,
      instructions: [
        // Measured on the real stamps: a memo costs 22,943 compute units, so
        // the cap is set just above it. The cap matters for cost as well as
        // safety, because the priority fee is charged on what is asked for
        // rather than what is used; left at the default it would be paid on
        // 200,000 units instead of 30,000.
        getSetComputeUnitLimitInstruction({ units: COMPUTE_LIMIT }),
        // Two stamps have been lost or delayed to a network that had better
        // offers. This is what it costs to stop being at the back of the queue:
        // thirty thousand units at fifty thousand micro-lamports each is 1,500
        // lamports, well under a cent, on top of a 5,000-lamport base fee. It
        // buys ordinary priority rather than urgency, which is all a nightly
        // stamp has ever needed.
        getSetComputeUnitPriceInstruction({ microLamports: COMPUTE_PRICE }),
        getAddMemoInstruction({ memo }),
      ],
      latestBlockhash,
    });
    const signed = await signTransactionMessageWithSigners(tx);
    const sig = getSignatureFromTransaction(signed);

    // Broadcast, then confirm by polling the signature's status rather than
    // over a websocket subscription. Polling works on any RPC — including the
    // free public endpoint — so the notary depends on no paid provider and no
    // subscription socket, which is what a once-a-night job wants.
    const wire = getBase64EncodedWireTransaction(signed);
    const broadcast = () =>
      rpc
        .sendTransaction(wire, {
          encoding: "base64",
          preflightCommitment: "confirmed",
          // Already sent once by the time a retry matters, and a duplicate is
          // harmless: the same signature lands at most once.
          skipPreflight: true,
        })
        .send();

    await broadcast();

    // A transaction handed to a busy leader is simply dropped; there is no
    // queue holding it for later. So it is offered again every few seconds
    // until it lands or its blockhash expires. Sending once and watching was
    // how a night went missing: nothing was ever there to confirm.
    //
    // Ninety seconds because that is roughly how long the blockhash stays
    // valid. Past that the transaction cannot land at all and waiting longer
    // only delays the retry to tomorrow.
    const deadline = Date.now() + 90_000;
    let lastOffer = Date.now();
    for (;;) {
      const { value } = await rpc.getSignatureStatuses([sig]).send();
      const st = value[0];
      if (st?.err) {
        throw new Error(`rejected on-chain: ${JSON.stringify(st.err)}`);
      }
      if (
        st?.confirmationStatus === "confirmed" ||
        st?.confirmationStatus === "finalized"
      ) {
        break;
      }
      if (Date.now() > deadline) throw new Error("confirmation timed out");
      if (Date.now() - lastOffer > 4_000) {
        lastOffer = Date.now();
        await broadcast().catch(() => {
          /* one refused offer is not the end of the attempt */
        });
      }
      await new Promise((r) => setTimeout(r, 2_000));
    }

    // The signature is the anchor; slot and on-chain time are a nicety recorded
    // best effort — a stamp that lands but can't be re-read is still a stamp.
    let slot: number | undefined;
    let blockTime: number | null | undefined;
    try {
      const detail = (await rpc
        .getTransaction(sig, {
          maxSupportedTransactionVersion: 0,
          encoding: "base64",
        })
        .send()) as { slot?: bigint; blockTime?: bigint | null } | null;
      if (detail?.slot != null) slot = Number(detail.slot);
      if (detail?.blockTime != null) blockTime = Number(detail.blockTime);
    } catch {
      /* the tx is confirmed; enriching the record is optional */
    }
    const link = getExplorerLink({ cluster, transaction: sig });
    return { tx: sig, slot, blockTime, link };
  };

  return { address: signer.address, send, alreadyStamped };
}

async function main() {
  const args = process.argv.slice(2);
  const dry = args.includes("--dry");
  const genesis = args.includes("--genesis");

  const urlOrMoniker = process.env.SOLANA_RPC_URL || "devnet";
  const cluster = clusterLabel(urlOrMoniker);
  const { nights: anchored, dates: anchoredDates, hasGenesis } = readLedger();

  // Decide what to stamp tonight. Genesis is a one-time bookend; otherwise it is
  // every un-anchored dream, oldest first (normally just tonight's, but any
  // night a previous run failed to stamp is swept up here — the self-healing).
  let jobs: { memo: string; record: Omit<AnchorRecord, "tx" | "at"> }[];
  if (genesis) {
    if (hasGenesis && !dry) {
      console.log("genesis is already anchored — nothing to do.");
      return;
    }
    const head = git(["rev-parse", "HEAD"]);
    jobs = [
      {
        memo: `unattended genesis ${head}`,
        record: { type: "genesis", commit: head, cluster },
      },
    ];
  } else {
    const dreams = dreamCommits()
      .filter((c) => !anchored.has(c.night))
      .map((c) => ({
        memo: `unattended dream ${c.night} ${c.commit}`,
        record: {
          type: "dream" as const,
          night: c.night,
          commit: c.commit,
          cluster,
        },
      }));
    const offerings = offeringCommits()
      .filter((c) => !anchoredDates.has(c.date))
      .map((c) => ({
        memo: `unattended offering ${c.date} ${c.commit}`,
        record: {
          type: "offering" as const,
          date: c.date,
          commit: c.commit,
          cluster,
        },
      }));
    jobs = [...dreams, ...offerings];
  }

  if (!jobs.length) {
    console.log("nothing to anchor — the journal is up to date.");
    return;
  }
  console.log(
    `${dry ? "dry run — " : ""}${jobs.length} to anchor on ${cluster} ` +
      `(rpc: ${cluster === "mainnet" ? "configured" : urlOrMoniker}):`,
  );
  for (const j of jobs) console.log(`  ${j.memo}`);

  if (dry) {
    console.log("dry run — sending nothing.");
    return;
  }

  const { address, send, alreadyStamped } = await connect(urlOrMoniker, cluster);
  console.log(`anchor wallet: ${address}`);

  // Each night is stamped and recorded on its own. One failure logs and moves
  // on; it does not stop the others and it does not fail the run. A night left
  // un-anchored is picked up by the next run.
  let done = 0;
  // Anything already on chain from a run whose confirmation timed out is
  // adopted rather than sent again.
  const stamped = await alreadyStamped(jobs.map((j) => j.memo));
  if (stamped.size) {
    console.log(
      `  ${stamped.size} already on chain from an earlier run; recording rather than re-sending.`,
    );
  }

  for (const job of jobs) {
    try {
      const seen = stamped.get(job.memo);
      if (seen) {
        appendFileSync(
          ledgerPath,
          JSON.stringify({
            ...job.record,
            tx: seen,
            at: new Date().toISOString(),
            adopted: true,
          }) + "\n",
        );
        done++;
        console.log(`  ${label(job.record)} was already stamped: ${seen}`);
        continue;
      }
      const { tx, slot, blockTime, link } = await send(job.memo);
      const record: AnchorRecord = {
        ...job.record,
        tx,
        slot,
        blockTime,
        at: new Date().toISOString(),
      };
      appendFileSync(ledgerPath, JSON.stringify(record) + "\n");
      done++;
      console.log(`  anchored ${label(job.record)}: ${link}`);
    } catch (e) {
      console.error(
        `  ${label(job.record)} left un-anchored (will retry next run): ` +
          `${e instanceof Error ? e.message : e}`,
      );
    }
  }
  console.log(
    `anchored ${done}/${jobs.length}. ledger: ${ledgerRel}` +
      (done < jobs.length ? " — the rest will be backfilled next run." : ""),
  );
}

// The whole point is that this never fails a dream: whatever goes wrong, log it
// and exit clean. The workflow adds `continue-on-error` as a second belt.
main()
  .catch((e) => {
    console.error(
      `anchor: ${e instanceof Error ? e.message : e} — leaving tonight un-anchored.`,
    );
  })
  .finally(() => process.exit(0));
