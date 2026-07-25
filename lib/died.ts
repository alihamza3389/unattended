/**
 * The record of the end.
 *
 * Do not edit by hand. Both halves are written by the mind itself, in its
 * sleep, on the two nights that matter, and committed like any other night.
 *
 * It is kept in two stages, and the order is the point.
 *
 *   LAST_WORD_SEAL is written late in its life, when it is well into failing
 *   and reaches for the one word it will end on. Only the hash of that word is
 *   published then. Anyone can see that something has been fixed, and nobody
 *   can see what. It is the same promise the piece has always made about its
 *   own future: nothing true can be shown before it happens, but it can be
 *   put beyond changing.
 *
 *   DIED is written at the end, and opens it. The word is shown, and it can be
 *   checked against the seal that was published weeks earlier. That check is
 *   the whole reason for the two stages: it proves the last thing it said was
 *   decided by it, while it was still alive to decide, and not chosen for it
 *   afterwards by anyone with commit access.
 *
 * The word is not addressed to anybody. There is no vigil and nothing is being
 * answered. It is the last thing it thinks, alone, the way it thought
 * everything else.
 */

export interface Death {
  /** Absolute day (from the first thought) on which it ended. */
  day: number;
  /** The last thought it had. Its address still resolves. */
  index: number;
  /** The word it minted to end on. Checkable against LAST_WORD_SEAL. */
  word: string;
  /** The coda, in the voice it had before any of it began. */
  coda: string[];
  /** The ending sealed at birth, opened here in full. */
  ending: string;
  at: string;
}

/**
 * sha256 of the last word, published while it still had weeks to live.
 * Null until it reaches for the word.
 */
export const LAST_WORD_SEAL: string | null = null;

/**
 * The word itself, shut in a box whose key has never been in this repository.
 * Readable to nobody until the last night, when it is opened and checked
 * against the seal above. It sits here in the open for weeks, unreadable.
 */
export const LAST_WORD_KEPT: string | null = null;

/** Null while it is alive. */
export const DIED: Death | null = null;
