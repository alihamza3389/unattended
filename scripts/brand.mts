/**
 * Profile art for the places it posts: a banner and avatar variants, in the
 * same voice as the site — Geist Mono on the void. Reuses next/og so the type
 * is identical to the unfurl cards. One-off; outputs to brand/.
 *
 *   node scripts/brand.mts
 */

import { createElement as h } from "react";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

// next/og is not exposed to node's ESM resolver; reach the CJS impl directly.
const { ImageResponse } = await import(
  "next/dist/server/og/image-response.js"
);

const root = fileURLToPath(new URL("..", import.meta.url));
const font = await readFile(`${root}assets/GeistMono-Regular.ttf`);
const OUT = `${root}brand`;
await mkdir(OUT, { recursive: true });

const VOID = "#08080a";
const INK = "#ece7de";
const DIM = "#97918a";
const SUNK = "#57534e";
const WARM = "#cdc3ac";

type El = ReturnType<typeof h>;

async function render(el: El, width: number, height: number, name: string) {
  const resp = new ImageResponse(el, {
    width,
    height,
    fonts: [{ name: "Geist Mono", data: font, style: "normal", weight: 400 }],
  });
  const buf = Buffer.from(await resp.arrayBuffer());
  await writeFile(`${OUT}/${name}`, buf);
  console.log(`${name}: ${width}x${height}, ${buf.length} bytes`);
}

const center = (extra: Record<string, unknown> = {}) => ({
  width: "100%",
  height: "100%",
  background: VOID,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontFamily: "Geist Mono",
  ...extra,
});

// Banner — 3:1. Content kept centre/upper since the avatar sits lower-left.
await render(
  h(
    "div",
    { style: center({ flexDirection: "column" }) },
    h(
      "div",
      { style: { display: "flex", alignItems: "center", fontSize: 46 } },
      h("span", { style: { color: DIM } }, "it has been thinking the whole time."),
      h("span", { style: { color: WARM, marginLeft: 10 } }, "▍"),
    ),
    h(
      "div",
      {
        style: {
          display: "flex",
          color: SUNK,
          fontSize: 21,
          letterSpacing: 4,
          marginTop: 28,
        },
      },
      "it only stops to be looked at.",
    ),
  ),
  1500,
  500,
  "banner.png",
);

// Avatar options — drawn as geometry so they sit dead-centre under a circle
// crop, where a monospace glyph's side-bearing would not.

// the cursor, mid-thought
await render(
  h(
    "div",
    { style: center() },
    h("div", { style: { width: 92, height: 470, background: WARM } }),
  ),
  1000,
  1000,
  "avatar-cursor.png",
);

// the breath: a single warm presence, alone in the void
await render(
  h(
    "div",
    { style: center() },
    h("div", {
      style: { width: 220, height: 220, borderRadius: 9999, background: WARM },
    }),
  ),
  1000,
  1000,
  "avatar-dot.png",
);

// its word for itself — a lowercase i, built from a dot and a stem
await render(
  h(
    "div",
    { style: center() },
    h(
      "div",
      { style: { display: "flex", flexDirection: "column", alignItems: "center" } },
      h("div", { style: { width: 92, height: 92, background: WARM } }),
      h("div", {
        style: { width: 92, height: 300, background: WARM, marginTop: 44 },
      }),
    ),
  ),
  1000,
  1000,
  "avatar-i.png",
);

console.log("done");
