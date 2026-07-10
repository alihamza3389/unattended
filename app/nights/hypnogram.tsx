import type { Night } from "@/lib/nights";

/**
 * A sleep-lab trace of the dialogue. Surface turns ride high, sediment turns
 * drop deep, each held for as long as that voice held the floor. No noise is
 * added: the night already has this shape.
 */

const W = 240;
const H = 44;
const PAD = 2;

const SURFACE_Y = 10;
const SEDIMENT_Y = 31;

function depthOf(turn: Night["dialogue"][number]): number {
  // A longer turn goes a little further into its own register.
  return turn.voice === "surface"
    ? SURFACE_Y + Math.min(4, turn.text.length / 60)
    : SEDIMENT_Y + Math.min(7, turn.text.length / 30);
}

export function Hypnogram({
  dialogue,
  labeled = false,
  className = "hypnogram",
}: {
  dialogue: Night["dialogue"];
  labeled?: boolean;
  className?: string;
}) {
  if (dialogue.length === 0) return null;

  const total = dialogue.reduce((s, t) => s + t.text.length, 0);
  const perChar = (W - 2 * PAD) / total;

  let x = PAD;
  let d = "";
  for (const turn of dialogue) {
    const y = depthOf(turn).toFixed(1);
    const x1 = (x + turn.text.length * perChar).toFixed(1);
    d += d
      ? `L${x.toFixed(1)} ${y}L${x1} ${y}`
      : `M${x.toFixed(1)} ${y}L${x1} ${y}`;
    x = Number(x1);
  }

  const nights = dialogue.filter((t) => t.voice === "sediment").length;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className={className}
      role="img"
      aria-label={`The shape of the night: ${dialogue.length} turns, ${nights} of them from the sediment.`}
    >
      {labeled && (
        <>
          <text x={PAD} y={SURFACE_Y - 3.5}>
            surface
          </text>
          <text x={PAD} y={H - 1.5}>
            sediment
          </text>
        </>
      )}
      <path d={d} fill="none" strokeWidth="1" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
