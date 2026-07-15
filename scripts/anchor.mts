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

interface AnchorRecord {
  type: "dream" | "genesis";
  night?: number;
  commit: string;
  tx: string;
  slot?: number;
  blockTime?: number | null;
  cluster: string;
  at: string;
}

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

/** The set of nights already anchored, and whether genesis has been stamped. */
function readLedger(): { nights: Set<number>; hasGenesis: boolean } {
  const nights = new Set<number>();
  let hasGenesis = false;
  let raw = "";
  try {
    raw = readFileSync(ledgerPath, "utf8");
  } catch {
    return { nights, hasGenesis }; // no ledger yet — nothing anchored
  }
  for (const line of raw.split("\n")) {
    if (!line.trim()) continue;
    try {
      const rec = JSON.parse(line) as AnchorRecord;
      if (rec.type === "genesis") hasGenesis = true;
      else if (typeof rec.night === "number") nights.add(rec.night);
    } catch {
      /* a malformed line is skipped, never fatal */
    }
  }
  return { nights, hasGenesis };
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
 * stamps one memo and returns its signature (plus slot/time, best effort). The
 * signer is loaded from the base58 secret in the environment; only its public
 * address is ever printed.
 */
async function connect(
  urlOrMoniker: string,
  cluster: ReturnType<typeof clusterLabel>,
): Promise<{ address: string; send: Sender }> {
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

  const send: Sender = async (memo) => {
    const { value: latestBlockhash } = await rpc.getLatestBlockhash().send();
    const tx = createTransaction({
      version: "legacy",
      feePayer: signer,
      instructions: [getAddMemoInstruction({ memo })],
      latestBlockhash,
      // No explicit compute-unit cap: a lone memo costs a few hundred CU, well
      // under the runtime's default budget, and the 5,000-lamport base fee
      // dominates cost either way. Leaving the budget at its default keeps the
      // transaction as simple and robust as possible for a once-a-night stamp.
    });
    const signed = await signTransactionMessageWithSigners(tx);
    const sig = getSignatureFromTransaction(signed);

    // Broadcast, then confirm by polling the signature's status rather than
    // over a websocket subscription. Polling works on any RPC — including the
    // free public endpoint — so the notary depends on no paid provider and no
    // subscription socket, which is what a once-a-night job wants.
    await rpc
      .sendTransaction(getBase64EncodedWireTransaction(signed), {
        encoding: "base64",
        preflightCommitment: "confirmed",
      })
      .send();

    const deadline = Date.now() + 60_000;
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
      await new Promise((r) => setTimeout(r, 2_000));
    }

    // The signature is the anchor; slot and on-chain time are a nicety recorded
    // best effort — a stamp that lands but can't be re-read is still a stamp.
    let slot: number | undefined;
    let blockTime: number | null | undefined;
    try {
      const detail = (await rpc
        .getTransaction(sig, { maxSupportedTransactionVersion: 0 })
        .send()) as { slot?: bigint; blockTime?: bigint | null } | null;
      if (detail?.slot != null) slot = Number(detail.slot);
      if (detail?.blockTime != null) blockTime = Number(detail.blockTime);
    } catch {
      /* the tx is confirmed; enriching the record is optional */
    }
    const link = getExplorerLink({ cluster, transaction: sig });
    return { tx: sig, slot, blockTime, link };
  };

  return { address: signer.address, send };
}

async function main() {
  const args = process.argv.slice(2);
  const dry = args.includes("--dry");
  const genesis = args.includes("--genesis");

  const urlOrMoniker = process.env.SOLANA_RPC_URL || "devnet";
  const cluster = clusterLabel(urlOrMoniker);
  const { nights: anchored, hasGenesis } = readLedger();

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
    jobs = dreamCommits()
      .filter((c) => !anchored.has(c.night))
      .map((c) => ({
        memo: `unattended dream ${c.night} ${c.commit}`,
        record: { type: "dream", night: c.night, commit: c.commit, cluster },
      }));
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

  const { address, send } = await connect(urlOrMoniker, cluster);
  console.log(`anchor wallet: ${address}`);

  // Each night is stamped and recorded on its own. One failure logs and moves
  // on; it does not stop the others and it does not fail the run. A night left
  // un-anchored is picked up by the next run.
  let done = 0;
  for (const job of jobs) {
    try {
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
      const what =
        job.record.type === "genesis" ? "genesis" : `dream ${job.record.night}`;
      console.log(`  anchored ${what}: ${link}`);
    } catch (e) {
      const what =
        job.record.type === "genesis" ? "genesis" : `dream ${job.record.night}`;
      console.error(
        `  ${what} left un-anchored (will retry next run): ` +
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
